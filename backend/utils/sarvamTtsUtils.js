const fs = require("fs");
const path = require("path");
const os = require("os");
const axios = require("axios");
const OpenAI = require("openai");
const { v4: uuidv4 } = require("uuid");
const { getFileDuration } = require("./audioUtils");
const { SARVAM_BCP47_MAP } = require("./languageCatalog");

const BCP_47_MAP = SARVAM_BCP47_MAP;

const SARVAM_VOICES = [
  "shubh", "aditya", "ritu", "priya", "neha", "rahul", "pooja", "rohan", "simran", "kavya",
  "amit", "dev", "ishita", "shreya", "ratan", "varun", "manan", "sumit", "roopa", "kabir",
  "aayan", "ashutosh", "advait", "anand", "tanya", "tarun", "sunny", "mani", "gokul", "vijay",
  "shruti", "suhani", "mohit", "kavitha", "rehan", "soham", "rupali",
];

const SARVAM_LANGUAGE_VOICE_RECOMMENDATIONS = {
  english: {
    male: ["ratan"],
    female: ["ishita"],
  },
  hindi: {
    male: ["shubh", "ashutosh"],
    female: ["priya", "suhani"],
  },
  telugu: {
    male: ["shubh", "ratan"],
    female: ["neha", "priya"],
  },
  kannada: {
    male: ["shubh", "ratan"],
    female: ["neha", "ishita"],
  },
  bengali: {
    male: ["rehan"],
    female: ["roopa", "suhani"],
  },
  tamil: {
    male: ["ratan", "rohan"],
    female: ["ishita", "ritu"],
  },
  odia: {
    male: ["shubh"],
    female: ["ritu", "pooja"],
  },
  malayalam: {
    male: ["shubh"],
    female: ["pooja"],
  },
  marathi: {
    male: ["ratan"],
    female: ["priya", "ritu"],
  },
  punjabi: {
    male: ["mani"],
    female: ["roopa", "suhani"],
  },
  gujarati: {
    male: ["ratan"],
    female: ["priya", "ritu"],
  },
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

const DEFAULT_SARVAM_FALLBACK_ORDER = [
  "priya",
  "ishita",
  "shubh",
  "ratan",
  "suhani",
  "roopa",
  "ritu",
  "mani",
];

const norm = (value) => String(value || "").trim().toLowerCase();

const resolveSarvamLanguageKey = (targetLanguage) => {
  const key = norm(targetLanguage);
  if (BCP_47_MAP[key]) return key;
  return SARVAM_LANGUAGE_ALIASES[key] || null;
};

const inferGender = (voiceDescription) => {
  const text = norm(voiceDescription);
  if (
    /\b(female|woman|girl|lady|feminine|she|her)\b/.test(text) ||
    /\bमहिला\b/.test(text)
  ) {
    return "female";
  }
  if (
    /\b(male|man|boy|masculine|he|him)\b/.test(text) ||
    /\bपुरुष\b/.test(text)
  ) {
    return "male";
  }
  return null;
};

const buildRecommendedVoicePool = (targetLanguage, voiceDescription, excludeSet) => {
  const languageKey = resolveSarvamLanguageKey(targetLanguage) || "hindi";
  const recommendations =
    SARVAM_LANGUAGE_VOICE_RECOMMENDATIONS[languageKey] ||
    SARVAM_LANGUAGE_VOICE_RECOMMENDATIONS.hindi;
  const gender = inferGender(voiceDescription);
  const ordered = [
    ...(gender ? recommendations[gender] || [] : []),
    ...recommendations.female,
    ...recommendations.male,
    ...DEFAULT_SARVAM_FALLBACK_ORDER,
  ];
  const deduped = [...new Set(ordered.map((v) => v.toLowerCase()))].filter(
    (v) => SARVAM_VOICES.includes(v),
  );
  const available = deduped.filter((v) => !excludeSet.has(v));
  return available.length ? available : deduped;
};

const parseNumberEnv = (key, fallback, min, max) => {
  const raw = String(process.env[key] || "").trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
};

const isSarvamConfigured = () => {
  return !!String(process.env.SARVAM_API_KEY || "").trim();
};

let _openai = null;
const getOpenAI = () => {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
};

const selectBestSarvamVoice = async (voiceDescription, options = {}) => {
  const excludeSet = new Set(
    (options.excludeVoiceIds || []).map((x) => String(x).toLowerCase()),
  );
  let pool = buildRecommendedVoicePool(
    options.targetLanguage,
    voiceDescription,
    excludeSet,
  );
  if (!pool.length) pool = SARVAM_VOICES.filter((v) => !excludeSet.has(v));
  if (!pool.length) pool = SARVAM_VOICES;

  try {
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a voice casting assistant. Pick exactly one Sarvam Bulbul v3 voice from the allowed list. " +
            "Prefer gender match first, then age/tone fit. Avoid varun unless the speaker is clearly dramatic, villainous, thriller, or suspense. " +
            `Return ONLY valid JSON: { "voice": "<name>", "reason": "<one sentence>" }. Allowed voices: ${pool.join(", ")}.`,
        },
        {
          role: "user",
          content: JSON.stringify({
            speakerDescription: voiceDescription,
            targetLanguage: options.targetLanguage,
            voiceOptions: pool,
          }),
        },
      ],
    });
    const parsed = JSON.parse(response.choices[0].message.content);
    const voice = String(parsed.voice || "").toLowerCase();
    if (pool.includes(voice) && !excludeSet.has(voice)) {
      return voice;
    }
  } catch (err) {
    console.warn("[sarvamTtsUtils] Voice matching failed:", err.message);
  }

  return pool[0] || "shubh";
};

const synthesizeSarvamTts = async (text, voiceKey, targetLanguage) => {
  const languageKey = resolveSarvamLanguageKey(targetLanguage) || "hindi";
  const languageCode = BCP_47_MAP[languageKey] || "hi-IN";
  const pace = parseNumberEnv("SARVAM_TTS_PACE", 1.0, 0.5, 2.0);
  const temperature = parseNumberEnv("SARVAM_TTS_TEMPERATURE", 0.6, 0.01, 1.0);
  
  const payload = {
    text,
    target_language_code: languageCode,
    speaker: voiceKey,
    model: "bulbul:v3",
    enable_preprocessing: true,
    pace,
    temperature,
  };

  if (process.env.SARVAM_DICT_ID) {
    payload.dict_id = process.env.SARVAM_DICT_ID;
  }

  const response = await axios.post("https://api.sarvam.ai/text-to-speech", payload, {
    headers: {
      "api-subscription-key": process.env.SARVAM_API_KEY,
      "Content-Type": "application/json"
    }
  });

  const audios = response.data.audios;
  if (!audios || !audios.length) {
    throw new Error("Sarvam TTS returned no audio.");
  }

  const base64Audio = audios[0];
  const audioBuffer = Buffer.from(base64Audio, "base64");
  
  const outputPath = path.join(os.tmpdir(), `tts_sarvam_${uuidv4()}.wav`);
  fs.writeFileSync(outputPath, audioBuffer);
  
  const durationSeconds = await getFileDuration(outputPath);
  
  return { audioPath: outputPath, durationSeconds, wordTimestamps: [] };
};

module.exports = {
  isSarvamConfigured,
  selectBestSarvamVoice,
  synthesizeSarvamTts,
  BCP_47_MAP
};
