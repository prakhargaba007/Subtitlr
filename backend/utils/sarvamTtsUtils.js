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
  "shruti", "suhani", "mohit", "kavitha", "rehan", "soham", "rupali"
];

const isSarvamConfigured = () => {
  return !!String(process.env.SARVAM_API_KEY || "").trim();
};

let _openai = null;
const getOpenAI = () => {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
};

const selectBestSarvamVoice = async (voiceDescription, options = {}) => {
  const excludeSet = new Set((options.excludeVoiceIds || []).map(x => String(x).toLowerCase()));
  let pool = SARVAM_VOICES.filter(v => !excludeSet.has(v));
  if (!pool.length) pool = SARVAM_VOICES;

  try {
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a voice casting assistant. Pick exactly one Sarvam TTS voice from the allowed list. Return ONLY valid JSON: { "voice": "<name>", "reason": "<one sentence>" }. Allowed voices: ${pool.join(", ")}.`
        },
        {
          role: "user",
          content: JSON.stringify({
            speakerDescription: voiceDescription,
            voiceOptions: pool
          })
        }
      ]
    });
    const parsed = JSON.parse(response.choices[0].message.content);
    if (parsed.voice && SARVAM_VOICES.includes(parsed.voice.toLowerCase())) {
      return parsed.voice.toLowerCase();
    }
  } catch (err) {
    console.warn("[sarvamTtsUtils] Voice matching failed:", err.message);
  }
  
  return pool[0] || "shubh";
};

const synthesizeSarvamTts = async (text, voiceKey, targetLanguage) => {
  const languageCode = BCP_47_MAP[String(targetLanguage).trim().toLowerCase()] || "hi-IN";
  
  const payload = {
    text: text,
    target_language_code: languageCode,
    speaker: voiceKey,
    model: "bulbul:v3",
    enable_preprocessing: true
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
