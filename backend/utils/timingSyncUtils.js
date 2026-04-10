const fs = require("fs");
const path = require("path");
const os = require("os");
const { v4: uuidv4 } = require("uuid");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegStatic = require("ffmpeg-static");
const ffprobeStatic = require("ffprobe-static");
const { getDubbingMaxAtempo } = require("./dubbingConfig");
const { getFileDuration } = require("./audioUtils");

ffmpeg.setFfmpegPath(ffmpegStatic);
ffmpeg.setFfprobePath(ffprobeStatic.path);

// Minimum duration ratio below which we pad with silence rather than slow down
const MIN_ATEMPO = 0.85;

/**
 * @param {number} maxAtempo - Upper bound for speed-up (e.g. 1.5 or 1.0)
 */
const atempoStretch = (inputPath, targetDuration, outputPath, maxAtempo = getDubbingMaxAtempo()) =>
  new Promise((resolve, reject) => {
    getFileDuration(inputPath).then((actualDuration) => {
      if (actualDuration <= 0) return reject(new Error("Cannot get audio duration"));

      const cap = Math.max(0.5, Math.min(2.0, maxAtempo));
      const ratio = actualDuration / targetDuration;
      const clampedRatio = Math.min(cap, Math.max(MIN_ATEMPO, ratio));

      const filters = [];
      let remaining = clampedRatio;
      while (remaining > 2.0) {
        filters.push("atempo=2.0");
        remaining /= 2.0;
      }
      while (remaining < 0.5) {
        filters.push("atempo=0.5");
        remaining /= 0.5;
      }
      filters.push(`atempo=${remaining.toFixed(4)}`);

      ffmpeg(inputPath)
        .audioFilters(filters.join(","))
        .output(outputPath)
        .on("end", resolve)
        .on("error", reject)
        .run();
    });
  });

const padWithSilence = (inputPath, targetDuration, outputPath) =>
  new Promise(async (resolve, reject) => {
    const actualDuration = await getFileDuration(inputPath);
    const silenceDuration = targetDuration - actualDuration;

    if (silenceDuration <= 0) {
      fs.copyFileSync(inputPath, outputPath);
      return resolve();
    }

    ffmpeg(inputPath)
      .audioFilters(`apad=whole_dur=${targetDuration.toFixed(3)}`)
      .output(outputPath)
      .on("end", resolve)
      .on("error", reject)
      .run();
  });

/**
 * @param {string} audioPath
 * @param {number} originalDuration
 * @param {{ maxAtempo?: number }} [opts]
 */
const syncSegmentTiming = async (audioPath, originalDuration, opts = {}) => {
  const maxAtempo = opts.maxAtempo != null ? opts.maxAtempo : getDubbingMaxAtempo();
  const actualDuration = await getFileDuration(audioPath);
  const outputPath = path.join(os.tmpdir(), `synced_${uuidv4()}.mp3`);

  let strategy;

  if (actualDuration <= originalDuration) {
    await padWithSilence(audioPath, originalDuration, outputPath);
    strategy = "padded";
  } else {
    const requiredRatio = actualDuration / originalDuration;

    if (requiredRatio <= maxAtempo) {
      await atempoStretch(audioPath, originalDuration, outputPath, maxAtempo);
      strategy = "stretched";
    } else {
      const maxOutputDuration = actualDuration / maxAtempo;
      await atempoStretch(audioPath, maxOutputDuration, outputPath, maxAtempo);
      strategy = "stretched_capped";
    }
  }

  const adjustedDuration = await getFileDuration(outputPath);

  return {
    adjustedPath: outputPath,
    originalDuration,
    actualDuration,
    adjustedDuration,
    strategy,
  };
};

const buildTimeline = (segments, syncedBuffers) => {
  return segments.map((seg, i) => ({
    start: seg.start,
    end: seg.end,
    speaker_id: seg.speaker_id,
    translatedText: seg.translatedText,
    adjustedPath: syncedBuffers[i].adjustedPath,
    adjustedDuration: syncedBuffers[i].adjustedDuration,
    strategy: syncedBuffers[i].strategy,
  }));
};

module.exports = {
  syncSegmentTiming,
  buildTimeline,
  atempoStretch,
  padWithSilence,
};
