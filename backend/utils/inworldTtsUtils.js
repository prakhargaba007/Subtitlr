const fs = require("fs");
const path = require("path");
const os = require("os");
const { v4: uuidv4 } = require("uuid");
const OpenAI = require("openai");
const { getFileDuration } = require("./audioUtils");

/**
 * Static fallback when list-voices API is unavailable. Full catalog at runtime:
 * `fetchInworldVoiceCatalog()` → GET https://api.inworld.ai/tts/v1/voices
 */
const INWORLD_PRESET_VOICES = require("./data/inworldVoices.json");

/**
 * Inworld API credentials — NEVER commit real values; use .env only.
 *
 * INWORLD_API_KEY supports two formats:
 * - Raw Base64 string (no ":") — used as-is after "Basic " (dashboard copy-paste).
 * - clientId:clientSecret — Base64-encoded at runtime for Basic auth.
 */
const buildInworldAuthorizationHeader = () => {
  const raw = String(process.env.INWORLD_API_KEY || "").trim();
  if (!raw) return null;
  if (raw.includes(":")) {
    return `Basic ${Buffer.from(raw, "utf8").toString("base64")}`;
  }
  return `Basic ${raw}`;
};

const isInworldConfigured = () => Boolean(buildInworldAuthorizationHeader());

let _openai = null;
const getOpenAI = () => {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
};

const INWORLD_TTS_URL = (process.env.INWORLD_TTS_URL || "https://api.inworld.ai/tts/v1/voice").trim();
const INWORLD_INPUT_MAX = 4096;

const INWORLD_VOICE_IDS = INWORLD_PRESET_VOICES.map((v) => v.voiceId);

const getDefaultInworldVoice = () =>
  String(process.env.INWORLD_DEFAULT_VOICE || "Jason").trim() || "Jason";

/**
 * If set, every speaker uses this voiceId (e.g. a Voice Cloning API id). Skips GPT matching.
 */
const getForcedInworldVoiceId = () => String(process.env.INWORLD_FORCE_VOICE_ID || "").trim();

/**
 * Fetches all built-in TTS voices from Inworld (same auth as synthesize).
 * Falls back to {@link INWORLD_PRESET_VOICES} on error or missing key.
 *
 * Env:
 * - INWORLD_VOICES_LIST_URL — default https://api.inworld.ai/tts/v1/voices
 * - INWORLD_VOICES_FILTER — default language=en; set INWORLD_VOICES_NO_FILTER=1 to omit filter (all languages)
 */
const fetchInworldVoiceCatalog = async () => {
  const clonePresets = () => INWORLD_PRESET_VOICES.map((v) => ({ ...v }));

  const auth = buildInworldAuthorizationHeader();
  if (!auth) return clonePresets();

  const base = String(
    process.env.INWORLD_VOICES_LIST_URL || "https://api.inworld.ai/tts/v1/voices"
  )
    .trim()
    .replace(/\/$/, "");
  const noFilter = String(process.env.INWORLD_VOICES_NO_FILTER || "").trim() === "1";
  const filter = String(process.env.INWORLD_VOICES_FILTER || "language=en").trim();
  const url =
    noFilter || !filter ? base : `${base}?filter=${encodeURIComponent(filter)}`;

  try {
    const res = await fetch(url, { headers: { Authorization: auth } });
    const rawText = await res.text();
    let body;
    try {
      body = JSON.parse(rawText);
    } catch {
      console.warn("[inworldTts] List voices: response was not JSON");
      return clonePresets();
    }
    if (!res.ok) {
      console.warn(
        "[inworldTts] List voices failed:",
        res.status,
        body?.message || rawText.slice(0, 200)
      );
      return clonePresets();
    }
    const voices = body.voices || [];
    if (!voices.length) return clonePresets();

    return voices.map((v) => ({
      voiceId: v.voiceId,
      blurb:
        [v.description, Array.isArray(v.tags) ? v.tags.join(", ") : ""].filter(Boolean).join(" · ") ||
        v.displayName ||
        String(v.voiceId),
    }));
  } catch (err) {
    console.warn("[inworldTts] List voices request failed:", err.message);
    return clonePresets();
  }
};

/**
 * Pick an Inworld voice from the catalog (GPT-4o-mini), or use forced/default.
 *
 * @param {string} voiceDescription
 * @param {Array<{voiceId:string, blurb:string}>} [catalog] — from fetchInworldVoiceCatalog(); defaults to preset JSON
 * @returns {Promise<string>} voiceId for Inworld TTS
 */
const selectBestInworldVoice = async (voiceDescription, catalog = null) => {
  const forced = getForcedInworldVoiceId();
  if (forced) return forced;

  const presets =
    catalog && Array.isArray(catalog) && catalog.length ? catalog : INWORLD_PRESET_VOICES;
  const voiceIds = presets.map((v) => v.voiceId);
  const fallback = getDefaultInworldVoice();

  try {
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a voice casting assistant. Given a speaker description, pick exactly one Inworld TTS voice " +
            "from the allowed list. Return ONLY valid JSON: " +
            '{ "voiceId": "<name>", "reason": "<one sentence>" }. ' +
            `Allowed voiceIds: ${voiceIds.join(", ")}.`,
        },
        {
          role: "user",
          content: JSON.stringify({
            speakerDescription: voiceDescription,
            voiceOptions: presets,
          }),
        },
      ],
    });

    const parsed = JSON.parse(response.choices[0].message.content);
    const id = String(parsed.voiceId || "").trim();
    if (voiceIds.includes(id)) {
      console.log(`[inworldTts] Voice match: ${id} — ${parsed.reason}`);
      return id;
    }
  } catch (err) {
    console.warn("[inworldTts] Voice matching failed, using default:", err.message);
  }

  return voiceIds.includes(fallback) ? fallback : presets[0].voiceId;
};

/**
 * Synthesize speech via Inworld TTS (non-streaming). Decodes base64 MP3 from audioContent.
 *
 * @param {string} text
 * @param {string} voiceId - Preset name or cloned voice id
 * @returns {Promise<{ audioPath: string, durationSeconds: number }>}
 */
const synthesizeInworldTts = async (text, voiceId) => {
  const auth = buildInworldAuthorizationHeader();
  if (!auth) {
    throw new Error("INWORLD_API_KEY is not set");
  }

  const modelId = String(process.env.INWORLD_TTS_MODEL || "inworld-tts-1.5-max").trim();
  const speakingRate = Number(process.env.INWORLD_SPEAKING_RATE ?? 1);
  const temperature = Number(process.env.INWORLD_TEMPERATURE ?? 1);
  const timestampType = String(process.env.INWORLD_TIMESTAMP_TYPE || "WORD").trim() || "WORD";

  let input = text;
  if (input.length > INWORLD_INPUT_MAX) {
    console.warn(`[inworldTts] Segment truncated from ${input.length} to ${INWORLD_INPUT_MAX} chars`);
    input = input.slice(0, INWORLD_INPUT_MAX);
  }

  const payload = {
    text: input,
    voiceId,
    modelId,
    timestampType,
    audioConfig: {
      speakingRate: Number.isFinite(speakingRate) ? speakingRate : 1,
    },
    temperature: Number.isFinite(temperature) ? temperature : 1,
  };

  const res = await fetch(INWORLD_TTS_URL, {
    method: "POST",
    headers: {
      Authorization: auth,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  const rawText = await res.text();
  let body;
  try {
    body = JSON.parse(rawText);
  } catch {
    body = { message: rawText };
  }

  if (!res.ok) {
    const msg =
      body?.message ||
      body?.error?.message ||
      (typeof body?.error === "string" ? body.error : null) ||
      rawText ||
      res.statusText;
    const err = new Error(`Inworld TTS ${res.status}: ${msg}`);
    err.statusCode = res.status;
    throw err;
  }

  const b64 = body?.audioContent;
  if (!b64 || typeof b64 !== "string") {
    throw new Error("Inworld TTS response missing audioContent");
  }

  const buf = Buffer.from(b64, "base64");
  const outputPath = path.join(os.tmpdir(), `inworld_${uuidv4()}.mp3`);
  fs.writeFileSync(outputPath, buf);

  const durationSeconds = await getFileDuration(outputPath);
  return { audioPath: outputPath, durationSeconds };
};

module.exports = {
  buildInworldAuthorizationHeader,
  isInworldConfigured,
  fetchInworldVoiceCatalog,
  selectBestInworldVoice,
  synthesizeInworldTts,
  INWORLD_PRESET_VOICES,
  INWORLD_VOICE_IDS,
};
