const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const FileSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
    },
    originalName: {
      type: String,
      required: true,
    },
    fileName: {
      type: String,
      required: true,
      unique: true,
    },
    filePath: {
      type: String,
      required: true,
    },
    fileSize: {
      type: Number,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    // uploadType: {
    //   type: String,
    //   required: true,
    //   enum: ["profiles", "courses", "lessons", "general"],
    //   default: "general",
    // },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false, // Allow anonymous uploads for image orders
    },
    // referenceCount: {
    //   type: Number,
    //   default: 1,
    // },
    // references: [
    //   {
    //     model: {
    //       type: String,
    //       required: true,
    //       enum: ["User", "Course", "Lesson", "Module", "Quiz", "Video"],
    //     },
    //     documentId: {
    //       type: Schema.Types.ObjectId,
    //       required: true,
    //     },
    //     field: {
    //       type: String,
    //       required: true,
    //     },
    //     referencedAt: {
    //       type: Date,
    //       default: Date.now,
    //     },
    //   },
    // ],
    isActive: {
      type: Boolean,
      default: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
FileSchema.index({ uploadType: 1, isActive: 1 });
FileSchema.index({ uploadedBy: 1 });
FileSchema.index({ fileName: 1 });

module.exports = mongoose.model("File", FileSchema);
