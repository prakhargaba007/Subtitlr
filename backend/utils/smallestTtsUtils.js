const fs = require("fs");
const path = require("path");
const os = require("os");
const { v4: uuidv4 } = require("uuid");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegStatic = require("ffmpeg-static");
const ffprobeStatic = require("ffprobe-static");
const OpenAI = require("openai");
const { WavesClient, Configuration, GetWavesVoicesModelEnum } = require("smallestai");
const { getFileDuration } = require("./audioUtils");

ffmpeg.setFfmpegPath(ffmpegStatic);
ffmpeg.setFfprobePath(ffprobeStatic.path);

/** Fallback when getWavesVoices fails or key missing */
const SMALLEST_PRESET_VOICES = require("./data/smallestVoices.json");

let _waves = null;
const getWavesClient = () => {
  if (!_waves) {
    _waves = new WavesClient(new Configuration());
  }
  return _waves;
};

let _openai = null;
const getOpenAI = () => {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
};

const isSmallestConfigured = () => Boolean(String(process.env.SMALLEST_API_KEY || "").trim());

/**
 * Waves model: `lightning` | `lightning-large` (env SMALLEST_WAVES_MODEL)
 */
const getWavesModelKey = () => {
  const raw = String(process.env.SMALLEST_WAVES_MODEL || "lightning").trim().toLowerCase();
  if (raw === "lightning-large" || raw === "lightning_large") return "lightning-large";
  return "lightning";
};

const getVoicesModelEnum = () =>
  getWavesModelKey() === "lightning-large"
    ? GetWavesVoicesModelEnum.LightningLarge
    : GetWavesVoicesModelEnum.Lightning;

const getDefaultSmallestVoice = () =>
  String(process.env.SMALLEST_DEFAULT_VOICE || "emily").trim() || "emily";

const getForcedSmallestVoiceId = () => String(process.env.SMALLEST_FORCE_VOICE_ID || "").trim();

const wavToMp3 = (wavPath, mp3Path) =>
  new Promise((resolve, reject) => {
    ffmpeg(wavPath)
      .audioCodec("libmp3lame")
      .audioBitrate(128)
      .on("end", () => resolve())
      .on("error", reject)
      .save(mp3Path);
  });

/**
 * List Waves voices for the configured model. Falls back to JSON presets on error.
 */
const fetchSmallestVoiceCatalog = async () => {
  const clonePresets = () => SMALLEST_PRESET_VOICES.map((v) => ({ ...v }));

  if (!isSmallestConfigured()) return clonePresets();

  try {
    const client = getWavesClient();
    const res = await client.getWavesVoices(getVoicesModelEnum());
    const voices = res.data?.voices || [];
    if (!voices.length) return clonePresets();

    return voices.map((v) => {
      const tags = v.tags || {};
      const parts = [
        v.displayName,
        tags.gender,
        tags.accent,
        Array.isArray(tags.language) ? tags.language.join(", ") : tags.language,
      ].filter(Boolean);
      return { voiceId: v.voiceId, blurb: parts.join(" · ") || v.voiceId };
    });
  } catch (err) {
    console.warn("[smallestTts] getWavesVoices failed:", err.message);
    return clonePresets();
  }
};

/**
 * @param {string} voiceDescription
 * @param {Array<{voiceId:string, blurb:string}>} [catalog]
 * @returns {Promise<string>}
 */
const selectBestSmallestVoice = async (voiceDescription, catalog = null) => {
  const forced = getForcedSmallestVoiceId();
  if (forced) return forced;

  const presets =
    catalog && Array.isArray(catalog) && catalog.length ? catalog : SMALLEST_PRESET_VOICES;
  const voiceIds = presets.map((v) => v.voiceId);
  const fallback = getDefaultSmallestVoice();

  try {
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a voice casting assistant. Given a speaker description, pick exactly one Smallest.ai Waves voice_id " +
            "from the allowed list. Return ONLY valid JSON: " +
            '{ "voiceId": "<id>", "reason": "<one sentence>" }. ' +
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
      console.log(`[smallestTts] Voice match: ${id} — ${parsed.reason}`);
      return id;
    }
  } catch (err) {
    console.warn("[smallestTts] Voice matching failed, using default:", err.message);
  }

  return voiceIds.includes(fallback) ? fallback : presets[0].voiceId;
};

/**
 * Synthesize via Smallest Waves API, convert WAV to MP3 for the dubbing pipeline.
 *
 * @param {string} text
 * @param {string} voiceId
 * @returns {Promise<{ audioPath: string, durationSeconds: number }>}
 */
const synthesizeSmallestTts = async (text, voiceId) => {
  if (!isSmallestConfigured()) {
    throw new Error("SMALLEST_API_KEY is not set");
  }

  const model = getWavesModelKey();
  const sampleRate = Number(process.env.SMALLEST_SAMPLE_RATE || 24000) || 24000;
  const speed = Number(process.env.SMALLEST_SPEED ?? 1);
  const language = String(process.env.SMALLEST_LANGUAGE || "en").trim() || "en";

  const baseRequest = {
    text,
    voice_id: voiceId,
    add_wav_header: true,
    sample_rate: sampleRate,
    speed: Number.isFinite(speed) ? speed : 1,
    language,
  };

  const request =
    model === "lightning-large"
      ? {
          ...baseRequest,
          consistency: Number(process.env.SMALLEST_CONSISTENCY ?? 0.5),
          similarity: Number(process.env.SMALLEST_SIMILARITY ?? 0.5),
          enhancement:
            process.env.SMALLEST_ENHANCEMENT !== undefined
              ? Number(process.env.SMALLEST_ENHANCEMENT)
              : 1,
        }
      : baseRequest;

  const client = getWavesClient();
  const res = await client.synthesize(model, request);
  const data = res.data;
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);

  const wavPath = path.join(os.tmpdir(), `smallest_${uuidv4()}.wav`);
  const mp3Path = path.join(os.tmpdir(), `smallest_${uuidv4()}.mp3`);
  fs.writeFileSync(wavPath, buf);

  try {
    await wavToMp3(wavPath, mp3Path);
  } finally {
    try {
      fs.unlinkSync(wavPath);
    } catch (_) {}
  }

  const durationSeconds = await getFileDuration(mp3Path);
  return { audioPath: mp3Path, durationSeconds };
};

module.exports = {
  isSmallestConfigured,
  fetchSmallestVoiceCatalog,
  selectBestSmallestVoice,
  synthesizeSmallestTts,
  SMALLEST_PRESET_VOICES,
  getWavesModelKey,
};
