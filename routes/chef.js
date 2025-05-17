const express = require('express');
const Chef = require('../models/chef'); // Assuming you have a Chef model
const { verifyToken } = require('../middleware/auth');
const Cuisine = require('../models/cuisine');
const User = require('../models/user');
const Appointment = require('../models/appointment');
const mongoose = require('mongoose');
const router = express.Router();

// Route to list all chefs with respect to their specialities
router.get('/api/listBySpeciality', verifyToken, async (req, res) => {
    try {
        const { speciality } = req.query;
        if (!speciality) {
            return res.status(400).json({ message: 'Speciality is required' });
        }
        const cuisines = await Cuisine.find({ CuisineType: speciality });
     
        if (!cuisines.length) {
            return res.status(404).json({ message: 'No cuisines found for this speciality' });
        }
        const chefIds = cuisines.map(cuisine => cuisine.ChefId);
    
        const chefs = await Chef.find({ ChefID: { $in: chefIds.map(id => id.toString()) } });
        if (!chefs.length) {
            return res.status(404).json({ message: 'No chefs found for this speciality' });
        }
          const combinedData = await Promise.all(chefs.map(async chef => {
            const user = await User.findById(chef.ChefID);
            return {
                ...chef.toObject(),
                ...user.toObject()
            };
        }));
        
        res.status(200).json(combinedData);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
});




router.get('/api/listChefCuisines', verifyToken, async (req, res) => {
    const { chefId } = req.query;
    try {
        if (!chefId) {
            return res.status(400).json({ message: 'Chef ID is required' });
        }
        // Properly construct ObjectId using "new"
        const objectId = new mongoose.Types.ObjectId(chefId);
        const cuisines = await Cuisine.find({ ChefId: objectId });
        const user = await User.findById(objectId);
        if (!cuisines.length) {
            return res.status(404).json({ message: user.name + ' has no cuisines' });
        }
        res.status(200).json(cuisines);
    } catch (error) {
        console.error(`Error fetching cuisines for chefId ${chefId}:`, error);
        res.status(500).json({ message: 'Server error', error });
    }
});

// Route to set chef availability for next month
router.post('/api/setAvailability', verifyToken, async (req, res) => {
    try {
        const chef = await Chef.findOne({ ChefID: req.user._id });
        if (!chef) {
            return res.status(404).json({ message: 'Chef not found' });
        }

        const { dates } = req.body;
        if (!Array.isArray(dates)) {
            return res.status(400).json({ message: 'Dates must be an array' });
        }

        // Clear existing availability dates
        chef.AvailabilityDates = [];

        // Add new availability dates
        dates.forEach(dateStr => {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) {
                return res.status(400).json({ message: 'Invalid date format' });
            }
            chef.AvailabilityDates.push({
                date: date,
                isBooked: false
            });
        });

        await chef.save();
        res.status(200).json({ message: 'Availability updated successfully', dates: chef.AvailabilityDates });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Route to search chefs by availability dates
router.get('/api/searchByAvailability', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        if (!startDate || !endDate) {
            return res.status(400).json({ message: 'Start date and end date are required' });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return res.status(400).json({ message: 'Invalid date format' });
        }

        // Generate all dates in the range
        const allDates = [];
        let current = new Date(start);
        while (current <= end) {
            allDates.push(new Date(current));
            current.setDate(current.getDate() + 1);
        }

        // Get all chefs
        const chefs = await Chef.find({});
        const availableChefs = [];

        for (const chef of chefs) {
            // Get all booked dates for this chef in the range
            const bookedDatesInRange = chef.BookedDates.filter(booking =>
                booking.date >= start && booking.date <= end
            ).map(booking => booking.date.toDateString());

            // If there is at least one date in the range that is not booked, chef is available
            const isAvailable = allDates.some(date =>
                !bookedDatesInRange.includes(date.toDateString())
            );

            if (isAvailable) {
                availableChefs.push(chef);
            }
        }

        // Merge chef and user fields at the top level, like listBySpeciality
        const combinedData = await Promise.all(availableChefs.map(async chef => {
            const user = await User.findById(chef.ChefID);
            return {
                ...chef.toObject(),
                ...user.toObject()
            };
        }));

        res.status(200).json(combinedData);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Route to book a chef for specific date
router.post('/api/bookChef', verifyToken, async (req, res) => {
    try {
        const { 
            chefId, 
            date, 
            time,
            selectedCuisines,
            numberOfPersons,
            price,
            comments 
        } = req.body;

        if (!chefId || !date || !time || !selectedCuisines || !numberOfPersons || !price) {
            return res.status(400).json({ 
                message: 'Missing required fields: chefId, date, time, selectedCuisines, numberOfPersons, price' 
            });
        }

        // Find chef by ChefID
        const chef = await Chef.findOne({ ChefID: chefId });
        if (!chef) {
            return res.status(404).json({ message: 'Chef not found' });
        }

        // Convert date string to Date object
        const bookingDate = new Date(date);
        if (isNaN(bookingDate.getTime())) {
            return res.status(400).json({ message: 'Invalid date format' });
        }

        // Check if the date is already booked
        const existingBooking = chef.BookedDates.find(booking => 
            booking.date.toDateString() === bookingDate.toDateString()
        );

        if (existingBooking) {
            return res.status(400).json({ 
                message: 'This date is already booked',
                bookedDate: existingBooking.date
            });
        }

        // Get user from auth token
        const user = await User.findById(req.user);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Create new appointment
        const appointment = new Appointment({
            chefId: chef._id,
            userId: user._id,  // Use the user's _id
            date: bookingDate,
            time,
            selectedCuisines,
            numberOfPersons,
            price,
            comments: comments || '',
            status: 'Pending'
        });

        // Add booking to chef's booked dates
      

        // Save both appointment and chef updates
        await Promise.all([
            appointment.save(),
            chef.save()
        ]);

        res.status(200).json({ 
            message: 'Booking successful', 
            appointment: appointment,
            bookingId: appointment._id,
            bookedDate: bookingDate
        });
    } catch (error) {
        console.error('Booking error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Route to get chefs available on a specific date
router.get('/api/searchByDate', async (req, res) => {
    try {
        const { date } = req.query;
        if (!date) {
            return res.status(400).json({ message: 'Date is required' });
        }

        const searchDate = new Date(date);
        if (isNaN(searchDate.getTime())) {
            return res.status(400).json({ message: 'Invalid date format' });
        }

        // Get all chefs
        const chefs = await Chef.find({});
        const availableChefs = [];

        for (const chef of chefs) {
            // Check if the chef has any booking on the specified date
            const isBooked = chef.BookedDates.some(booking => 
                booking.date.toDateString() === searchDate.toDateString()
            );

            // If not booked, chef is available
            if (!isBooked) {
                availableChefs.push(chef);
            }
        }

        // Merge chef and user fields at the top level, like listBySpeciality
        const combinedData = await Promise.all(availableChefs.map(async chef => {
            const user = await User.findById(chef.ChefID);
            return {
                ...chef.toObject(),
                ...user.toObject()
            };
        }));

        res.status(200).json(combinedData);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Route to get user's appointments with filtering
router.get('/api/userAppointments',verifyToken, async (req, res) => {
    try {
        const { status, sortBy = 'date', sortOrder = 'desc' } = req.query;
        
        // Build query
        const query = { userId: req.user };
        if (status) {
            query.status = status;
        }

        // Build sort options
        const sortOptions = {};
        sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

        // Get appointments with populated chef info
        const appointments = await Appointment.find(query)
            .populate('userId', 'name email')
            .populate('chefId')
            .sort(sortOptions);
        

        // Format appointments according to the Flutter model
        const formattedAppointments = await Promise.all(appointments.map(async (appointment) => {
            const chef = await Chef.findById(appointment.chefId);
            const chefUser = await User.findById(chef.ChefID);
            
            return {
                _id: appointment._id,
                chefId: appointment.chefId._id,
                chefInfo: {
                    ...chef.toObject(),
                    ...chefUser.toObject()
                },
                userId: appointment.userId.toObject(),
                date: appointment.date,
                time: appointment.time,
                selectedCuisines: appointment.selectedCuisines,
                numberOfPersons: appointment.numberOfPersons,
                price: appointment.price,
                comments: appointment.comments,
                status: appointment.status,
                createdAt: appointment.createdAt,
                updatedAt: appointment.updatedAt
            };
        }));

        // Group appointments by status
        const grouped = {
            pending: formattedAppointments.filter(a => a.status === 'Pending'),
            accepted: formattedAppointments.filter(a => a.status === 'Accepted'),
            completed: formattedAppointments.filter(a => a.status === 'Completed'),
            cancelled: formattedAppointments.filter(a => a.status === 'Cancelled'),
            rejected: formattedAppointments.filter(a => a.status === 'Rejected')
        };

        // Calculate stats
        const stats = {
            pending: grouped.pending.length,
            accepted: grouped.accepted.length,
            completed: grouped.completed.length,
            cancelled: grouped.cancelled.length,
            rejected: grouped.rejected.length
        };

        res.status(200).json({
            appointments: formattedAppointments,
            grouped: grouped,
            total: formattedAppointments.length,
            stats: stats
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Route to get chef's appointments
router.get('/api/chefAppointments', verifyToken, async (req, res) => {
    try {
        const chef = await Chef.findOne({ ChefID: req.user });
        if (!chef) {
            return res.status(404).json({ message: 'Chef not found' });
        }

        const appointments = await Appointment.find({ chefId: chef._id })
            .populate('userId', 'name email')
            .sort({ date: 1 });

        res.status(200).json(appointments);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Route to update appointment status
router.post('/api/updateAppointmentStatus', verifyToken, async (req, res) => {
    try {
        const { appointmentId, status } = req.body;

        if (!appointmentId || !status) {
            return res.status(400).json({ 
                message: 'Appointment ID and status are required' 
            });
        }

        // Validate status
        const validStatuses = ['Pending', 'Accepted', 'Completed', 'Cancelled', 'Rejected'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ 
                message: 'Invalid status. Must be one of: ' + validStatuses.join(', ') 
            });
        }

        // Find the appointment
        const appointment = await Appointment.findById(appointmentId)
            .populate('userId', 'name email')
            .populate('chefId');
            
        if (!appointment) {
            return res.status(404).json({ message: 'Appointment not found' });
        }

        // Verify that the authenticated user is either the chef or the user who made the booking
        const chef = await Chef.findOne({ ChefID: req.user });
        if (!chef && appointment.userId._id.toString() !== req.user.toString()) {
            return res.status(403).json({ 
                message: 'Not authorized to update this appointment' 
            });
        }

        // Handle booking dates based on status change
        if (status === 'Accepted') {
            // Add to booked dates if not already there
            const isAlreadyBooked = chef.BookedDates.some(booking => 
                booking.date.toDateString() === appointment.date.toDateString()
            );
            
            if (!isAlreadyBooked) {
                chef.BookedDates.push({
                    date: appointment.date,
                    bookingId: appointment._id
                });
                await chef.save();
            }
        } else if (status === 'Cancelled' || status === 'Rejected') {
            // Remove from booked dates if it was previously accepted
            chef.BookedDates = chef.BookedDates.filter(booking => 
                booking.bookingId.toString() !== appointment._id.toString()
            );
            await chef.save();
        }

        // Update the appointment status
        appointment.status = status;
        await appointment.save();

        // Get chef and user info for the response
        const chefInfo = await Chef.findById(appointment.chefId);
        const chefUser = await User.findById(chefInfo.ChefID);

        // Format the response according to the Flutter model
        const formattedAppointment = {
            _id: appointment._id,
            chefId: appointment.chefId._id,
            chefInfo: {
                ...chefInfo.toObject(),
                ...chefUser.toObject()
            },
            userId: appointment.userId.toObject(),
            date: appointment.date,
            time: appointment.time,
            selectedCuisines: appointment.selectedCuisines,
            numberOfPersons: appointment.numberOfPersons,
            price: appointment.price,
            comments: appointment.comments,
            status: appointment.status,
            createdAt: appointment.createdAt,
            updatedAt: appointment.updatedAt
        };

        // Get all appointments for the user to maintain the grouped structure
        const allAppointments = await Appointment.find({ userId: appointment.userId._id })
            .populate('userId', 'name email')
            .populate('chefId');

        // Format all appointments
        const formattedAppointments = await Promise.all(allAppointments.map(async (apt) => {
            const chef = await Chef.findById(apt.chefId);
            const chefUser = await User.findById(chef.ChefID);
            return {
                _id: apt._id,
                chefId: apt.chefId._id,
                chefInfo: {
                    ...chef.toObject(),
                    ...chefUser.toObject()
                },
                userId: apt.userId.toObject(),
                date: apt.date,
                time: apt.time,
                selectedCuisines: apt.selectedCuisines,
                numberOfPersons: apt.numberOfPersons,
                price: apt.price,
                comments: apt.comments,
                status: apt.status,
                createdAt: apt.createdAt,
                updatedAt: apt.updatedAt
            };
        }));

        // Group appointments by status
        const grouped = {
            pending: formattedAppointments.filter(a => a.status === 'Pending'),
            accepted: formattedAppointments.filter(a => a.status === 'Accepted'),
            completed: formattedAppointments.filter(a => a.status === 'Completed'),
            cancelled: formattedAppointments.filter(a => a.status === 'Cancelled'),
            rejected: formattedAppointments.filter(a => a.status === 'Rejected')
        };

        // Calculate stats
        const stats = {
            pending: grouped.pending.length,
            accepted: grouped.accepted.length,
            completed: grouped.completed.length,
            cancelled: grouped.cancelled.length,
            rejected: grouped.rejected.length
        };

        res.status(200).json({
            appointments: formattedAppointments,
            grouped: grouped,
            total: formattedAppointments.length,
            stats: stats
        });
    } catch (error) {
        console.error('Error updating appointment status:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

module.exports = router;