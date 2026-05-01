const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawnSync } = require("child_process");
const { v4: uuidv4 } = require("uuid");
const OpenAI = require("openai");
const { GoogleGenAI, Modality } = require("@google/genai");
const ffmpegStatic = require("ffmpeg-static");
const { getFileDuration } = require("./audioUtils");

const VOICES_JSON = path.join(__dirname, "..", "config", "gemini_3_1_tts_voices.json");

/** Rough char cap to stay under TTS context limits (tokens). */
const GEMINI_TTS_MAX_CHARS = 12000;

const DEFAULT_GEMINI_VOICE = "Kore";

let _catalog = null;

const getGeminiApiKey = () =>
  String(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "").trim() || null;

const isGeminiTtsConfigured = () => Boolean(getGeminiApiKey());

const getGeminiTtsModel = () =>
  String(process.env.GEMINI_TTS_MODEL || "gemini-3.1-flash-tts-preview").trim() ||
  "gemini-3.1-flash-tts-preview";

/**
 * @returns {Array<{ name: string, gender: string, character: string, tone_description: string, recommended_use_cases: string[] }>}
 */
const loadGeminiVoiceCatalog = () => {
  if (_catalog) return _catalog;
  const raw = fs.readFileSync(VOICES_JSON, "utf8");
  const data = JSON.parse(raw);
  _catalog = Array.isArray(data.voices) ? data.voices : [];
  return _catalog;
};

const getGeminiVoiceNames = () => loadGeminiVoiceCatalog().map((v) => v.name).filter(Boolean);

let _openai = null;
const getOpenAI = () => {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
};

/**
 * Pick a Gemini prebuilt voice name for dubbing from speaker_description.
 *
 * @param {string} voiceDescription
 * @param {{ excludeVoiceIds?: string[], speakerCount?: number }} [options] — excludeVoiceIds are voice names (e.g. Kore)
 * @returns {Promise<string>}
 */
const selectBestGeminiVoice = async (voiceDescription, options = {}) => {
  const catalog = loadGeminiVoiceCatalog();
  if (!catalog.length) return DEFAULT_GEMINI_VOICE;

  const excludeSet = new Set(
    (options.excludeVoiceIds || []).map((x) => String(x).trim()).filter(Boolean),
  );
  let pool = catalog.filter((v) => v.name && !excludeSet.has(v.name));
  if (!pool.length) pool = catalog;

  const names = pool.map((v) => v.name);
  if (!String(process.env.OPENAI_API_KEY || "").trim()) {
    const first = pool.find((v) => !excludeSet.has(v.name));
    return first?.name || DEFAULT_GEMINI_VOICE;
  }

  try {
    const voiceSummaries = pool.map((v) => ({
      name: v.name,
      gender: v.gender,
      character: v.character,
      tone: v.tone_description,
      useCases: (v.recommended_use_cases || []).join("; "),
    }));

    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a voice casting assistant for Google Gemini TTS prebuilt voices. " +
            "Given a speaker description, pick exactly one voice `name` from the allowed list. " +
            "Do not pick a name in alreadyAssignedVoices. Return ONLY JSON: " +
            '{ "voiceName": "<Name>", "reason": "<one sentence>" }.',
        },
        {
          role: "user",
          content: JSON.stringify({
            speakerDescription: voiceDescription,
            availableVoices: voiceSummaries,
            alreadyAssignedVoices: [...excludeSet],
          }),
        },
      ],
    });

    const parsed = JSON.parse(response.choices[0].message.content);
    const picked = String(parsed.voiceName || parsed.voice || "").trim();
    if (picked && names.includes(picked) && !excludeSet.has(picked)) {
      console.log(`[geminiTts] Voice match: ${picked} — ${parsed.reason || ""}`);
      return picked;
    }
  } catch (err) {
    console.warn("[geminiTts] Voice matching failed, using default:", err.message);
  }

  const firstFree = pool.find((v) => v.name && !excludeSet.has(v.name));
  return firstFree?.name || DEFAULT_GEMINI_VOICE;
};

const pcmRawToMp3 = (pcmPath, mp3Path) => {
  const r = spawnSync(
    ffmpegStatic,
    [
      "-y",
      "-f",
      "s16le",
      "-ar",
      "24000",
      "-ac",
      "1",
      "-i",
      pcmPath,
      "-c:a",
      "libmp3lame",
      "-b:a",
      "128k",
      mp3Path,
    ],
    { encoding: "utf8" },
  );
  if (r.status !== 0) {
    throw new Error(
      `ffmpeg PCM→MP3 failed (${r.status}): ${(r.stderr || r.stdout || "").slice(0, 500)}`,
    );
  }
};

/**
 * Find first inline audio part in generateContent response.
 * @param {unknown} response
 * @returns {{ data: Buffer, mimeType: string } | null}
 */
const extractInlineAudio = (response) => {
  const parts = response?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return null;
  for (const p of parts) {
    const inline = p?.inlineData || p?.inline_data;
    if (inline?.data) {
      const mimeType = String(inline.mimeType || inline.mime_type || "application/octet-stream");
      try {
        const data = Buffer.from(inline.data, "base64");
        if (data.length) return { data, mimeType };
      } catch {
        /* ignore */
      }
    }
  }
  return null;
};

const isRetryableTtsError = (err) => {
  const msg = String(err?.message || err || "").toLowerCase();
  const status = err?.status || err?.code;
  if (status === 500 || status === 503) return true;
  if (msg.includes("500") || msg.includes("503")) return true;
  if (msg.includes("unavailable") || msg.includes("resource exhausted")) return true;
  return false;
};

/**
 * Gemini Native Audio TTS (single speaker). Input text may include English [audio tags].
 *
 * @param {string} text
 * @param {string} voiceName — e.g. Kore, Puck
 * @returns {Promise<{ audioPath: string, wordTimestamps: [] }>}
 */
const synthesizeGeminiTts = async (text, voiceName) => {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error("GOOGLE_API_KEY or GEMINI_API_KEY is required for Gemini TTS.");
  }

  let input = String(text || "").trim();
  if (!input) {
    throw new Error("Gemini TTS: empty text.");
  }
  if (input.length > GEMINI_TTS_MAX_CHARS) {
    console.warn(
      `[geminiTts] Truncating segment from ${input.length} to ${GEMINI_TTS_MAX_CHARS} chars for TTS`,
    );
    input = input.slice(0, GEMINI_TTS_MAX_CHARS);
  }

  const model = getGeminiTtsModel();
  const ai = new GoogleGenAI({ apiKey });
  const voice = String(voiceName || DEFAULT_GEMINI_VOICE).trim() || DEFAULT_GEMINI_VOICE;

  const maxAttempts = 3;
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: input,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voice },
            },
          },
        },
      });

      const audio = extractInlineAudio(response);
      if (!audio) {
        const textPart = response?.candidates?.[0]?.content?.parts?.find((p) => p?.text);
        if (textPart?.text) {
          throw new Error(
            `Gemini TTS returned text instead of audio (try again): ${String(textPart.text).slice(0, 120)}`,
          );
        }
        throw new Error("Gemini TTS: no inline audio in response.");
      }

      const isWav =
        audio.mimeType.toLowerCase().includes("wav") ||
        audio.mimeType.toLowerCase().includes("wave");
      const rawPath = path.join(
        os.tmpdir(),
        `gemini_tts_${uuidv4()}.${isWav ? "wav" : "pcm"}`,
      );
      const mp3Path = path.join(os.tmpdir(), `gemini_tts_${uuidv4()}.mp3`);
      fs.writeFileSync(rawPath, audio.data);

      try {
        if (isWav) {
          const wr = spawnSync(
            ffmpegStatic,
            ["-y", "-i", rawPath, "-c:a", "libmp3lame", "-b:a", "128k", mp3Path],
            { encoding: "utf8" },
          );
          if (wr.status !== 0) {
            throw new Error(`ffmpeg WAV→MP3 failed: ${(wr.stderr || "").slice(0, 400)}`);
          }
        } else {
          pcmRawToMp3(rawPath, mp3Path);
        }
      } finally {
        try {
          fs.unlinkSync(rawPath);
        } catch {
          /* ignore */
        }
      }

      const durationSeconds = await getFileDuration(mp3Path);
      if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
        throw new Error("Gemini TTS: output MP3 has invalid duration.");
      }

      const usage = response.response.usageMetadata;

      return { audioPath: mp3Path, wordTimestamps: [], usage };
    } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts && isRetryableTtsError(err)) {
        const delay = 400 * attempt;
        console.warn(`[geminiTts] attempt ${attempt} failed, retrying in ${delay}ms:`, err.message);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  throw lastErr || new Error("Gemini TTS failed.");
};

module.exports = {
  VOICES_JSON,
  loadGeminiVoiceCatalog,
  getGeminiVoiceNames,
  isGeminiTtsConfigured,
  getGeminiTtsModel,
  selectBestGeminiVoice,
  synthesizeGeminiTts,
};
