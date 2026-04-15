const mongoose = require("mongoose");

const feedbackSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    type: {
      type: String,
      required: true,
      enum: ["bug", "feature", "general", "praise"],
      default: "general",
    },
    rating: { type: Number, min: 1, max: 5, default: null },
    message: { type: String, required: true, trim: true },
    /** Optional: which page/feature the feedback is about */
    context: { type: String, default: null },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

feedbackSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Feedback", feedbackSchema);
