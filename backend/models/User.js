const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const UserSchema = new Schema(
  {
    name: {
      type: String,
    },
    email: {
      type: String,
      required: false, // Not required for temp users
    },
    phoneNumber: {
      type: Number,
      required: false, // Not required for temp users
    },
    tempUser: {
      type: Boolean,
      default: false,
    },
    gender: {
      type: String,
      enum: ["male", "female", "other", "prefer-not-to-say"],
      default: "prefer-not-to-say",
    },
    dateOfBirth: {
      type: Date,
    },
    userName: {
      type: String,
      set: (v) => v.toUpperCase(),
    },
    password: {
      type: String,
    },
    language: {
      type: String,
      default: "en",
    },
    lastLogin: {
      type: Date,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    hasUpdatedProfile: {
      type: Boolean,
      default: false,
    },
    interests: [String],
    profilePicture: {
      type: String,
    },
    bio: {
      type: String,
    },
    role: {
      type: String,
      enum: ["customer", "admin", "sub-admin"],
      default: "customer",
    },
    accessPermissions: {
      type: Array,
      default: [],
      // This will store navigation keys that the sub-admin has access to
      // e.g., ["dashboard", "categories", "notifications"]
    },
    credits: {
      type: Number,
      default: 0,
      min: 0,
    },
    /** Reserved for future org / team billing (null = none). */
    organizationId: {
      type: Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    /** Master record of the SINGLE definitively active subscription. */
    activeSubscriptionId: {
      type: Schema.Types.ObjectId,
      ref: "UserSubscription",
      default: null,
    },
    /** Manually flagged enterprise / custom billing (contact sales). */
    enterpriseManual: {
      type: Boolean,
      default: false,
    },
    preferences: {
      emailNotifications: {
        type: Boolean,
        default: true,
      },
      pushNotifications: {
        type: Boolean,
        default: true,
      },
      darkMode: {
        type: Boolean,
        default: false,
      },
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("User", UserSchema);
