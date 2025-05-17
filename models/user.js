const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: {
    require: true,
    type: String,
    trim: true,
  },
  email: {
    required: true,
    type: String,
    trim: true,
    validate: {
      validator: function (v) {
        const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@(([^<>()[\]\\.,;:\s@"]+\.)+[^<>()[\]\\.,;:\s@"]{2,})$/i;
        return re.test(v);
      },
      message: "Invalid Email",
    },
  },
  password: {
    require: true,
    type: String,
  },
  address: {
    type: String,
    default: "",
  },
  type: {
    type: String,
    default: "user",
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  profileImage: {
    type: String,
    default: "https://www.gravatar.com/avatar/205e460b479e2e5b48aec07710c08d50?s=200"
  },

  // Bio: {
  //   type: String,
  //   validate: {
  //     validator: function (v) {
  //       return this.type !== 'chef' || (this.type === 'chef' && v != null);
  //     },
  //     message: "BIO is required",
  //   },
  // },
  // Experiece: {
  //   type: String,
  //   validate: {
  //     validator: function (v) {
  //       return this.type !== 'chef' || (this.type === 'chef' && v != null);
  //     },
  //     message: "Experience is required for chefs",
  //   },
  // },
  // Experiece: {
  //   type: String,
  //   validate: {
  //     validator: function (v) {
  //       return this.type !== 'chef' || (this.type === 'chef' && v != null);
  //     },
  //     message: "Experience is required for chefs",
  //   },
  // },
  // Add more fields as needed
});

const User = mongoose.model("User", userSchema);
module.exports = User;