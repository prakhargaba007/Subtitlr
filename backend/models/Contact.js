const mongoose = require("mongoose");

const ContactSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    trim: true,
  },
  phone: {
    type: String,
    required: true,
    trim: true,
  },
  message: {
    type: String,
    required: true,
  },
  typeOfService: {
    type: [String],
    required: true,
    enum: [
      "photography",
      "videography",
      "branding",
      "website_design",
      "graphic_design",
      "other",
    ],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Validate that either email or phone is provided
ContactSchema.pre("validate", function (next) {
  if (!this.email && !this.phone) {
    this.invalidate("email", "Either email or phone is required");
    this.invalidate("phone", "Either email or phone is required");
  }
  next();
});

module.exports = mongoose.model("Contact", ContactSchema);
