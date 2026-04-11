/**
 * Central env-driven knobs for the dubbing pipeline.
 */

const truthy = (v) => String(v || "").trim() === "1" || String(v || "").toLowerCase() === "true";

/** Max speed-up factor in timing sync (1.0 = never speed up). Default 1.5. */
const getDubbingMaxAtempo = () => {
  const n = Number(process.env.DUBBING_MAX_ATEMPO);
  if (Number.isFinite(n) && n >= 0.5 && n <= 2.0) return n;
  return 1.5;
};

/** When target language matches, use this max atempo if DUBBING_MAX_ATEMPO_HI is set. */
const getDubbingMaxAtempoForHindiTargets = () => {
  const raw = process.env.DUBBING_MAX_ATEMPO_HI;
  if (raw === undefined || raw === "") return null;
  const n = Number(raw);
  if (Number.isFinite(n) && n >= 0.5 && n <= 2.0) return n;
  return null;
};

const isHindiLikeTarget = (lang) => {
  const k = String(lang || "")
    .toLowerCase()
    .trim();
  return k === "hindi" || k === "hi" || k === "hinglish";
};

/** Resolve max atempo for a given target language label. */
const resolveMaxAtempo = (targetLanguage) => {
  const hiCap = getDubbingMaxAtempoForHindiTargets();
  if (hiCap != null && isHindiLikeTarget(targetLanguage)) return hiCap;
  return getDubbingMaxAtempo();
};

/**
 * When enabled, shift all segment times if ffmpeg silencedetect onset on the vocals stem
 * disagrees with the model’s first segment (legacy GPT-audio workaround).
 * Gemini timings match the standalone script better with this OFF (default).
 * Set DUBBING_TIMELINE_CALIBRATE_ON=1 to enable.
 */
const isDubbingTimelineCalibrateEnabled = () => truthy(process.env.DUBBING_TIMELINE_CALIBRATE_ON);

/** silencedetect noise threshold (dB), default -35 */
const getDubbingTimelineSilenceNoiseDb = () => {
  const n = Number(process.env.DUBBING_TIMELINE_SILENCE_NOISE_DB);
  if (Number.isFinite(n) && n <= -10 && n >= -80) return n;
  return -35;
};

/** Minimum silence duration (sec) for silencedetect, default 0.35 */
const getDubbingTimelineSilenceMinSec = () => {
  const n = Number(process.env.DUBBING_TIMELINE_SILENCE_MIN_SEC);
  if (Number.isFinite(n) && n >= 0.1 && n <= 3) return n;
  return 0.35;
};

/**
 * True when user wants Silero VAD at all (Python stack available).
 * Refining Gemini transcripts with VAD often drops early/overlapping speech — see
 * `isDubbingSileroRefineAfterGeminiEnabled` for the actual dubbing post-step.
 */
const isDubbingSileroVadEnabled = () =>
  truthy(process.env.VAD_ENABLE) || truthy(process.env.DUBBING_USE_SILERO_VAD);

/**
 * Actually run Silero timeline + refineSegmentsWithVadTimeline after Gemini dubbing ASR.
 * Requires isDubbingSileroVadEnabled() AND this flag — avoids stripping the opening line
 * when VAD speech windows don’t align with Gemini’s timestamps.
 */
const isDubbingSileroRefineAfterGeminiEnabled = () =>
  isDubbingSileroVadEnabled() && truthy(process.env.DUBBING_SILERO_REFINE_AFTER_GEMINI);

/** Min fraction of segment duration overlapping VAD speech; uses subtitle env as fallback. */
const getDubbingVadMinSpeechOverlap = () => {
  const d = Number(process.env.DUBBING_VAD_MIN_SPEECH_OVERLAP);
  if (Number.isFinite(d) && d >= 0 && d <= 1) return d;
  const s = Number(process.env.SUBTITLE_VAD_MIN_SPEECH_OVERLAP);
  if (Number.isFinite(s) && s >= 0 && s <= 1) return s;
  return 0.35;
};

/** Call Inworld STT with voice profile per segment (extra cost). */
const isInworldVoiceProfileEnabled = () => truthy(process.env.DUBBING_INWORLD_STT_VOICE_PROFILE);

/** Max segments to run Inworld voice profile on (0 = all). */
const inworldVoiceProfileMaxSegments = () => {
  const n = parseInt(process.env.DUBBING_INWORLD_STT_VOICE_PROFILE_MAX_SEGMENTS || "0", 10);
  return Number.isFinite(n) && n > 0 ? n : Infinity;
};

/**
 * Allowed bracket tags for Inworld TTS (emotion, delivery, non-verbal).
 * Empty env = use default set; set to "off" to disable injection from profile hints.
 */
const getTtsBracketTagAllowlist = () => {
  const raw = String(process.env.DUBBING_TTS_BRACKET_ALLOWLIST || "").trim();
  if (raw.toLowerCase() === "off") return [];
  if (!raw) {
    return [
      "[happy]",
      "[sad]",
      "[angry]",
      "[surprised]",
      "[fearful]",
      "[disgusted]",
      "[laughing]",
      "[whispering]",
      "[breathe]",
      "[clear_throat]",
      "[cough]",
      "[laugh]",
      "[sigh]",
      "[yawn]",
    ];
  }
  return raw.split(/[\s,]+/).filter(Boolean);
};

/** Inworld applyTextNormalization: ON | OFF | unspecified */
const getInworldApplyTextNormalization = () => {
  const v = String(process.env.INWORLD_APPLY_TEXT_NORMALIZATION || "").trim().toUpperCase();
  if (v === "ON" || v === "OFF") return v;
  return null;
};

module.exports = {
  getDubbingMaxAtempo,
  getDubbingMaxAtempoForHindiTargets,
  isHindiLikeTarget,
  resolveMaxAtempo,
  isDubbingTimelineCalibrateEnabled,
  getDubbingTimelineSilenceNoiseDb,
  getDubbingTimelineSilenceMinSec,
  isDubbingSileroVadEnabled,
  isDubbingSileroRefineAfterGeminiEnabled,
  getDubbingVadMinSpeechOverlap,
  isInworldVoiceProfileEnabled,
  inworldVoiceProfileMaxSegments,
  getTtsBracketTagAllowlist,
  getInworldApplyTextNormalization,
};
