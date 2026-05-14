const fs = require("fs");
const path = require("path");
const axios = require("axios");
const FormData = require("form-data");
const { SARVAM_BCP47_MAP } = require("./languageCatalog");

/** Sarvam instant voice clone (multipart). Override with SARVAM_VOICE_CLONE_CREATE_URL if it changes. */
const DEFAULT_SARVAM_VOICE_CLONE_CREATE_URL =
  "https://api.sarvam.ai/speech-to-text/voice-clone";

const norm = (value) => String(value || "").trim();
const normLower = (value) => norm(value).toLowerCase();

const isTruthy = (value) => {
  const v = normLower(value);
  return v === "1" || v === "true" || v === "yes" || v === "on";
};

const getSarvamCloneFailureMode = () => {
  const mode = normLower(process.env.SARVAM_CLONE_FAILURE_MODE || "fallback");
  return mode === "strict" ? "strict" : "fallback";
};

const SARVAM_LANGUAGE_ALIASES = {
  en: "english",
  "en-in": "english",
  hi: "hindi",
  "hi-in": "hindi",
  bn: "bengali",
  "bn-in": "bengali",
  ta: "tamil",
  "ta-in": "tamil",
  te: "telugu",
  "te-in": "telugu",
  kn: "kannada",
  "kn-in": "kannada",
  ml: "malayalam",
  "ml-in": "malayalam",
  mr: "marathi",
  "mr-in": "marathi",
  gu: "gujarati",
  "gu-in": "gujarati",
  pa: "punjabi",
  "pa-in": "punjabi",
  od: "odia",
  or: "odia",
  "od-in": "odia",
  oriya: "odia",
};

const resolveSarvamLanguageCode = (targetLanguage) => {
  const key = normLower(targetLanguage);
  if (!key) return "";
  if (SARVAM_BCP47_MAP[key]) return SARVAM_BCP47_MAP[key];
  const alias = SARVAM_LANGUAGE_ALIASES[key];
  if (alias && SARVAM_BCP47_MAP[alias]) return SARVAM_BCP47_MAP[alias];
  return targetLanguage;
};

const getSarvamVoiceCloneCreateUrl = () =>
  norm(process.env.SARVAM_VOICE_CLONE_CREATE_URL) ||
  DEFAULT_SARVAM_VOICE_CLONE_CREATE_URL;

/** @returns {string[]} env names / hints still needed for clone create */
const sarvamVoiceCloneConfigMissing = () => {
  const missing = [];
  if (!norm(process.env.SARVAM_API_KEY)) missing.push("SARVAM_API_KEY");
  if (!isTruthy(process.env.SARVAM_CLONE_ENABLED)) {
    missing.push("SARVAM_CLONE_ENABLED (true|1|yes|on)");
  }
  return missing;
};

const isSarvamVoiceCloneConfigured = () =>
  sarvamVoiceCloneConfigMissing().length === 0;

const pickNested = (obj, dottedPath) => {
  if (!obj || !dottedPath) return undefined;
  return dottedPath
    .split(".")
    .reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
};

const extractCloneVoiceId = (data) => {
  const configuredKeys = norm(process.env.SARVAM_VOICE_CLONE_ID_KEYS)
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  const keys = configuredKeys.length
    ? configuredKeys
    : [
        "voice_id",
        "voiceId",
        "speaker",
        "speaker_id",
        "id",
        "data.voice_id",
        "data.voiceId",
        "data.speaker",
        "data.id",
      ];

  for (const key of keys) {
    const value = pickNested(data, key);
    if (value) return String(value).trim();
  }
  return "";
};

const buildAuthHeaders = () => ({
  "api-subscription-key": process.env.SARVAM_API_KEY,
});

const createSarvamVoiceClone = async ({
  speakerId,
  samplePath,
  targetLanguage,
  jobId,
}) => {
  if (!isSarvamVoiceCloneConfigured()) {
    throw new Error(
      "Sarvam voice cloning is not configured. Set SARVAM_API_KEY and SARVAM_CLONE_ENABLED=true.",
    );
  }
  if (!samplePath || !fs.existsSync(samplePath)) {
    throw new Error(`Voice clone sample missing for ${speakerId}.`);
  }

  const createUrl = getSarvamVoiceCloneCreateUrl();
  console.log(
    "[sarvam clone] create",
    { speakerId, jobId, targetLanguage, samplePath, createUrl },
  );

  console.log("[sarvam clone] Preparing FormData for voice clone request...");

  const form = new FormData();
  const fileField = norm(process.env.SARVAM_VOICE_CLONE_FILE_FIELD) || "file";
  const nameField = norm(process.env.SARVAM_VOICE_CLONE_NAME_FIELD) || "name";
  const languageField =
    norm(process.env.SARVAM_VOICE_CLONE_LANGUAGE_FIELD) ||
    "target_language_code";

  const name = `dub_${jobId || "job"}_${speakerId}_${Date.now()}`;

  console.log(
    `[sarvam clone] Appending file field: '${fileField}', path: '${samplePath}', filename: '${path.basename(samplePath)}'`
  );
  form.append(fileField, fs.createReadStream(samplePath), {
    filename: path.basename(samplePath),
  });

  console.log(`[sarvam clone] Appending name field: '${nameField}' = '${name}'`);
  form.append(nameField, name);

  if (targetLanguage) {
    const resolvedLang = resolveSarvamLanguageCode(targetLanguage);
    console.log(`[sarvam clone] Appending language field: '${languageField}' = '${resolvedLang}'`);
    form.append(languageField, resolvedLang);
  }

  const extraRaw = norm(process.env.SARVAM_VOICE_CLONE_EXTRA_FIELDS_JSON);
  if (extraRaw) {
    try {
      const extra = JSON.parse(extraRaw);
      console.log("[sarvam clone] Appending extra fields from SARVAM_VOICE_CLONE_EXTRA_FIELDS_JSON:", extra);
      for (const [key, value] of Object.entries(extra || {})) {
        if (value !== undefined && value !== null) {
          console.log(`[sarvam clone] Appending extra field: '${key}' = '${String(value)}'`);
          form.append(key, String(value));
        }
      }
    } catch (err) {
      console.error("[sarvam clone] Invalid SARVAM_VOICE_CLONE_EXTRA_FIELDS_JSON:", extraRaw);
      throw new Error(
        `SARVAM_VOICE_CLONE_EXTRA_FIELDS_JSON is invalid JSON: ${err.message}`,
      );
    }
  }

  const response = await axios.post(
    createUrl,
    form,
    {
      headers: {
        ...buildAuthHeaders(),
        ...form.getHeaders(),
      },
      maxBodyLength: Infinity,
    },
  );

  const cloneVoiceId = extractCloneVoiceId(response.data);
  if (!cloneVoiceId) {
    throw new Error("Sarvam clone response did not include a voice id.");
  }

  console.log("[sarvam clone] created voiceId:", cloneVoiceId);

  return {
    voiceId: cloneVoiceId,
    raw: response.data,
  };
};

const interpolateDeleteUrl = (voiceId) => {
  const base = norm(process.env.SARVAM_VOICE_CLONE_DELETE_URL);
  if (!base) return "";
  const encoded = encodeURIComponent(voiceId);
  if (base.includes("{voice_id}") || base.includes("{voiceId}")) {
    return base.replace(/\{voice_id\}|\{voiceId\}/g, encoded);
  }
  return `${base.replace(/\/+$/, "")}/${encoded}`;
};

const deleteSarvamVoiceClone = async (voiceId) => {
  const id = norm(voiceId);
  if (!id) {
    console.log("[sarvam clone] delete skipped: missing_voice_id");
    return { skipped: true, reason: "missing_voice_id" };
  }

  const url = interpolateDeleteUrl(id);
  if (!url) {
    console.log("[sarvam clone] delete skipped:", id, "missing_delete_url");
    return { skipped: true, reason: "missing_delete_url" };
  }

  await axios.delete(url, { headers: buildAuthHeaders() });
  console.log("[sarvam clone] deleted", id);
  return { deleted: true };
};

module.exports = {
  isSarvamVoiceCloneConfigured,
  sarvamVoiceCloneConfigMissing,
  getSarvamVoiceCloneCreateUrl,
  createSarvamVoiceClone,
  deleteSarvamVoiceClone,
  getSarvamCloneFailureMode,
};
