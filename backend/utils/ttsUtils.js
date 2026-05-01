const fs = require("fs");
const path = require("path");
const os = require("os");
const { v4: uuidv4 } = require("uuid");
const { ElevenLabsClient } = require("@elevenlabs/elevenlabs-js");
const OpenAI = require("openai");
const { getFileDuration } = require("./audioUtils");

let _elevenlabs = null;
const getElevenLabs = () => {
  if (!_elevenlabs)
    _elevenlabs = new ElevenLabsClient({
      apiKey: process.env.ELEVENLABS_API_KEY,
    });
  return _elevenlabs;
};

let _openai = null;
const getOpenAI = () => {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
};

// ElevenLabs TTS model — multilingual v2
const TTS_MODEL = "eleven_flash_v2_5";

// Fallback ElevenLabs voice id when GPT matching fails (paid API only; free API cannot use library voices)
const FALLBACK_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";

const OPENAI_TTS_INPUT_MAX = 4096;

/** @type {Array<{ voice: string, blurb: string }>} */
const OPENAI_TTS_VOICES = [
  { voice: "alloy", blurb: "Neutral, balanced; works for many roles." },
  { voice: "echo", blurb: "Male-presenting, clear." },
  { voice: "fable", blurb: "British-accented, expressive." },
  { voice: "onyx", blurb: "Deep male-presenting, authoritative." },
  { voice: "nova", blurb: "Warm female-presenting, conversational." },
  { voice: "shimmer", blurb: "Bright female-presenting, energetic." },
];

const OPENAI_TTS_VOICE_NAMES = OPENAI_TTS_VOICES.map((v) => v.voice);

const DEFAULT_OPENAI_TTS_VOICE = "nova";

/**
 * Dubbing TTS backend: `openai` | `elevenlabs` | `inworld` | `smallest` | `gemini` | `auto`.
 * `auto`: Inworld (if INWORLD_API_KEY) → Smallest (if SMALLEST_API_KEY) → ElevenLabs → OpenAI.
 * Default: auto
 */
const getTtsProvider = () => {
  const raw = (process.env.DUBBING_TTS_PROVIDER || "auto").trim().toLowerCase();
  if (
    raw === "openai" ||
    raw === "elevenlabs" ||
    raw === "inworld" ||
    raw === "smallest" ||
    raw === "gemini" ||
    raw === "auto"
  ) {
    return raw;
  }
  return "auto";
};

/**
 * True when ElevenLabs rejects TTS because the account cannot use library voices via API (typical free tier).
 * @param {unknown} err
 */
const isElevenLabsLibraryVoiceBlockedError = (err) => {
  if (!err || typeof err !== "object") return false;
  const status = /** @type {{ statusCode?: number }} */ (err).statusCode;
  if (status !== 402) return false;
  const body =
    /** @type {{ body?: { detail?: { code?: string; message?: string } } }} */ (
      err
    ).body;
  const code = body?.detail?.code;
  if (code === "paid_plan_required") return true;
  const msg = String(body?.detail?.message || "").toLowerCase();
  if (msg.includes("library voices") || msg.includes("free users cannot"))
    return true;
  const str = String(/** @type {Error} */ (err).message || "").toLowerCase();
  if (str.includes("paid_plan_required") || str.includes("library voices"))
    return true;
  return false;
};

/**
 * Fetch all voices available on the current ElevenLabs account.
 *
 * @returns {Promise<Array<{voiceId:string, name:string, labels:object}>>}
 */
const fetchAvailableVoices = async () => {
  const result = await getElevenLabs().voices.getAll();
  return result.voices || [];
};

/**
 * Select the best pre-built ElevenLabs voice for a speaker using GPT-4o-mini.
 * Requires a **paid** ElevenLabs plan for API TTS with library voices.
 *
 * @param {string} voiceDescription
 * @param {Array} availableVoices
 * @param {{ excludeVoiceIds?: string[] }} [options]
 * @returns {Promise<string>} ElevenLabs voiceId
 */
const selectBestVoice = async (
  voiceDescription,
  availableVoices,
  options = {},
) => {
  if (!availableVoices.length) return FALLBACK_VOICE_ID;

  const excludeSet = new Set((options.excludeVoiceIds || []).map(String));
  let pool = availableVoices.filter((v) => !excludeSet.has(v.voiceId));
  if (!pool.length) {
    console.warn(
      "[ttsUtils] ElevenLabs: all account voices already assigned; reusing pool.",
    );
    pool = availableVoices;
  }

  const voiceSummaries = pool.map((v) => ({
    voiceId: v.voiceId,
    name: v.name,
    gender: v.labels?.gender || "",
    accent: v.labels?.accent || "",
    age: v.labels?.age || "",
    description: v.labels?.description || "",
    useCase: v.labels?.use_case || "",
  }));

  try {
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a voice casting assistant. Given a speaker description and a list of available voices, " +
            "pick the single best matching voice. Do NOT pick any voiceId in alreadyAssignedVoiceIds. " +
            "Prioritise: gender match first, then age range, then accent/tone similarity. " +
            'Return ONLY valid JSON: { "voiceId": "<the matching voiceId>", "reason": "<one sentence why>" }',
        },
        {
          role: "user",
          content: JSON.stringify({
            speakerDescription: voiceDescription,
            availableVoices: voiceSummaries,
            alreadyAssignedVoiceIds: [...excludeSet],
          }),
        },
      ],
    });

    const parsed = JSON.parse(response.choices[0].message.content);
    const matched = pool.find(
      (v) => v.voiceId === parsed.voiceId && !excludeSet.has(v.voiceId),
    );

    if (matched) {
      console.log(
        `[ttsUtils] Voice match: "${matched.name}" — ${parsed.reason}`,
      );
      return matched.voiceId;
    }
  } catch (err) {
    console.warn(
      "[ttsUtils] Voice matching failed, using fallback:",
      err.message,
    );
  }

  const firstUnused = availableVoices.find((v) => !excludeSet.has(v.voiceId));
  return firstUnused ? firstUnused.voiceId : FALLBACK_VOICE_ID;
};

/**
 * Pick an OpenAI TTS preset voice from the speaker description.
 *
 * @param {string} voiceDescription
 * @param {{ excludeVoiceIds?: string[] }} [options] — excludeVoiceIds are voice names (e.g. nova)
 * @returns {Promise<string>} One of alloy, echo, fable, onyx, nova, shimmer
 */
const selectBestOpenAIVoice = async (voiceDescription, options = {}) => {
  const excludeSet = new Set(
    (options.excludeVoiceIds || []).map((x) => String(x).toLowerCase()),
  );
  let pool = OPENAI_TTS_VOICES.filter((v) => !excludeSet.has(v.voice));
  if (!pool.length) {
    console.warn(
      "[ttsUtils] OpenAI: all 6 preset voices already assigned; reusing presets.",
    );
    pool = OPENAI_TTS_VOICES;
  }
  const names = pool.map((v) => v.voice);

  try {
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a voice casting assistant. Given a speaker description, pick exactly one OpenAI TTS voice " +
            "from the allowed list. Do not pick a voice already in alreadyAssignedVoices. Return ONLY valid JSON: " +
            '{ "voice": "<name>", "reason": "<one sentence>" }. ' +
            `Allowed voices: ${names.join(", ")}.`,
        },
        {
          role: "user",
          content: JSON.stringify({
            speakerDescription: voiceDescription,
            voiceOptions: pool,
            alreadyAssignedVoices: [...excludeSet],
          }),
        },
      ],
    });

    const parsed = JSON.parse(response.choices[0].message.content);
    const v = String(parsed.voice || "").toLowerCase();
    if (names.includes(v) && !excludeSet.has(v)) {
      console.log(`[ttsUtils] OpenAI voice match: ${v} — ${parsed.reason}`);
      return v;
    }
  } catch (err) {
    console.warn(
      "[ttsUtils] OpenAI voice matching failed, using default:",
      err.message,
    );
  }

  const firstFree = OPENAI_TTS_VOICE_NAMES.find((n) => !excludeSet.has(n));
  return firstFree || DEFAULT_OPENAI_TTS_VOICE;
};

/**
 * Generate speech using ElevenLabs (paid API for library voices).
 *
 * @returns {Promise<{audioPath:string, durationSeconds:number}>}
 */
const generateSpeech = async (text, voiceId, options = {}) => {
  const { stability = 0.5, similarityBoost = 0.75, style = 0.0 } = options;

  const audioStream = await getElevenLabs().textToSpeech.convert(voiceId, {
    text,
    modelId: TTS_MODEL,
    outputFormat: "mp3_44100_128",
    voiceSettings: {
      stability,
      style,
      similarityBoost,
      useSpeakerBoost: true,
    },
  });

  const chunks = [];
  for await (const chunk of audioStream) {
    chunks.push(chunk);
  }
  const audioBuffer = Buffer.concat(chunks);

  const outputPath = path.join(os.tmpdir(), `tts_${uuidv4()}.mp3`);
  fs.writeFileSync(outputPath, audioBuffer);

  const durationSeconds = await getFileDuration(outputPath);
  const characterCount = text.length;

  return { audioPath: outputPath, durationSeconds, characterCount };
};

/**
 * Generate speech using OpenAI Audio API (works without ElevenLabs paid plan).
 *
 * @param {string} text
 * @param {string} voiceName - alloy | echo | fable | onyx | nova | shimmer
 * @returns {Promise<{audioPath:string, durationSeconds:number}>}
 */
const generateSpeechOpenAI = async (text, voiceName) => {
  const model = (process.env.OPENAI_TTS_MODEL || "tts-1").trim() || "tts-1";
  let input = text;
  if (input.length > OPENAI_TTS_INPUT_MAX) {
    console.warn(
      `[ttsUtils] Segment truncated from ${input.length} to ${OPENAI_TTS_INPUT_MAX} chars for OpenAI TTS`,
    );
    input = input.slice(0, OPENAI_TTS_INPUT_MAX);
  }

  const response = await getOpenAI().audio.speech.create({
    model,
    voice: voiceName,
    input,
    response_format: "mp3",
  });

  const buf = Buffer.from(await response.arrayBuffer());
  const outputPath = path.join(os.tmpdir(), `tts_openai_${uuidv4()}.mp3`);
  fs.writeFileSync(outputPath, buf);

  const durationSeconds = await getFileDuration(outputPath);
  const characterCount = input.length;

  return { audioPath: outputPath, durationSeconds, characterCount };
};

module.exports = {
  getTtsProvider,
  isElevenLabsLibraryVoiceBlockedError,
  fetchAvailableVoices,
  selectBestVoice,
  selectBestOpenAIVoice,
  generateSpeech,
  generateSpeechOpenAI,
  OPENAI_TTS_VOICE_NAMES,
};
