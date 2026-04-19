const { getTtsBracketTagAllowlist } = require("./dubbingConfig");

const norm = (s) => String(s || "").toLowerCase().trim();

const bracketToken = (tag) => {
  const t = String(tag || "").trim().toLowerCase();
  if (t.startsWith("[") && t.endsWith("]")) return t.slice(1, -1);
  return t;
};

/** Any [...] span (Gemini TTS audio tags, Inworld tags, etc.). */
const BRACKET_SPAN_RE = /\[[^\]]+\]/g;

const normalizeSpacedText = (text) =>
  String(text || "")
    .replace(/\s{2,}/g, " ")
    .trim();

/**
 * Strip all square-bracket performance / TTS tags (Gemini-style, Inworld, etc.).
 */
const stripExperimentalInworldTags = (text) => {
  if (!text || typeof text !== "string") return "";
  return normalizeSpacedText(text.replace(BRACKET_SPAN_RE, " "));
};

const isEnglishLikeTarget = (targetLanguage) => {
  const t = norm(targetLanguage);
  return t === "english" || t === "en";
};

/**
 * Plain text for OpenAI / ElevenLabs / Smallest (no bracket tags).
 */
const textForNonInworldTts = (text) => stripExperimentalInworldTags(text);

/** Gemini Native Audio TTS: keep inline English [audio tags] and dialogue unchanged. */
const textForGeminiTts = (text) => String(text || "").trim();

/**
 * Inworld TTS input: keep brackets only for English-like targets, gated by {@link getTtsBracketTagAllowlist}.
 */
const textForInworldTts = (text, targetLanguage) => {
  if (!isEnglishLikeTarget(targetLanguage)) return stripExperimentalInworldTags(text);
  const allow = getTtsBracketTagAllowlist();
  if (!allow.length) return stripExperimentalInworldTags(text);
  const allowSet = new Set(allow.map(bracketToken));
  return normalizeSpacedText(
    String(text || "").replace(BRACKET_SPAN_RE, (match) => {
      const inner = bracketToken(match);
      return allowSet.has(inner) ? match : " ";
    }),
  );
};

module.exports = {
  stripExperimentalInworldTags,
  isEnglishLikeTarget,
  textForNonInworldTts,
  textForInworldTts,
  textForGeminiTts,
};
