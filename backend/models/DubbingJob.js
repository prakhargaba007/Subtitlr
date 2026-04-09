const mongoose = require("mongoose");

const segmentSchema = new mongoose.Schema(
  {
    // Stable id used by editor UI for updates/regenerations
    segmentId: { type: String, default: null },
    // Incremented on each edit/regenerate
    revision: { type: Number, default: 0 },
    start: { type: Number, required: true },
    end: { type: Number, required: true },
    speaker_id: { type: String, required: true },
    originalText: { type: String, default: "" },
    translatedText: { type: String, default: "" },
    dubbedAudioKey: { type: String, default: null },
    timingStrategy: {
      type: String,
      enum: ["padded", "stretched", "stretched_capped"],
      default: null,
    },
  },
  { _id: false }
);

const speakerProfileSchema = new mongoose.Schema(
  {
    speaker_id: { type: String, required: true },
    voice_description: { type: String, default: "" },
    // voice key for TTS: ElevenLabs id | OpenAI voice name | Inworld voiceId (preset or cloned)
    elevenlabs_voice_id: { type: String, default: null },
  },
  { _id: false }
);

const dubbingJobSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    originalFileName: { type: String, required: true },
    fileType: { type: String, enum: ["video", "audio"], required: true },
    sourceLanguage: { type: String, default: "auto" },
    targetLanguage: { type: String, required: true },
    status: {
      type: String,
      enum: [
        "pending",
        "extracting",
        "separating",
        "transcribing",
        "translating",
        "generating",
        "syncing",
        "merging",
        "completed",
        "failed",
      ],
      default: "pending",
      index: true,
    },
    // S3 keys for intermediate and final assets
    originalVideoKey: { type: String, default: null },
    originalAudioKey: { type: String, default: null },
    vocalsKey: { type: String, default: null },
    backgroundKey: { type: String, default: null },
    dubbedAudioKey: { type: String, default: null },
    dubbedVideoKey: { type: String, default: null },
    // Public URLs for the final outputs
    dubbedVideoUrl: { type: String, default: null },
    dubbedAudioUrl: { type: String, default: null },
    /** Server path to folder with local copies of all dubbing artifacts (see dubbingOutputUtils) */
    localOutputPath: { type: String, default: null },
    // Processing metadata
    duration: { type: Number, default: 0 },
    creditsUsed: { type: Number, default: 0 },
    separationMethod: {
      type: String,
      enum: ["replicate", "elevenlabs_fallback", "no_separation", null],
      default: null,
    },
    ttsProvider: {
      type: String,
      enum: ["openai", "elevenlabs", "inworld", "smallest", null],
      default: null,
    },
    // Transcription + dubbing data
    segments: { type: [segmentSchema], default: [] },
    speakerProfiles: { type: [speakerProfileSchema], default: [] },
    // Error details if job failed
    error: { type: String, default: null },
  },
  { timestamps: true }
);

// Allow clients to poll for status updates efficiently
dubbingJobSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model("DubbingJob", dubbingJobSchema);
