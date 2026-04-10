const fs = require("fs");
const path = require("path");

const VOICES_JSON = path.join(__dirname, "..", "voices", "inworld_voices_last.json");

/**
 * Voices shipped under backend/voices/inworld_voices_last.json (curated Inworld IDs).
 * @returns {Array<{ voiceId: string, displayName: string, langCode: string, description: string, gender: string, source: string }>}
 */
const loadLocalInworldVoices = () => {
  try {
    if (!fs.existsSync(VOICES_JSON)) return [];
    const j = JSON.parse(fs.readFileSync(VOICES_JSON, "utf8"));
    const voices = j.voices || [];
    return voices.map((v) => ({
      voiceId: v.voiceId,
      displayName: v.displayName || "",
      langCode: v.langCode || "",
      description: v.description || "",
      gender: v.gender || "",
      source: v.source || "",
    }));
  } catch (err) {
    console.warn("[localInworldVoices] Failed to read voices JSON:", err.message);
    return [];
  }
};

module.exports = {
  loadLocalInworldVoices,
  LOCAL_INWORLD_VOICES_JSON_PATH: VOICES_JSON,
};
