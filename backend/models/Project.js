const mongoose = require("mongoose");
const Schema = mongoose.Schema;

/**
 * Dashboard row: 1:1 with either a SubtitleJob or a DubbingJob.
 * UI metadata (name, pin, archive) lives here; jobs hold pipeline data only.
 */
const projectSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    kind: {
      type: String,
      enum: ["subtitle", "dubbing"],
      required: true,
    },
    /** Only set for kind "subtitle" — never set sibling ref to null (unique index would collide). */
    subtitleJob: {
      type: Schema.Types.ObjectId,
      ref: "SubtitleJob",
    },
    /** Only set for kind "dubbing". */
    dubbingJob: {
      type: Schema.Types.ObjectId,
      ref: "DubbingJob",
    },
    displayName: {
      type: String,
      default: null,
      trim: true,
    },
    jobStatus: {
      type: String,
      enum: ["ready", "processing", "failed"],
      default: "processing",
      index: true,
    },
    jobFileType: {
      type: String,
      enum: ["audio", "video", null],
      default: null,
      index: true,
    },
    /**
     * Lightweight denormalized search document built from Project metadata plus
     * linked job summary fields. Keep large transcript/segment text out of this.
     */
    searchText: {
      type: String,
      default: "",
      index: true,
    },
    searchTokens: {
      type: [String],
      default: [],
      index: true,
    },
    searchTrigrams: {
      type: [String],
      default: [],
      index: true,
    },
    searchUpdatedAt: {
      type: Date,
      default: null,
    },
    pinnedAt: {
      type: Date,
      default: null,
    },
    archivedAt: {
      type: Date,
      default: null,
    },
    /** AI usage metrics and estimated cost for this project. */
    aiUsage: [
      {
        model: { type: String, required: true },
        provider: { type: String, required: true },
        type: {
          type: String,
          enum: ["transcription", "translation_reasoning", "source_separation", "tts"],
          required: true,
        },
        inputTokens: { type: Number, default: 0 },
        outputTokens: { type: Number, default: 0 },
        inputCharacters: { type: Number, default: 0 },
        outputCharacters: { type: Number, default: 0 },
        seconds: { type: Number, default: 0 },
        costUsd: { type: Number, default: 0 },
        meta: { type: Schema.Types.Mixed }, // Tiered pricing or other provider-specific metadata
        createdAt: { type: Date, default: Date.now },
      },
    ],
    totalCostUsd: {
      type: Number,
      default: 0,
      index: true,
    },
  },
  { timestamps: true }
);

projectSchema.pre("validate", function (next) {
  const hasSub = this.subtitleJob != null;
  const hasDub = this.dubbingJob != null;
  if (hasSub === hasDub) {
    const err = new Error("Project must reference exactly one of subtitleJob or dubbingJob.");
    err.statusCode = 422;
    return next(err);
  }
  if (hasSub && this.kind !== "subtitle") {
    const err = new Error('kind must be "subtitle" when subtitleJob is set.');
    err.statusCode = 422;
    return next(err);
  }
  if (hasDub && this.kind !== "dubbing") {
    const err = new Error('kind must be "dubbing" when dubbingJob is set.');
    err.statusCode = 422;
    return next(err);
  }
  next();
});

projectSchema.index({ user: 1, archivedAt: 1, pinnedAt: -1, createdAt: -1 });
projectSchema.index({ user: 1, archivedAt: 1, kind: 1, createdAt: -1 });
projectSchema.index({ user: 1, archivedAt: 1, jobStatus: 1, createdAt: -1 });
projectSchema.index({ user: 1, archivedAt: 1, searchTokens: 1 });
projectSchema.index({ user: 1, archivedAt: 1, searchTrigrams: 1 });
// Partial unique: sparse unique still indexes explicit null — only index real ObjectIds.
projectSchema.index(
  { subtitleJob: 1 },
  {
    unique: true,
    partialFilterExpression: {
      subtitleJob: { $exists: true, $type: "objectId" },
    },
  }
);
projectSchema.index(
  { dubbingJob: 1 },
  {
    unique: true,
    partialFilterExpression: {
      dubbingJob: { $exists: true, $type: "objectId" },
    },
  }
);

module.exports = mongoose.model("Project", projectSchema);
