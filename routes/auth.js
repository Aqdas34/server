const express = require("express");
const User = require("../models/user");
const Chef = require("../models/chef");
const bcrypt = require("bcryptjs");
const jwt = require('jsonwebtoken');
const { verifyToken } = require("../middleware/auth");
const authRouter = express.Router();

authRouter.post("/api/signup", async (req, res) => {
    try {
      const { name, email, password } = req.body;
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }
  
      const hashedPassword = await bcrypt.hash(password, 10);
      let user = new User({
        email,
        password: hashedPassword,
        name,
      });
  
      // Save the user and handle any validation errors
      await user.save();
      res.json(user);
    } catch (e) {
      if (e.name === "ValidationError") {
        // Send a 400 status with the validation error message
        return res.status(400).json({ error: e.message });
      }
      // Generic server error
      res.status(500).json({ error: e.message });
    }
  });
  


authRouter.post("/api/signin", async (req, res) => {
    try {
        const { email, password } = req.body;
        const userExist = await User.findOne({ email });
        if (!userExist) {
            return res.status(500).json({ error: "User Doesn't  exists " });
        }
        const isMatch = await bcrypt.compare(password, userExist.password);
        if (!isMatch) {
            return res.status(500).json({ error: "Incorrect Password " });
        }
        const token = jwt.sign({ id: userExist._id }, "passwordKey");
        res.json({ token, ...userExist._doc });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


authRouter.post("/tokenIsValid", async (req, res) => {
    try {
      const token = req.header("x-auth-token");
      if (!token) return res.json(false);
      const verified = jwt.verify(token, "passwordKey");
      if (!verified) return res.json(false);
  
      const user = await User.findById(verified.id);
      if (!user) return res.json(false);
      res.json(true);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });



authRouter.get('/', verifyToken, async (req, res) => {
    const user = await User.findById(req.user);
    res.json({ ...user._doc, token: req.token });


});

authRouter.post('/api/becomeChef', verifyToken,async (req, res) => {
  try {
      const { ChefID } = req.body;
      console.log("ChefID",  req.user._id);


      // Step 1: Find the user by ID
      const user = await User.findById(req.user);
      console.log("user", user);
      if (!user) {
          return res.status(404).json({ message: 'User not found' });
      }

      // Step 3: Check if the user is already a chef
      const existingChef = await Chef.findOne({ChefId: user._id });
      if (existingChef) {
          return res.status(400).json({ message: 'User is already a chef' });
      }
      // Step 2: Check if the user is verified
      if (!user.isVerified) {
          return res.status(403).json({ message: 'User is not verified' });
      }
      user.type = 'chef';
      await user.save();

      // Step 4: Create a new Chef entry
      const newChef = new Chef({ChefID: user._id
        ,...req.body});
      const savedChef = await newChef.save();

      // Step 5: Return the saved chef
      res.status(201).json(savedChef);
  } catch (error) {
      console.error('Error adding chef:', error);
      res.status(500).json({ message: error.message });
  }
});

authRouter.put('/api/updateProfile', verifyToken, async (req, res) => {
    try {
        const { name, address, profileImage } = req.body;
        
        // Find the user
        const user = await User.findById(req.user);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Create an update object with only the provided fields
        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (address !== undefined) updateData.address = address;
        if (profileImage !== undefined) updateData.profileImage = profileImage;

        // Update the user with only the provided fields
        const updatedUser = await User.findByIdAndUpdate(
            req.user,
            { $set: updateData },
            { new: true } // Return the updated document
        );
        
        // Return the updated user data
        res.json({ 
            message: 'Profile updated successfully',
            user: {
                id: updatedUser._id,
                name: updatedUser.name,
                email: updatedUser.email,
                address: updatedUser.address,
                profileImage: updatedUser.profileImage,
                type: updatedUser.type,
                isVerified: updatedUser.isVerified
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

authRouter.put('/api/changePassword', verifyToken, async (req, res) => {
    try {
        const { newPassword } = req.body;
        
        // Validate required field
        if (!newPassword) {
            return res.status(400).json({ message: 'New password is required' });
        }

        // Find the user
        const user = await User.findById(req.user);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Hash the new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update the password
        user.password = hashedPassword;
        await user.save();
        
        res.json({ 
            message: 'Password changed successfully'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

authRouter.get("/api/getUserID", async (req, res) => {
    try {
        const { email } = req.query;
        
        if (!email) {
            return res.status(400).json({ error: "Email is required" });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        res.json({ userId: user._id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

authRouter.get("/api/checkEmail", async (req, res) => {
    try {
        const { email } = req.query;
        
        if (!email) {
            return res.status(400).json({ error: "Email is required" });
        }

        const user = await User.findOne({ email });
        res.json({ exists: !!user });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// authRouter.get("/api/users", async (req, res) => {
//     try {
//         res.json({ "data ": "users" });
//     } catch (e) {
//         res.status(500).json({ error: e.message });
//     }
// });
module.exports = authRouter;
