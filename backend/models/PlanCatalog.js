const mongoose = require("mongoose");
const Schema = mongoose.Schema;

/**
 * Versioned public plans: new buyers bind to current rows; old rows kept for history.
 * dodoProductId must match the subscription product id in Dodo Payments.
 */

// ─── featureFlags sub-schema ──────────────────────────────────────────────────
// Every field is optional so that partial plans are still valid.
// The middleware reads directly from this object (no nested "dubbing" key).

const backgroundMixSchema = new Schema(
  {
    minDb:     { type: Number, default: -24 },
    maxDb:     { type: Number, default: -4 },
    defaultDb: { type: Number, default: -12 },
  },
  { _id: false },
);

const featureFlagsSchema = new Schema(
  {
    // ── Dubbing: core limits ───────────────────────────────────────────────────
    /** Max duration of a single input file in minutes. null = no limit. */
    maxInputMinutes: { type: Number, default: null },

    /** Max file size in MB. null = no limit. */
    maxFileSizeMB: { type: Number, default: null },

    /** Max concurrent active dubbing jobs per user. null = no limit. */
    maxConcurrentJobs: { type: Number, default: null },

    /** Max seconds of dubbing consumed per calendar day (UTC). null = no limit. */
    dailyLimitSeconds: { type: Number, default: null },

    /** Max seconds of dubbing consumed per billing cycle. null = no limit. */
    monthlyLimitSeconds: { type: Number, default: null },

    /** If true, requests past monthlyLimitSeconds are still accepted (overage billing). */
    overageAllowed: { type: Boolean, default: false },

    /** Absolute daily ceiling in seconds — cannot be overridden (anti-abuse). null = no cap. */
    dailySafetyCapSeconds: { type: Number, default: null },

    // ── Dubbing: cost-based safety cap (more precise than seconds) ─────────────
    /** Maximum daily API spend in USD before blocking. null = disabled. */
    dailyCostCapUSD: { type: Number, default: null },

    /** Cost per second of dubbing, in USD. Used with dailyCostCapUSD. */
    ratePerSecondUSD: { type: Number, default: null },

    // ── TTS / voice features ──────────────────────────────────────────────────
    /**
     * Allowed TTS providers for this plan.
     * Possible values: "openai" | "inworld" | "smallest" | "elevenlabs" | "sarvam" | "gemini"
     */
    ttsProviders: {
      type: [String],
      enum: ["openai", "inworld", "smallest", "elevenlabs", "sarvam", "gemini"],
      default: ["openai"],
    },

    /** Whether ElevenLabs library (shared) voices are accessible. */
    allowLibraryVoices: { type: Boolean, default: false },

    /** Whether voice cloning is accessible. */
    allowVoiceCloning: { type: Boolean, default: false },

    // ── Transcription / pipeline features ────────────────────────────────────
    /** Whether multi-speaker diarization is enabled. */
    allowSpeakerDiarization: { type: Boolean, default: true },

    /** Whether vocal/background source separation is performed. */
    allowSourceSeparation: { type: Boolean, default: true },

    /**
     * Which separation methods are available.
     * Possible values: "replicate" | "elevenlabs_fallback" | "no_separation"
     */
    sourceSeparationMethods: {
      type: [String],
      enum: ["replicate", "elevenlabs_fallback", "no_separation"],
      default: ["replicate", "no_separation"],
    },

    // ── Post-processing features ───────────────────────────────────────────────
    /** Whether lip-sync (Wav2Lip) is available. */
    lipSync: { type: Boolean, default: false },

    /** Whether background mix volume control is available. */
    allowBackgroundMixControl: { type: Boolean, default: false },

    /** Background mix volume range and default (dB). */
    backgroundMix: { type: backgroundMixSchema, default: () => ({}) },

    // ── Export & output ────────────────────────────────────────────────────────
    /**
     * Allowed export formats.
     * Possible values: "mp3" | "mp4" | "wav" | "srt" | "vtt"
     */
    exportFormats: {
      type: [String],
      enum: ["mp3", "mp4", "wav", "srt", "vtt"],
      default: ["mp3", "mp4"],
    },

    /** Whether output files carry a platform watermark. */
    watermark: { type: Boolean, default: true },

    /** Number of days output files are retained in storage. null = forever. */
    retentionDays: { type: Number, default: 7 },

    // ── Language support ──────────────────────────────────────────────────────
    /**
     * Allowed target language codes. Empty array = all languages allowed.
     * e.g. ["en", "hi", "es", "fr", "de", "ja", "ko", "pt", "it", "ar"]
     */
    supportedTargetLanguages: { type: [String], default: [] },

    // ── Queue / processing priority ────────────────────────────────────────────
    /**
     * Processing queue priority for this plan.
     * Possible values: "normal" | "high" | "highest"
     */
    queuePriority: {
      type: String,
      enum: ["normal", "high", "highest"],
      default: "normal",
    },

    // ── UI / display ──────────────────────────────────────────────────────────
    /** UI badge labels shown on the plan card. e.g. ["best_value", "popular"] */
    uiBadges: { type: [String], default: [] },

    /** Support tier label for display. e.g. "email" | "priority" | "priority_plus" */
    supportLevel: { type: String, default: "email" },
  },
  { _id: false },
);

// ─── Main plan schema ─────────────────────────────────────────────────────────

const planCatalogSchema = new Schema(
  {
    key: { type: String, required: true, index: true },
    displayName: { type: String, required: true },
    /** Display-only (source of truth for actual charge is Dodo product pricing). */
    priceDisplay: { type: String, default: "" },
    /** Display-only (e.g. "20% off" or "$5 off"). */
    discountDisplay: { type: String, default: "" },
    /** Numeric original price in USD before discount (e.g. 108). Stored for display purposes. */
    originalPrice: { type: Number, default: null },
    interval: {
      type: String,
      enum: ["monthly", "annual", "one_time"],
      required: true,
    },
    dodoProductId: { type: String, required: true, index: true },
    creditsPerPeriod: { type: Number, required: true, min: 0 },
    version: { type: Number, default: 1, min: 1 },
    isActivePublic: { type: Boolean, default: true, index: true },
    featureFlags: { type: featureFlagsSchema, default: () => ({}) },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

planCatalogSchema.index({ key: 1, version: 1 }, { unique: true });

module.exports = mongoose.model("PlanCatalog", planCatalogSchema);
