const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const dishSchema = new Schema({
    ChefId:{
        type: Schema.Types.ObjectId,
        ref: 'Chef',
        required: true
    },
    DishID: {
        type: Schema.Types.ObjectId,
        required: true
    },
    CuisineType: {
        type: String,
        required: true
    },
    Name: {
        type: String,
        required: true
    },
    Ingredients: {
        type: [String],
        required: true
    },
    Price: {
        type: Number,
        required: true
    },
    ImageURL: {
        type: String,
        required: true
    },
    Description: {
        type: String,
        required: true
    }
});

const Dish = mongoose.model('Dish', dishSchema);

module.exports = Dish;