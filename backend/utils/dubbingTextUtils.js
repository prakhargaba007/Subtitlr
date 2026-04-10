const { getTtsBracketTagAllowlist } = require("./dubbingConfig");

const norm = (s) => String(s || "").toLowerCase().trim();

const bracketToken = (tag) => {
  const t = String(tag || "").trim().toLowerCase();
  if (t.startsWith("[") && t.endsWith("]")) return t.slice(1, -1);
  return t;
};

/** Inworld experimental bracket tags (English-oriented). */
const BRACKET_TAG_RE =
  /\[(happy|sad|angry|surprised|fearful|disgusted|laughing|whispering|breathe|clear_throat|cough|laugh|sigh|yawn)\]/gi;

const stripExperimentalInworldTags = (text) => {
  if (!text || typeof text !== "string") return "";
  return text
    .replace(BRACKET_TAG_RE, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
};

const isEnglishLikeTarget = (targetLanguage) => {
  const t = norm(targetLanguage);
  return t === "english" || t === "en";
};

/**
 * Plain text for OpenAI / ElevenLabs / Smallest (no bracket tags).
 */
const textForNonInworldTts = (text) => stripExperimentalInworldTags(text);

/**
 * Inworld TTS input: keep brackets only for English-like targets, gated by {@link getTtsBracketTagAllowlist}.
 */
const textForInworldTts = (text, targetLanguage) => {
  if (!isEnglishLikeTarget(targetLanguage)) return stripExperimentalInworldTags(text);
  const allow = getTtsBracketTagAllowlist();
  if (!allow.length) return stripExperimentalInworldTags(text);
  const allowSet = new Set(allow.map(bracketToken));
  return text
    .replace(BRACKET_TAG_RE, (match) => {
      const inner = match.slice(1, -1).toLowerCase();
      return allowSet.has(inner) ? match : " ";
    })
    .replace(/\s{2,}/g, " ")
    .trim();
};

module.exports = {
  stripExperimentalInworldTags,
  isEnglishLikeTarget,
  textForNonInworldTts,
  textForInworldTts,
  BRACKET_TAG_RE,
};
