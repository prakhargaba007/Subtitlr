const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegStatic = require("ffmpeg-static");
const ffprobeStatic = require("ffprobe-static");

ffmpeg.setFfmpegPath(ffmpegStatic);
ffmpeg.setFfprobePath(ffprobeStatic.path);

/**
 * Get the duration of an audio/video file in seconds.
 */
const getFileDuration = (filePath) =>
  new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata.format.duration || 0);
    });
  });

/**
 * Lightweight stream list for debugging / routing (e.g. YouTube audio-only vs video).
 * @returns {Promise<{ hasVideo: boolean, formatName: string, streams: Array<{ index: number, codec_type: string, codec_name: string }> }>}
 */
const getMediaStreamSummary = (filePath) =>
  new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      const streams = (metadata.streams || []).map((s) => ({
        index: s.index,
        codec_type: String(s.codec_type || ""),
        codec_name: String(s.codec_name || ""),
      }));
      const hasVideo = streams.some((s) => s.codec_type === "video");
      resolve({
        hasVideo,
        formatName: String(metadata.format?.format_name || ""),
        streams,
      });
    });
  });

const fileHasVideoStream = async (filePath) => {
  const { hasVideo } = await getMediaStreamSummary(filePath);
  return hasVideo;
};

/**
 * Extract audio (mp3) from a video file, discarding the video stream.
 */
const extractAudio = (inputPath, outputPath) =>
  new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .noVideo()
      .audioCodec("libmp3lame")
      .audioBitrate(128)
      .output(outputPath)
      .on("end", resolve)
      .on("error", reject)
      .run();
  });

/**
 * Split an audio file into fixed-duration chunks.
 * Returns an array of absolute paths to the chunk files.
 */
const splitAudioIntoChunks = (inputPath, outputDir, segmentSeconds) =>
  new Promise((resolve, reject) => {
    const pattern = path.join(outputDir, "chunk_%03d.mp3");
    ffmpeg(inputPath)
      .audioCodec("libmp3lame")
      .audioBitrate(128)
      .outputOptions([
        "-f segment",
        `-segment_time ${segmentSeconds}`,
        "-reset_timestamps 1",
      ])
      .output(pattern)
      .on("end", () => {
        const files = fs
          .readdirSync(outputDir)
          .filter((f) => f.startsWith("chunk_"))
          .sort()
          .map((f) => path.join(outputDir, f));
        resolve(files);
      })
      .on("error", reject)
      .run();
  });

/**
 * Extract a time window from an audio file to MP3 (for aligned multi-stem chunks).
 */
const extractAudioWindow = (inputPath, outputPath, startSec, durationSec) =>
  new Promise((resolve, reject) => {
    const start = Math.max(0, startSec);
    const dur = Math.max(0.1, durationSec);
    ffmpeg(inputPath)
      .setStartTime(start)
      .duration(dur)
      .audioCodec("libmp3lame")
      .audioBitrate(128)
      .output(outputPath)
      .on("end", resolve)
      .on("error", reject)
      .run();
  });

/**
 * Concatenate multiple MP3 files (same codec) into one.
 */
const concatMp3Files = (inputPaths, outputPath) =>
  new Promise((resolve, reject) => {
    if (!inputPaths.length) {
      return reject(new Error("concatMp3Files: no inputs"));
    }
    if (inputPaths.length === 1) {
      fs.copyFileSync(inputPaths[0], outputPath);
      return resolve();
    }
    const listPath = `${outputPath}.concat.txt`;
    const body = inputPaths
      .map((p) => `file '${p.replace(/'/g, "'\\''")}'`)
      .join("\n");
    fs.writeFileSync(listPath, body);
    ffmpeg()
      .input(listPath)
      .inputOptions(["-f", "concat", "-safe", "0"])
      .outputOptions(["-c", "copy"])
      .output(outputPath)
      .on("end", () => {
        try {
          fs.unlinkSync(listPath);
        } catch (_) {}
        resolve();
      })
      .on("error", (err) => {
        try {
          fs.unlinkSync(listPath);
        } catch (_) {}
        reject(err);
      })
      .run();
  });

/**
 * Safely delete a path (file or directory). Swallows errors.
 */
const cleanupPath = (p) => {
  try {
    if (!fs.existsSync(p)) return;
    const stat = fs.statSync(p);
    if (stat.isDirectory()) {
      fs.rmSync(p, { recursive: true, force: true });
    } else {
      fs.unlinkSync(p);
    }
  } catch (_) {}
};

/** Seconds tolerance when comparing durations (MP3 frame / probe jitter). */
const DURATION_EPS = 0.12;

/**
 * If audio is shorter than minSeconds, pad with silence to at least minSeconds (re-encode MP3).
 * If already long enough, returns input path unchanged (does not write outputPath).
 *
 * @returns {Promise<{ path: string, padded: boolean, before: number, after: number }>}
 */
/**
 * Estimate when meaningful sound begins after leading silence (seconds from file start).
 * Uses ffmpeg silencedetect; returns 0 if parsing fails or file starts with non-silence.
 *
 * @param {string} filePath
 * @param {{ noiseDb?: number, minSilenceSec?: number }} [opts]
 * @returns {number}
 */
const detectLeadingSpeechOnsetSec = (filePath, opts = {}) => {
  if (!filePath || !fs.existsSync(filePath)) return 0;
  const noiseDb = Number.isFinite(opts.noiseDb) ? opts.noiseDb : -35;
  const minSilenceSec = Number.isFinite(opts.minSilenceSec)
    ? opts.minSilenceSec
    : 0.35;
  const af = `silencedetect=noise=${noiseDb}dB:d=${minSilenceSec}`;
  const r = spawnSync(
    ffmpegStatic,
    ["-hide_banner", "-nostats", "-i", filePath, "-af", af, "-f", "null", "-"],
    { encoding: "utf8", maxBuffer: 25 * 1024 * 1024 },
  );
  const combined = `${r.stderr || ""}\n${r.stdout || ""}`;
  const lines = combined.split(/\r?\n/);
  let pendingStart = null;
  for (const line of lines) {
    const ms = line.match(/silence_start:\s*([\d.]+)/);
    const me = line.match(/silence_end:\s*([\d.]+)/);
    if (ms) pendingStart = parseFloat(ms[1]);
    if (me) {
      const end = parseFloat(me[1]);
      if (pendingStart !== null && pendingStart <= 0.05) {
        return Number.isFinite(end) ? end : 0;
      }
      pendingStart = null;
    }
  }
  return 0;
};

const ensureMinAudioDuration = async (inputPath, minSeconds, outputPath) => {
  const before = await getFileDuration(inputPath);
  if (before >= minSeconds - DURATION_EPS) {
    return { path: inputPath, padded: false, before, after: before };
  }
  await new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioFilters(`apad=whole_dur=${minSeconds.toFixed(3)}`)
      .audioCodec("libmp3lame")
      .audioBitrate(192)
      .output(outputPath)
      .on("end", resolve)
      .on("error", reject)
      .run();
  });
  const after = await getFileDuration(outputPath);
  return { path: outputPath, padded: true, before, after };
};

module.exports = {
  getFileDuration,
  getMediaStreamSummary,
  fileHasVideoStream,
  extractAudio,
  extractAudioWindow,
  concatMp3Files,
  splitAudioIntoChunks,
  cleanupPath,
  ensureMinAudioDuration,
  detectLeadingSpeechOnsetSec,
  DURATION_EPS,
};
