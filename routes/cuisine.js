const express = require('express');

const router = express.Router();
const chefM = require('../middleware/chef');
const Cuisine = require('../models/cuisine');
const Chef = require('../models/chef');
const mongoose = require('mongoose');






// POST route to save cuisine data
router.post('/api/addCuisine',chefM, async (req, res) => {
    try {
        
        const { CuisineType } = req.body;
        const chef = await Chef.findOne({ ChefID: req.user });

        const newCuisine = new Cuisine({
            ChefId: chef.ChefID,
            DishID: new mongoose.Types.ObjectId(), // Ensure DishID is unique
            ...req.body,
        });

        if (!chef.Specialties.includes(req.body.CuisineType)) {
            chef.Specialties.push(req.body.CuisineType);

            await chef.save();
        }
        const savedCuisine = await newCuisine.save();
        res.status(201).json(chef);
    } catch (error) {
        console.error('Error details:', error, req.user._id);
        res.status(400).json({ message: error.message });
    }
});

router.put('/api/updateCuisine/:id', chefM, async (req, res) => {
    try {
        const { id } = req.params;
        const { CuisineType } = req.body;
        const chef = await Chef.findOne({ ChefID: req.user });

        // Find and update the cuisine
        const updatedCuisine = await Cuisine.findOneAndUpdate(
            { _id: id, ChefId: chef.ChefID },
            { ...req.body },
            { new: true }
        );

        if (!updatedCuisine) {
            return res.status(404).json({ message: 'Cuisine not found' });
        }

        // Update chef's specialties if needed
        if (!chef.Specialties.includes(CuisineType)) {
            chef.Specialties.push(CuisineType);
            await chef.save();
        }

        res.status(200).json(updatedCuisine);
    } catch (error) {
        console.error('Error updating cuisine:', error);
        res.status(400).json({ message: error.message });
    }
});


module.exports = router;
