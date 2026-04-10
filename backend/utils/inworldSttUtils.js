const fs = require("fs");
const path = require("path");
const os = require("os");
const { v4: uuidv4 } = require("uuid");
const { buildInworldAuthorizationHeader } = require("./inworldTtsUtils");
const { extractAudioWindow, cleanupPath } = require("./audioUtils");
const { isInworldVoiceProfileEnabled, inworldVoiceProfileMaxSegments } = require("./dubbingConfig");

const INWORLD_STT_URL = String(process.env.INWORLD_STT_URL || "https://api.inworld.ai/stt/v1/transcribe").trim();

const normLabels = (arr) => {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((x) => ({
      label: String(x.label ?? x.Label ?? "").trim(),
      confidence: Number(x.confidence ?? x.Confidence ?? 0) || 0,
    }))
    .filter((x) => x.label);
};

const pickVoiceProfile = (body) => {
  const vp = body.voiceProfile || body.voice_profile;
  if (!vp || typeof vp !== "object") return null;
  return {
    age: normLabels(vp.age),
    emotion: normLabels(vp.emotion),
    pitch: normLabels(vp.pitch),
    vocalStyle: normLabels(vp.vocalStyle || vp.vocal_style),
    accent: normLabels(vp.accent),
    source: "inworld_stt",
  };
};

/**
 * @param {Buffer|string} audioMp3 - file path or buffer of mp3
 * @param {{ language?: string }} [opts]
 */
const transcribeMp3WithVoiceProfile = async (audioMp3, opts = {}) => {
  const auth = buildInworldAuthorizationHeader();
  if (!auth) throw new Error("INWORLD_API_KEY is not set");

  let buf;
  if (Buffer.isBuffer(audioMp3)) buf = audioMp3;
  else buf = fs.readFileSync(audioMp3);

  const modelId = String(process.env.INWORLD_STT_MODEL || "groq/whisper-large-v3").trim();
  const language = String(opts.language || process.env.INWORLD_STT_LANGUAGE || "").trim() || undefined;

  const transcribeConfig = {
    modelId,
    audioEncoding: "MP3",
    voiceProfileConfig: {
      enableVoiceProfile: true,
      topN: Math.min(10, Math.max(1, parseInt(process.env.INWORLD_STT_VOICE_PROFILE_TOP_N || "5", 10) || 5)),
    },
  };
  if (language) transcribeConfig.language = language;

  const res = await fetch(INWORLD_STT_URL, {
    method: "POST",
    headers: {
      Authorization: auth,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      transcribeConfig,
      audioData: {
        content: buf.toString("base64"),
      },
    }),
  });

  const rawText = await res.text();
  let body;
  try {
    body = JSON.parse(rawText);
  } catch {
    body = { message: rawText };
  }

  if (!res.ok) {
    const msg = body?.message || rawText || res.statusText;
    const err = new Error(`Inworld STT ${res.status}: ${msg}`);
    err.statusCode = res.status;
    throw err;
  }

  return {
    transcript: body?.transcription?.transcript || "",
    voiceProfile: pickVoiceProfile(body),
    raw: body,
  };
};

/**
 * Build a short hint string for the translation model from voice profile + optional allowlist.
 */
const voiceProfileToHint = (vp, allowedVocalStyles) => {
  if (!vp) return "";
  const styles = (vp.vocalStyle || [])
    .filter((x) => x.confidence >= 0.35)
    .map((x) => x.label.toLowerCase());
  const allowed = allowedVocalStyles && allowedVocalStyles.length
    ? new Set(allowedVocalStyles.map((s) => s.toLowerCase()))
    : null;
  const filtered = allowed ? styles.filter((s) => allowed.has(s)) : styles;
  const topEmo = (vp.emotion || []).find((x) => x.confidence >= 0.35);
  const parts = [];
  if (topEmo) parts.push(`emotion:${topEmo.label}`);
  if (filtered.length) parts.push(`vocal:${filtered.slice(0, 3).join(",")}`);
  return parts.join("; ");
};

const DEFAULT_VOCAL_ALLOW = ["laughing", "whispering", "crying", "shouting", "singing"];

const getVocalStyleAllowlist = () => {
  const raw = String(process.env.DUBBING_VOCAL_STYLE_ALLOWLIST || "").trim();
  if (!raw) return DEFAULT_VOCAL_ALLOW;
  if (raw.toLowerCase() === "off") return [];
  return raw.split(/[\s,]+/).filter(Boolean);
};

/**
 * @param {Array<{start:number,end:number,text:string,speaker_id:string}>} segments
 * @param {string} audioPath - timeline-aligned full mix or vocals mp3
 * @returns {Promise<Array>} same segments with voiceProfile and voice_profile_hint
 */
const enrichSegmentsWithInworldVoiceProfile = async (segments, audioPath) => {
  if (!isInworldVoiceProfileEnabled() || !segments.length) {
    return segments.map((s) => ({ ...s, voice_profile_hint: s.voice_profile_hint || "" }));
  }

  const maxN = inworldVoiceProfileMaxSegments();
  const allowVocal = getVocalStyleAllowlist();
  const tmpToClean = [];
  const out = [];

  let used = 0;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (used >= maxN) {
      out.push({ ...seg, voice_profile_hint: seg.voice_profile_hint || "" });
      continue;
    }

    const dur = seg.end - seg.start;
    if (dur < 0.25 || dur > 120) {
      out.push({ ...seg, voice_profile_hint: seg.voice_profile_hint || "" });
      continue;
    }

    const slicePath = path.join(os.tmpdir(), `iwstt_${uuidv4()}.mp3`);
    tmpToClean.push(slicePath);
    try {
      await extractAudioWindow(audioPath, slicePath, seg.start, dur);
      const st = fs.statSync(slicePath);
      if (st.size > 24 * 1024 * 1024) {
        out.push({ ...seg, voice_profile_hint: seg.voice_profile_hint || "" });
        continue;
      }
      const { voiceProfile } = await transcribeMp3WithVoiceProfile(slicePath);
      used += 1;
      const hint = voiceProfileToHint(voiceProfile, allowVocal);
      out.push({
        ...seg,
        voiceProfile: voiceProfile || undefined,
        voice_profile_hint: [seg.voice_profile_hint, hint].filter(Boolean).join(" | "),
      });
    } catch (e) {
      console.warn("[inworldStt] segment profile failed:", e.message);
      out.push({ ...seg, voice_profile_hint: seg.voice_profile_hint || "" });
    }
  }

  tmpToClean.forEach(cleanupPath);
  return out;
};

module.exports = {
  transcribeMp3WithVoiceProfile,
  enrichSegmentsWithInworldVoiceProfile,
  voiceProfileToHint,
  getVocalStyleAllowlist,
};
