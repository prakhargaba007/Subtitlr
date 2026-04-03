const mongoose = require("mongoose");

const DeviceTokenSchema = new mongoose.Schema(
  {
    expoPushToken: {
      type: String,
      required: true,
      unique: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null, // null = guest user
    },
    isNewUser: {
      type: Boolean,
      default: true,
    },
    isLoggedIn: {
      type: Boolean,
      default: false,
    },
    deviceInfo: {
      type: Object, // Example: { platform: 'iOS', osVersion: '16.5', model: 'iPhone 14', appVersion: '1.2.3', deviceName: 'John\'s iPhone' }
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("DeviceToken", DeviceTokenSchema);
