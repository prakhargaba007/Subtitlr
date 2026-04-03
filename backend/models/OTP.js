const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const OTPSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    otp: {
      type: String,
      required: true,
    },
    purpose: {
      type: String,
      enum: ["password_reset", "email_verification", "account_verification"],
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 10 * 60 * 1000), // 10 minutes from now
    },
    isUsed: {
      type: Boolean,
      default: false,
    },
    attempts: {
      type: Number,
      default: 0,
      max: 3, // Maximum 3 verification attempts
    },
  },
  {
    timestamps: true,
  }
);

// Auto-delete expired OTPs
OTPSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Compound index for efficient querying
OTPSchema.index({ email: 1, purpose: 1, isUsed: 1 });

module.exports = mongoose.model("OTP", OTPSchema);
