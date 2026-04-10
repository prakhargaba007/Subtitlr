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
const { getInworldApplyTextNormalization } = require("./dubbingConfig");

/**
 * Optional curated list from repo (merged into catalog by voiceId).
 */
const loadLocalVoicesFile = () => {
  const candidates = [path.join(__dirname, "..", "voices", "inworld_voices_last.json")];
  for (const p of candidates) {
    try {
      if (!fs.existsSync(p)) continue;
      const j = JSON.parse(fs.readFileSync(p, "utf8"));
      const voices = j.voices || [];
      return voices.map((v) => ({
        voiceId: v.voiceId,
        blurb:
          [v.displayName, v.description, Array.isArray(v.tags) ? v.tags.join(", ") : ""]
            .filter(Boolean)
            .join(" · ") || String(v.voiceId),
      }));
    } catch (err) {
      console.warn("[inworldTts] local voices JSON:", err.message);
    }
  }
  return [];
};

const mergeVoiceCatalogs = (primary, extras) => {
  const seen = new Set((primary || []).map((v) => v.voiceId));
  const out = [...(primary || [])];
  for (const v of extras || []) {
    if (v.voiceId && !seen.has(v.voiceId)) {
      seen.add(v.voiceId);
      out.push(v);
    }
  }
  return out;
};

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
  const clonePresets = () => mergeVoiceCatalogs(INWORLD_PRESET_VOICES.map((v) => ({ ...v })), loadLocalVoicesFile());

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
    if (!voices.length) return mergeVoiceCatalogs(clonePresets(), loadLocalVoicesFile());

    const mapped = voices.map((v) => ({
      voiceId: v.voiceId,
      blurb:
        [v.description, Array.isArray(v.tags) ? v.tags.join(", ") : ""].filter(Boolean).join(" · ") ||
        v.displayName ||
        String(v.voiceId),
    }));
    return mergeVoiceCatalogs(mapped, loadLocalVoicesFile());
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
 * @param {{ excludeVoiceIds?: string[], speakerCount?: number }} [options] — excludeVoiceIds = already-assigned voiceIds (distinct speakers)
 * @returns {Promise<string>} voiceId for Inworld TTS
 */
const selectBestInworldVoice = async (voiceDescription, catalog = null, options = {}) => {
  const excludeSet = new Set((options.excludeVoiceIds || []).map(String));
  const speakerCount = options.speakerCount ?? 1;
  const forced = getForcedInworldVoiceId();
  if (forced && speakerCount <= 1 && !excludeSet.has(forced)) {
    return forced;
  }
  if (forced && speakerCount > 1) {
    console.warn(
      "[inworldTts] INWORLD_FORCE_VOICE_ID ignored for multi-speaker dubbing (each speaker gets a distinct voice when possible)."
    );
  }

  const presets =
    catalog && Array.isArray(catalog) && catalog.length ? catalog : INWORLD_PRESET_VOICES;
  let pool = presets.filter((p) => !excludeSet.has(p.voiceId));
  if (!pool.length) {
    console.warn("[inworldTts] All catalog voices already assigned; reusing catalog for an extra speaker.");
    pool = presets;
  }

  const voiceIds = pool.map((v) => v.voiceId);
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
            "from the allowed list. Each speaker in a dub MUST use a different voiceId than any already assigned — " +
            "the allowed list excludes voices already taken. Return ONLY valid JSON: " +
            '{ "voiceId": "<name>", "reason": "<one sentence>" }. ' +
            `Allowed voiceIds: ${voiceIds.join(", ")}.`,
        },
        {
          role: "user",
          content: JSON.stringify({
            speakerDescription: voiceDescription,
            voiceOptions: pool,
            alreadyAssignedVoiceIds: [...excludeSet],
          }),
        },
      ],
    });

    const parsed = JSON.parse(response.choices[0].message.content);
    const id = String(parsed.voiceId || "").trim();
    if (voiceIds.includes(id) && !excludeSet.has(id)) {
      console.log(`[inworldTts] Voice match: ${id} — ${parsed.reason}`);
      return id;
    }
  } catch (err) {
    console.warn("[inworldTts] Voice matching failed, using default:", err.message);
  }

  const firstUnused = presets.find((p) => !excludeSet.has(p.voiceId));
  if (firstUnused) return firstUnused.voiceId;
  if (voiceIds.includes(fallback) && !excludeSet.has(fallback)) return fallback;
  return pool[0]?.voiceId || presets[0].voiceId;
};

const normalizeWordTimestamps = (raw) => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((w) => ({
      word: String(w.word ?? w.text ?? "").trim(),
      startTimeMs: Number(w.startTimeMs ?? w.start_time_ms ?? w.startMs ?? 0) || 0,
      endTimeMs: Number(w.endTimeMs ?? w.end_time_ms ?? w.endMs ?? 0) || 0,
    }))
    .filter((x) => x.word);
};

const extractWordTimestampsFromBody = (body) => {
  let raw = body?.wordTimestamps || body?.word_timestamps;
  if (Array.isArray(raw)) return normalizeWordTimestamps(raw);
  raw = body?.timestamps?.words || body?.timestamp?.words;
  if (Array.isArray(raw)) return normalizeWordTimestamps(raw);
  if (Array.isArray(body?.words)) return normalizeWordTimestamps(body.words);
  return [];
};

/**
 * Synthesize speech via Inworld TTS (non-streaming). Decodes base64 MP3 from audioContent.
 *
 * @param {string} text
 * @param {string} voiceId - Preset name or cloned voice id
 * @returns {Promise<{ audioPath: string, durationSeconds: number, wordTimestamps?: Array<{word:string,startTimeMs:number,endTimeMs:number}> }>}
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

  const normOpt = getInworldApplyTextNormalization();
  if (normOpt === "ON" || normOpt === "OFF") {
    payload.applyTextNormalization = normOpt;
  }

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
  const wordTimestamps = extractWordTimestampsFromBody(body);
  return { audioPath: outputPath, durationSeconds, wordTimestamps };
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
