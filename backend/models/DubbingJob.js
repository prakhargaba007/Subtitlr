const mongoose = require("mongoose");

const classLabelSchema = new mongoose.Schema(
  {
    label: { type: String, default: "" },
    confidence: { type: Number, default: 0 },
  },
  { _id: false }
);

const subSegmentSchema = new mongoose.Schema(
  {
    relStart: { type: Number, default: 0 },
    relEnd: { type: Number, default: 1 },
    translatedText: { type: String, default: "" },
    timingStrategy: {
      type: String,
      enum: ["padded", "stretched", "stretched_slow", "stretched_capped"],
      default: null,
    },
    ttsWordTimestamps: {
      type: [
        {
          word: { type: String, default: "" },
          startTimeMs: { type: Number, default: 0 },
          endTimeMs: { type: Number, default: 0 },
        },
      ],
      default: undefined,
    },
  },
  { _id: false }
);

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
      enum: ["padded", "stretched", "stretched_slow", "stretched_capped"],
      default: null,
    },
    /** Optional split of one source timing window into multiple TTS lines (e.g. Hindi → English). */
    subSegments: { type: [subSegmentSchema], default: [] },
    /** Inworld STT voice profile (or similar) for this segment time range. */
    voiceProfile: {
      age: { type: [classLabelSchema], default: undefined },
      emotion: { type: [classLabelSchema], default: undefined },
      pitch: { type: [classLabelSchema], default: undefined },
      vocalStyle: { type: [classLabelSchema], default: undefined },
      accent: { type: [classLabelSchema], default: undefined },
      source: { type: String, default: null },
    },
    /** Word-level timings from last Inworld TTS (whole-segment synthesis). */
    ttsWordTimestamps: {
      type: [
        {
          word: { type: String, default: "" },
          startTimeMs: { type: Number, default: 0 },
          endTimeMs: { type: Number, default: 0 },
        },
      ],
      default: undefined,
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
    /**
     * Client-supplied idempotency key. If a request arrives with the same key
     * as an existing job for this user, the existing job is returned immediately
     * without creating a new job or reserving usage again.
     */
    idempotencyKey: { type: String, default: null, index: true },
    /** Seconds reserved against the user quota when the job was accepted. */
    reservedSeconds: { type: Number, default: 0 },
    /**
     * Actual seconds of content processed before the job completed or failed.
     * Set by the controller at the end of the pipeline. Used for partial refunds:
     *   refund = reservedSeconds - processedSeconds
     */
    processedSeconds: { type: Number, default: null },
    /** UTC timestamp when the job transitioned from pending → active processing. */
    processingStartedAt: { type: Date, default: null },
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
    // Thumbnail for quick grid previews (video uploads only)
    thumbnailKey: { type: String, default: null },
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
      enum: ["openai", "elevenlabs", "inworld", "smallest", "sarvam", "gemini", null],
      default: null,
    },
    // Transcription + dubbing data
    segments: { type: [segmentSchema], default: [] },
    speakerProfiles: { type: [speakerProfileSchema], default: [] },
    completionEmailSentAt: { type: Date, default: null },
    // Error details if job failed
    error: { type: String, default: null },
  },
  { timestamps: true }
);

// Allow clients to poll for status updates efficiently
dubbingJobSchema.index({ user: 1, createdAt: -1 });
// Idempotency: enforce uniqueness of (user, idempotencyKey) for non-null keys.
// sparse: true means documents without idempotencyKey are excluded from the index.
dubbingJobSchema.index({ user: 1, idempotencyKey: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("DubbingJob", dubbingJobSchema);
