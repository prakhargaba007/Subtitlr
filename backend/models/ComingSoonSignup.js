const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const ComingSoonSignupSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    pageKey: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    source: {
      type: String,
      default: null,
      trim: true,
    },
    meta: {
      ip: { type: String, default: null },
      userAgent: { type: String, default: null },
      referrer: { type: String, default: null },
    },
  },
  {
    timestamps: true,
  }
);

// Same email can sign up for multiple pages, but not duplicate for the same page.
ComingSoonSignupSchema.index({ email: 1, pageKey: 1 }, { unique: true });

module.exports = mongoose.model("ComingSoonSignup", ComingSoonSignupSchema);

