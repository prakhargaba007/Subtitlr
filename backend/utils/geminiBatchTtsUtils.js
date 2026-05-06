/**
 * geminiBatchTtsUtils.js
 *
 * Batch TTS engine for the Gemini dubbing pipeline.
 *
 * Instead of one TTS API call per segment (60+ calls for a typical video),
 * this module batches all lines for a speaker into a single call, then
 * re-transcribes the output audio to recover per-segment timestamps for slicing.
 *
 * API call budget:
 *   ≤ 2 speakers → 1 TTS call (multi-speaker mode) + 1 re-transcription call
 *   3+ speakers  → N TTS calls (1 per speaker) + N re-transcription calls
 *
 * Re-transcription calls use the text model quota (not TTS quota), which has
 * a much higher limit — so they do not eat into the 30 RPM / 300 RPD TTS budget.
 */

"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawnSync } = require("child_process");
const { v4: uuidv4 } = require("uuid");
const { GoogleGenAI, Modality } = require("@google/genai");
const ffmpegStatic = require("ffmpeg-static");

const { getFileDuration } = require("./audioUtils");
const { callWithRetry: geminiCallWithRetry } = require("./geminiKeyManager");
const { transcribeWithSpeakers } = require("./transcribeUtils");
const { getGeminiTtsModel, getGeminiVoiceNames } = require("./geminiTtsUtils");

const DEFAULT_GEMINI_VOICE = "Kore";
/** Hard cap so we don't exceed TTS context limits */
const BATCH_MAX_CHARS = 14000;

// ── Script builders ───────────────────────────────────────────────────────────

/**
 * Build a single-speaker batch script from an array of translated segments.
 * Lines are separated by a blank line so the model treats each as a distinct utterance.
 *
 * @param {Array<{ text: string, tts_performance_hint?: string }>} segments
 * @returns {string}
 */
function buildBatchScript(segments) {
  return segments
    .map((seg, i) => {
      const line = (seg.tts_performance_hint || seg.text || "").trim();
      return `[Line ${i + 1}]: ${line}`;
    })
    .join("\n\n");
}

/**
 * Build an interleaved multi-speaker script for ≤ 2 speakers.
 * Speaker names are embedded inline so Gemini's multi-speaker mode can split them.
 *
 * @param {Array<{ speaker_id: string, text: string, tts_performance_hint?: string }>} segments
 * @returns {string}
 */
function buildMultiSpeakerScript(segments) {
  return segments
    .map((seg) => {
      const line = (seg.tts_performance_hint || seg.text || "").trim();
      return `${seg.speaker_id}: ${line}`;
    })
    .join("\n");
}

// ── Audio helpers ─────────────────────────────────────────────────────────────

function pcmOrWavToMp3(rawPath, isWav, mp3Path) {
  const args = isWav
    ? ["-y", "-i", rawPath, "-c:a", "libmp3lame", "-b:a", "128k", mp3Path]
    : [
        "-y",
        "-f", "s16le",
        "-ar", "24000",
        "-ac", "1",
        "-i", rawPath,
        "-c:a", "libmp3lame",
        "-b:a", "128k",
        mp3Path,
      ];
  const r = spawnSync(ffmpegStatic, args, { encoding: "utf8" });
  if (r.status !== 0) {
    throw new Error(
      `ffmpeg audio→MP3 failed (${r.status}): ${(r.stderr || r.stdout || "").slice(0, 500)}`,
    );
  }
}

function extractInlineAudio(response) {
  const parts = response?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return null;
  for (const p of parts) {
    const inline = p?.inlineData || p?.inline_data;
    if (inline?.data) {
      const mimeType = String(
        inline.mimeType || inline.mime_type || "application/octet-stream",
      );
      try {
        const data = Buffer.from(inline.data, "base64");
        if (data.length) return { data, mimeType };
      } catch {
        /* ignore */
      }
    }
  }
  return null;
}

/**
 * Slice a region from an audio file using ffmpeg.
 *
 * @param {string} srcPath   Source MP3/audio file
 * @param {number} startSec  Start position in seconds
 * @param {number} durSec    Duration in seconds
 * @param {string} outPath   Destination MP3 path
 */
function sliceAudioSegment(srcPath, startSec, durSec, outPath) {
  if (durSec <= 0) durSec = 0.1; // ffmpeg needs a positive duration
  const r = spawnSync(
    ffmpegStatic,
    [
      "-y",
      "-ss", String(startSec),
      "-t", String(durSec),
      "-i", srcPath,
      "-c:a", "libmp3lame",
      "-b:a", "128k",
      outPath,
    ],
    { encoding: "utf8" },
  );
  if (r.status !== 0) {
    throw new Error(
      `ffmpeg slice failed (${r.status}): ${(r.stderr || r.stdout || "").slice(0, 400)}`,
    );
  }
}

// ── TTS synthesis ─────────────────────────────────────────────────────────────

/**
 * Synthesize a single-speaker batch: all lines for one speaker in one TTS call.
 * The system instruction injects the rich voice persona.
 *
 * @param {string} script     Result of buildBatchScript()
 * @param {string} voiceName  Gemini prebuilt voice name (e.g. "Kore")
 * @param {string} persona    Rich voice_description string for system instruction
 * @returns {Promise<{ audioPath: string, usage: object }>}
 */
async function synthesizePerSpeakerBatch(script, voiceName, persona) {
  if (!script.trim()) throw new Error("geminiBatchTts: empty batch script");

  let input = script.trim();
  if (input.length > BATCH_MAX_CHARS) {
    console.warn(
      `[geminiBatchTts] Truncating batch script from ${input.length} to ${BATCH_MAX_CHARS} chars`,
    );
    input = input.slice(0, BATCH_MAX_CHARS);
  }

  const model = getGeminiTtsModel();
  const voice = String(voiceName || DEFAULT_GEMINI_VOICE).trim() || DEFAULT_GEMINI_VOICE;

  const systemInstruction = persona
    ? `You are an expert voice actor. Adopt the following persona for all audio generation:\n${persona}`
    : "You are an expert voice actor. Deliver natural, expressive speech.";

  console.log(
    `[geminiBatchTts] synthesizePerSpeakerBatch: voice=${voice}, script lines=${
      (input.match(/^\[Line \d+\]/gm) || []).length
    }, chars=${input.length}`,
  );

  const fullPrompt = systemInstruction ? `${systemInstruction}\n\n${input}` : input;

  console.log(`[geminiBatchTts] Full Prompt being sent:\n${fullPrompt}`);

  const response = await geminiCallWithRetry(async (apiKey) => {
    const ai = new GoogleGenAI({ apiKey });
    return await ai.models.generateContent({
      model,
      contents: fullPrompt,
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice },
          },
        },
      },
    });
  });

  const audio = extractInlineAudio(response);
  if (!audio) {
    throw new Error(
      "[geminiBatchTts] synthesizePerSpeakerBatch: no inline audio in response",
    );
  }

  const isWav =
    audio.mimeType.toLowerCase().includes("wav") ||
    audio.mimeType.toLowerCase().includes("wave");
  const ext = isWav ? "wav" : "pcm";
  const rawPath = path.join(os.tmpdir(), `gbatch_${uuidv4()}.${ext}`);
  const mp3Path = path.join(os.tmpdir(), `gbatch_${uuidv4()}.mp3`);
  fs.writeFileSync(rawPath, audio.data);

  try {
    pcmOrWavToMp3(rawPath, isWav, mp3Path);
  } finally {
    try { fs.unlinkSync(rawPath); } catch { /* ignore */ }
  }

  const duration = await getFileDuration(mp3Path);
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error("[geminiBatchTts] synthesizePerSpeakerBatch: output MP3 has invalid duration");
  }

  const usage = response.response?.usageMetadata ?? response.usageMetadata ?? {};
  console.log(
    `[geminiBatchTts] synthesizePerSpeakerBatch done: ${duration.toFixed(2)}s, tokens=${JSON.stringify(usage)}`,
  );

  return { audioPath: mp3Path, durationSec: duration, usage };
}

/**
 * Synthesize a multi-speaker batch (≤ 2 speakers) in a single TTS call.
 * Uses Gemini's multiSpeakerVoiceConfig.
 *
 * @param {string} script           Result of buildMultiSpeakerScript()
 * @param {Record<string,string>} speakerVoiceMap  speakerId → voiceName
 * @param {Record<string,string>} personaMap       speakerId → voice_description
 * @returns {Promise<{ audioPath: string, usage: object }>}
 */
async function synthesizeMultiSpeakerGemini(script, speakerVoiceMap, personaMap) {
  if (!script.trim()) throw new Error("geminiBatchTts: empty multi-speaker script");
  const speakerCount = Object.keys(speakerVoiceMap).length;
  if (speakerCount !== 2) {
    const err = new Error(`geminiBatchTts: multi-speaker mode requires exactly 2 speakers, but got ${speakerCount}`);
    err.code = "MULTI_SPEAKER_UNSUPPORTED";
    throw err;
  }

  let input = script.trim();
  if (input.length > BATCH_MAX_CHARS) {
    console.warn(
      `[geminiBatchTts] Truncating multi-speaker script from ${input.length} to ${BATCH_MAX_CHARS} chars`,
    );
    input = input.slice(0, BATCH_MAX_CHARS);
  }

  const model = getGeminiTtsModel();

  // Build speaker voice configs for multi-speaker mode
  const speakerVoiceConfigs = Object.entries(speakerVoiceMap).map(([speakerId, voiceName]) => ({
    speaker: speakerId,
    voiceConfig: {
      prebuiltVoiceConfig: {
        voiceName: voiceName || DEFAULT_GEMINI_VOICE,
      },
    },
  }));

  const personaSummary = Object.entries(personaMap || {})
    .map(([id, p]) => `${id}: ${p}`)
    .join("\n");
  const systemInstruction = personaSummary
    ? `You are an expert voice actor performing multiple characters. Personas:\n${personaSummary}`
    : "You are an expert voice actor performing multiple characters naturally.";

  console.log(
    `[geminiBatchTts] synthesizeMultiSpeakerGemini: speakers=${Object.keys(speakerVoiceMap).join(",")}, chars=${input.length}`,
  );

  const fullPrompt = systemInstruction ? `${systemInstruction}\n\n${input}` : input;

  console.log(`[geminiBatchTts] Full Multi-Speaker Prompt being sent:\n${fullPrompt}`);

  const response = await geminiCallWithRetry(async (apiKey) => {
    const ai = new GoogleGenAI({ apiKey });
    return await ai.models.generateContent({
      model,
      contents: fullPrompt,
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          multiSpeakerVoiceConfig: {
            speakerVoiceConfigs,
          },
        },
      },
    });
  });

  const audio = extractInlineAudio(response);
  if (!audio) {
    // Multi-speaker may not be supported on this model — caller should catch and fall back
    const err = new Error(
      "[geminiBatchTts] synthesizeMultiSpeakerGemini: no inline audio — multi-speaker may not be supported on this model",
    );
    err.code = "MULTI_SPEAKER_UNSUPPORTED";
    throw err;
  }

  const isWav =
    audio.mimeType.toLowerCase().includes("wav") ||
    audio.mimeType.toLowerCase().includes("wave");
  const rawPath = path.join(os.tmpdir(), `gbatch_ms_${uuidv4()}.${isWav ? "wav" : "pcm"}`);
  const mp3Path = path.join(os.tmpdir(), `gbatch_ms_${uuidv4()}.mp3`);
  fs.writeFileSync(rawPath, audio.data);

  try {
    pcmOrWavToMp3(rawPath, isWav, mp3Path);
  } finally {
    try { fs.unlinkSync(rawPath); } catch { /* ignore */ }
  }

  const duration = await getFileDuration(mp3Path);
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error("[geminiBatchTts] synthesizeMultiSpeakerGemini: output MP3 has invalid duration");
  }

  const usage = response.response?.usageMetadata ?? response.usageMetadata ?? {};
  console.log(
    `[geminiBatchTts] synthesizeMultiSpeakerGemini done: ${duration.toFixed(2)}s`,
  );

  return { audioPath: mp3Path, durationSec: duration, usage };
}

// ── Timestamp recovery ────────────────────────────────────────────────────────

/**
 * Re-transcribe a batch MP3 to recover per-line timestamps.
 * Uses the existing transcribeWithSpeakers() which already has key rotation.
 *
 * Returns an array of { start, end } objects aligned to the expectedLineCount.
 * If fewer segments are returned than expected, the remainder get proportional fallback slots.
 *
 * @param {string} batchAudioPath
 * @param {number} expectedLineCount  Number of lines we sent to TTS
 * @param {string[]} [expectedTexts]  Optional original texts to guide the re-transcription
 * @returns {Promise<Array<{ start: number, end: number }>>}
 */
async function recoverTimestampsViaRetranscription(batchAudioPath, expectedLineCount, expectedTexts = []) {
  console.log(
    `[geminiBatchTts] recoverTimestamps: re-transcribing ${batchAudioPath} (expecting ${expectedLineCount} lines)`,
  );

  const guidedScript = expectedTexts
    .map((t) => String(t || "").replace(/\[.*?\]/g, "").trim())
    .filter(Boolean)
    .join("\n");

  const { segments } = await transcribeWithSpeakers(batchAudioPath, "auto", {
    guidedScript: guidedScript || null,
  });

  const totalDuration = await getFileDuration(batchAudioPath);

  if (!segments.length) {
    // Nothing transcribed — fall back to even slices
    console.warn("[geminiBatchTts] recoverTimestamps: no segments returned, using even slices");
    return evenSliceFallback(totalDuration, expectedLineCount);
  }

  // Map transcribed segments to our expected line count.
  // Gemini may merge/split lines slightly, so we bin by index.
  const result = [];
  for (let i = 0; i < expectedLineCount; i++) {
    if (i < segments.length) {
      result.push({ start: segments[i].start, end: segments[i].end });
    } else {
      // More lines than transcribed segments — extend last segment to end
      const prev = result[result.length - 1] || { start: 0, end: totalDuration };
      const sliceSize = (totalDuration - prev.end) / (expectedLineCount - i);
      result.push({
        start: prev.end,
        end: Math.min(prev.end + sliceSize, totalDuration),
      });
    }
  }

  console.log(
    `[geminiBatchTts] recoverTimestamps: mapped ${segments.length} transcribed → ${result.length} slots`,
  );
  return result;
}

/** Even-duration fallback when re-transcription returns nothing. */
function evenSliceFallback(totalDuration, count) {
  const sliceDur = totalDuration / count;
  return Array.from({ length: count }, (_, i) => ({
    start: i * sliceDur,
    end: (i + 1) * sliceDur,
  }));
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  buildBatchScript,
  buildMultiSpeakerScript,
  synthesizePerSpeakerBatch,
  synthesizeMultiSpeakerGemini,
  recoverTimestampsViaRetranscription,
  sliceAudioSegment,
};
