const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');
const Chat = require('./models/chat');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const port = process.env.port || 2005;

// Route imports
const authRouter = require('./routes/auth');
const cuisineRouter = require('./routes/cuisine');
const chefRouter = require('./routes/chef');
const chatRouter = require('./routes/chat');

// MongoDB connection
mongoose
  .connect("mongodb+srv://onlychef:566446644@cluster0.r1gi3.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0y")
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.log(err));

// Middleware
app.use(express.json());

// Mounting routes with prefixes
app.use(authRouter);
app.use(cuisineRouter);
app.use(chefRouter);
app.use('/chat', chatRouter);

// Socket.IO connection handling
const connectedUsers = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join', (userId) => {
    try {
      if (!userId) {
        console.error('Join event received without userId');
        return;
      }
      console.log(`Join event received - userId: ${userId}, socketId: ${socket.id}`);
      connectedUsers.set(userId, socket.id);
      console.log(`User ${userId} joined with socket ${socket.id}`);
      console.log('Current connected users: ', Object.fromEntries(connectedUsers));
      
      // Send confirmation to the client
      socket.emit('joined', { userId, socketId: socket.id });
    } catch (error) {
      console.error('Error in join event:', error);
      socket.emit('error', { message: 'Error joining chat' });
    }
  });

  socket.on('message', async (data) => {
    try {
      console.log('Received message:', data);
      const { senderId, receiverId, message, isOffer, offerStatus } = data;
      
      if (!senderId || !receiverId || !message) {
        console.error('Invalid message data:', data);
        socket.emit('error', { message: 'Invalid message data' });
        return;
      }

      // Create message object with conditional offerStatus
      const messageData = {
        senderId,
        receiverId,
        message,
        isOffer: isOffer || false
      };

      // Only include offerStatus if it's an offer message
      if (isOffer && offerStatus) {
        messageData.offerStatus = offerStatus;
      }
      
      // Save message to database
      const chatMessage = new Chat(messageData);
      await chatMessage.save();
      console.log('Message saved to database:', chatMessage);

      // Send message to receiver if online
      const receiverSocketId = connectedUsers.get(receiverId);
      if (receiverSocketId) {
        console.log(`Sending message to receiver ${receiverId} with socket ${receiverSocketId}`);
        io.to(receiverSocketId).emit('message', {
          ...data,
          timestamp: chatMessage.timestamp
        });
      } else {
        console.log(`Receiver ${receiverId} is not online`);
      }

      // Send confirmation to sender
      socket.emit('message', {
        ...data,
        timestamp: chatMessage.timestamp
      });
    } catch (error) {
      console.error('Error handling message:', error);
      socket.emit('error', { message: 'Error sending message' });
    }
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected:', socket.id);
    // Find and remove the user from connected users
    for (const [userId, socketId] of connectedUsers.entries()) {
      if (socketId === socket.id) {
        connectedUsers.delete(userId);
        console.log(`User ${userId} disconnected`);
        console.log('Remaining connected users:', Object.fromEntries(connectedUsers));
        break;
      }
    }
  });
});

// Health check endpoint
app.get('/check', (req, res) => res.send('Server is working!'));

// 404 handler for undefined routes
app.use((req, res) => {
  res.status(404).send('Route not found');
});

// Start server
server.listen(port, "0.0.0.0", () => console.log(`Server listening on port ${port}!`));
