const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const SegmentSchema = new Schema(
  {
    start: { type: Number, required: true },
    end: { type: Number, required: true },
    text: { type: String, required: true },
  },
  { _id: false }
);

const SubtitleJobSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    originalFileName: {
      type: String,
      required: true,
    },
    fileType: {
      type: String,
      enum: ["audio", "video"],
      required: true,
    },
    duration: {
      type: Number,
      required: true,
    },
    creditsUsed: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["processing", "completed", "failed"],
      default: "processing",
    },
    language: {
      type: String,
      default: "auto",
    },
    transcription: {
      type: String,
      default: "",
    },
    segments: {
      type: [SegmentSchema],
      default: [],
    },
    /** S3 object key for the original uploaded file, e.g. "subtitles/userId/uuid.mp4" */
    originalFileKey: {
      type: String,
      default: null,
    },
    /** Public or pre-signed URL to retrieve the original file from S3 */
    originalFileUrl: {
      type: String,
      default: null,
    },
    errorMessage: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("SubtitleJob", SubtitleJobSchema);
