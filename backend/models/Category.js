const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const LessonCategorySchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
    imageUrl: {
      type: String,
    },
    iconUrl: {
      type: String,
    },
    type: {
      type: String,
      enum: ["photo&video"],
      default: "photo&video",
    },
    color: {
      type: String,
      default: "#3498db",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    order: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("LessonCategory", LessonCategorySchema);
