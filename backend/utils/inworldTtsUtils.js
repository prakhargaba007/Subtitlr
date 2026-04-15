const fs = require("fs");
const path = require("path");
const os = require("os");
const { v4: uuidv4 } = require("uuid");
const { GoogleGenAI } = require("@google/genai");
const { getFileDuration } = require("./audioUtils");

/**
 * Static fallback when list-voices API is unavailable. Full catalog at runtime:
 * `fetchInworldVoiceCatalog()` → GET https://api.inworld.ai/tts/v1/voices
 */
const INWORLD_PRESET_VOICES = require("./data/inworldVoices.json");
const { getInworldApplyTextNormalization } = require("./dubbingConfig");

/**
 * Maps language strings to Inworld langCode values used in inworld_voices_last.json.
 *
 * Covers three input formats that can arrive as `targetLanguage`:
 *  1. Full English names from LANGUAGE_LIST/LANGUAGE_MAP  (e.g. "hindi", "german")
 *  2. ISO 639-1 / BCP-47 short codes                     (e.g. "hi", "de", "hi-IN")
 *  3. Native-script aliases used in LANGUAGE_MAP          (e.g. "deutsch", "español")
 *
 * Only languages present in the Inworld voice catalog are listed here.
 * Unsupported languages resolve to null → full catalog fallback.
 */
const LANG_CODE_MAP = {
  // ── Hindi ──────────────────────────────────────────────────────────────────
  hindi: "HI_IN",
  hi: "HI_IN",
  "hi-in": "HI_IN",

  // ── English ────────────────────────────────────────────────────────────────
  english: "EN_US",
  en: "EN_US",
  "en-us": "EN_US",
  "en-gb": "EN_US", // Inworld catalog uses EN_US for all English variants

  // ── German ─────────────────────────────────────────────────────────────────
  german: "DE_DE",
  deutsch: "DE_DE",
  de: "DE_DE",
  "de-de": "DE_DE",

  // ── Spanish ────────────────────────────────────────────────────────────────
  spanish: "ES_ES",
  español: "ES_ES",
  espanol: "ES_ES",
  es: "ES_ES",
  "es-es": "ES_ES",
  "es-mx": "ES_ES",

  // ── French ─────────────────────────────────────────────────────────────────
  french: "FR_FR",
  français: "FR_FR",
  francais: "FR_FR",
  fr: "FR_FR",
  "fr-fr": "FR_FR",

  // ── Italian ────────────────────────────────────────────────────────────────
  italian: "IT_IT",
  italiano: "IT_IT",
  it: "IT_IT",
  "it-it": "IT_IT",

  // ── Japanese ───────────────────────────────────────────────────────────────
  japanese: "JA_JP",
  ja: "JA_JP",
  "ja-jp": "JA_JP",

  // ── Korean ─────────────────────────────────────────────────────────────────
  korean: "KO_KR",
  ko: "KO_KR",
  "ko-kr": "KO_KR",

  // ── Portuguese ─────────────────────────────────────────────────────────────
  portuguese: "PT_BR",
  português: "PT_BR",
  portugues: "PT_BR",
  pt: "PT_BR",
  "pt-br": "PT_BR",

  // ── Russian ────────────────────────────────────────────────────────────────
  russian: "RU_RU",
  ru: "RU_RU",
  "ru-ru": "RU_RU",

  // ── Chinese ────────────────────────────────────────────────────────────────
  chinese: "ZH_CN",
  mandarin: "ZH_CN",
  zh: "ZH_CN",
  "zh-cn": "ZH_CN",

  // ── Arabic ─────────────────────────────────────────────────────────────────
  arabic: "AR_SA",
  ar: "AR_SA",
  "ar-sa": "AR_SA",

  // ── Dutch ──────────────────────────────────────────────────────────────────
  dutch: "NL_NL",
  nl: "NL_NL",
  "nl-nl": "NL_NL",

  // ── Polish ─────────────────────────────────────────────────────────────────
  polish: "PL_PL",
  pl: "PL_PL",
  "pl-pl": "PL_PL",

  // ── Hebrew ─────────────────────────────────────────────────────────────────
  hebrew: "HE_IL",
  he: "HE_IL",
  "he-il": "HE_IL",
};

/**
 * Resolves a human-readable / BCP-47 language string to the Inworld
 * catalog langCode (e.g. "hindi" → "HI_IN", "de" → "DE_DE").
 * Returns null when the language cannot be resolved.
 *
 * @param {string|null|undefined} lang
 * @returns {string|null}
 */
const resolveInworldLangCode = (lang) => {
  if (!lang) return null;
  const key = String(lang).toLowerCase().trim();
  // Direct map hit
  if (LANG_CODE_MAP[key]) return LANG_CODE_MAP[key];
  // Try just the primary subtag ("hi" from "hi-IN")
  const primary = key.split(/[-_]/)[0];
  return LANG_CODE_MAP[primary] || null;
};

/**
 * Optional curated list from repo (merged into catalog by voiceId).
 */
/**
 * @param {string|null} [targetLangCode] — Inworld langCode to filter by (e.g. "HI_IN").
 *   When null/undefined all voices are returned.
 */
const loadLocalVoicesFile = (targetLangCode = null) => {
  console.log(
    `[inworldTts] loadLocalVoicesFile called — targetLangCode=${targetLangCode ?? "null (all voices)"}`,
  );
  const candidates = [
    path.join(__dirname, "..", "voices", "inworld_voices_last.json"),
  ];
  for (const p of candidates) {
    try {
      if (!fs.existsSync(p)) {
        console.warn(`[inworldTts] Voice file not found, skipping: ${p}`);
        continue;
      }
      console.log(`[inworldTts] Reading voice file: ${p}`);
      const j = JSON.parse(fs.readFileSync(p, "utf8"));
      let voices = j.voices || [];
      console.log(`[inworldTts] Total voices in file: ${voices.length}`);

      if (targetLangCode) {
        const filtered = voices.filter(
          (v) =>
            String(v.langCode || "").toUpperCase() ===
            targetLangCode.toUpperCase(),
        );
        // Only apply the filter when it actually narrows the list down;
        // if no voice matches (e.g. language not in catalog) fall back to all.
        if (filtered.length > 0) {
          voices = filtered;
          console.log(
            `[inworldTts] Filtered to ${filtered.length} voice(s) for langCode=${targetLangCode}`,
          );
          console.log(
            `[inworldTts] Matched voiceIds: ${filtered.map((v) => v.voiceId).join(", ")}`,
          );
        } else {
          console.warn(
            `[inworldTts] No voices found for langCode=${targetLangCode}; using full catalog of ${voices.length} voices as fallback`,
          );
        }
      } else {
        console.log(
          `[inworldTts] No lang filter — returning all ${voices.length} voice(s)`,
        );
      }

      const result = voices.map((v) => ({
        voiceId: v.voiceId,
        blurb:
          [
            v.displayName,
            v.description,
            Array.isArray(v.tags) ? v.tags.join(", ") : "",
          ]
            .filter(Boolean)
            .join(" · ") || String(v.voiceId),
      }));
      console.log(
        `[inworldTts] Returning ${result.length} voice(s) to catalog: [${result.map((v) => v.voiceId).join(", ")}]`,
      );
      return result;
    } catch (err) {
      console.warn("[inworldTts] local voices JSON:", err.message);
    }
  }
  console.warn(
    "[inworldTts] loadLocalVoicesFile: no valid voice file found, returning []",
  );
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

let _gemini = null;
const getGemini = () => {
  const key = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!key) return null;
  if (!_gemini) _gemini = new GoogleGenAI({ apiKey: key });
  return _gemini;
};

const parseGeminiJsonResponse = (response) => {
  let text = "";
  if (response.candidates?.[0]?.content?.parts?.[0]?.text) {
    text = response.candidates[0].content.parts[0].text;
  } else if (typeof response.text === "string") {
    text = response.text;
  } else {
    throw new Error("Unexpected Gemini response format");
  }
  const clean = text
    .replace(/^```(?:json)?\n?/i, "")
    .replace(/\n?```$/i, "")
    .trim();
  return JSON.parse(clean);
};

const INWORLD_TTS_URL = (
  process.env.INWORLD_TTS_URL || "https://api.inworld.ai/tts/v1/voice"
).trim();
const INWORLD_INPUT_MAX = 4096;

const INWORLD_VOICE_IDS = INWORLD_PRESET_VOICES.map((v) => v.voiceId);

const getDefaultInworldVoice = () =>
  String(process.env.INWORLD_DEFAULT_VOICE || "Jason").trim() || "Jason";

/**
 * If set, every speaker uses this voiceId (e.g. a Voice Cloning API id). Skips Gemini voice matching.
 */
const getForcedInworldVoiceId = () =>
  String(process.env.INWORLD_FORCE_VOICE_ID || "").trim();

/**
 * Fetches all built-in TTS voices from Inworld (same auth as synthesize).
 * Falls back to {@link INWORLD_PRESET_VOICES} on error or missing key.
 *
 * Env:
 * - INWORLD_VOICES_LIST_URL — default https://api.inworld.ai/tts/v1/voices
 * - INWORLD_VOICES_FILTER — default language=en; set INWORLD_VOICES_NO_FILTER=1 to omit filter (all languages)
 */
/**
 * Fetches all built-in TTS voices from Inworld (same auth as synthesize).
 * Falls back to {@link INWORLD_PRESET_VOICES} on error or missing key.
 *
 * @param {string|null} [targetLanguage] — BCP-47 / ISO 639-1 language code of the
 *   dubbing target (e.g. "hi", "de", "hi-IN"). When provided only voices matching
 *   that language are included in the returned catalog so Gemini always picks a
 *   voice that can actually speak the target language.
 *
 * Env:
 * - INWORLD_VOICES_LIST_URL — default https://api.inworld.ai/tts/v1/voices
 * - INWORLD_VOICES_FILTER — default language=en; set INWORLD_VOICES_NO_FILTER=1 to omit filter (all languages)
 */
const fetchInworldVoiceCatalog = async (targetLanguage = null) => {
  console.log("targetLanguage", targetLanguage);
  const targetLangCode = resolveInworldLangCode(targetLanguage);
  console.log("targetLangCode", targetLangCode);
  if (targetLangCode) {
    console.log(
      `[inworldTts] Voice catalog: filtering for language="${targetLanguage}" → langCode=${targetLangCode}`,
    );
  }
  const clonePresets = () =>
    mergeVoiceCatalogs(loadLocalVoicesFile(targetLangCode));

  const auth = buildInworldAuthorizationHeader();
  // if (!auth) return clonePresets();
  if (true) return clonePresets();

  const base = String(
    process.env.INWORLD_VOICES_LIST_URL ||
      "https://api.inworld.ai/tts/v1/voices",
  )
    .trim()
    .replace(/\/$/, "");
  const noFilter =
    String(process.env.INWORLD_VOICES_NO_FILTER || "").trim() === "1";
  const filter = String(
    process.env.INWORLD_VOICES_FILTER || "language=en",
  ).trim();
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
        body?.message || rawText.slice(0, 200),
      );
      return clonePresets();
    }
    const voices = body.voices || [];
    if (!voices.length)
      return mergeVoiceCatalogs(clonePresets(), loadLocalVoicesFile());

    const mapped = voices.map((v) => ({
      voiceId: v.voiceId,
      blurb:
        [v.description, Array.isArray(v.tags) ? v.tags.join(", ") : ""]
          .filter(Boolean)
          .join(" · ") ||
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
 * Pick an Inworld voice from the catalog (Gemini JSON), or use forced/default.
 *
 * @param {string} voiceDescription
 * @param {Array<{voiceId:string, blurb:string}>} [catalog] — from fetchInworldVoiceCatalog(); defaults to preset JSON
 * @param {{ excludeVoiceIds?: string[], speakerCount?: number }} [options] — excludeVoiceIds = already-assigned voiceIds (distinct speakers)
 * @returns {Promise<string>} voiceId for Inworld TTS
 */
const selectBestInworldVoice = async (
  voiceDescription,
  catalog = null,
  options = {},
) => {
  const excludeSet = new Set((options.excludeVoiceIds || []).map(String));
  const speakerCount = options.speakerCount ?? 1;
  const forced = getForcedInworldVoiceId();
  if (forced && speakerCount <= 1 && !excludeSet.has(forced)) {
    return forced;
  }
  if (forced && speakerCount > 1) {
    console.warn(
      "[inworldTts] INWORLD_FORCE_VOICE_ID ignored for multi-speaker dubbing (each speaker gets a distinct voice when possible).",
    );
  }

  const presets =
    catalog && Array.isArray(catalog) && catalog.length
      ? catalog
      : INWORLD_PRESET_VOICES;
  let pool = presets.filter((p) => !excludeSet.has(p.voiceId));
  if (!pool.length) {
    console.warn(
      "[inworldTts] All catalog voices already assigned; reusing catalog for an extra speaker.",
    );
    pool = presets;
  }

  const voiceIds = pool.map((v) => v.voiceId);
  const fallback = getDefaultInworldVoice();

  try {
    const gemini = getGemini();
    if (!gemini) {
      throw new Error("GOOGLE_API_KEY or GEMINI_API_KEY not set");
    }
    const model =
      String(process.env.GEMINI_MODEL || "").trim() || "gemini-2.0-flash";
    const systemPrompt =
      "You are a voice casting assistant. Given a speaker description, pick exactly one Inworld TTS voice " +
      "from the allowed list. Each speaker in a dub MUST use a different voiceId than any already assigned — " +
      "the allowed list excludes voices already taken. Return ONLY valid JSON: " +
      '{ "voiceId": "<name>", "reason": "<one sentence>" }. ' +
      `Allowed voiceIds: ${voiceIds.join(", ")}.`;
    const userPayload = JSON.stringify({
      speakerDescription: voiceDescription,
      voiceOptions: pool,
      alreadyAssignedVoiceIds: [...excludeSet],
    });
    const response = await gemini.models.generateContent({
      model,
      contents: `${systemPrompt}\n\n${userPayload}`,
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json",
      },
    });
    const parsed = parseGeminiJsonResponse(response);
    const id = String(parsed.voiceId || "").trim();
    if (voiceIds.includes(id) && !excludeSet.has(id)) {
      console.log(`[inworldTts] Voice match: ${id} — ${parsed.reason}`);
      return id;
    }
  } catch (err) {
    console.warn(
      "[inworldTts] Voice matching failed, using default:",
      err.message,
    );
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
      startTimeMs:
        Number(w.startTimeMs ?? w.start_time_ms ?? w.startMs ?? 0) || 0,
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

  const modelId = String(
    process.env.INWORLD_TTS_MODEL || "inworld-tts-1.5-max",
  ).trim();
  const speakingRate = Number(process.env.INWORLD_SPEAKING_RATE ?? 1);
  const temperature = Number(process.env.INWORLD_TEMPERATURE ?? 1);
  const timestampType =
    String(process.env.INWORLD_TIMESTAMP_TYPE || "WORD").trim() || "WORD";

  let input = text;
  if (input.length > INWORLD_INPUT_MAX) {
    console.warn(
      `[inworldTts] Segment truncated from ${input.length} to ${INWORLD_INPUT_MAX} chars`,
    );
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
  resolveInworldLangCode,
  INWORLD_PRESET_VOICES,
  INWORLD_VOICE_IDS,
};
