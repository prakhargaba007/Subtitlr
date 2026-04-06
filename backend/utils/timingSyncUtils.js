const fs = require("fs");
const path = require("path");
const os = require("os");
const { v4: uuidv4 } = require("uuid");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegStatic = require("ffmpeg-static");
const ffprobeStatic = require("ffprobe-static");
const { getFileDuration, cleanupPath } = require("./audioUtils");

ffmpeg.setFfmpegPath(ffmpegStatic);
ffmpeg.setFfprobePath(ffprobeStatic.path);

// Maximum speed-up factor to preserve speech naturalness (1.5 = 50% faster)
const MAX_ATEMPO = 1.5;

// Minimum duration ratio below which we pad with silence rather than slow down
// (slowing down dubbed audio rarely sounds good)
const MIN_ATEMPO = 0.85;

/**
 * Stretch or compress an audio file to match a target duration using ffmpeg atempo.
 * Chains multiple atempo filters if the ratio exceeds the single-filter limit of 2.0x.
 *
 * @param {string} inputPath - Source audio file
 * @param {number} targetDuration - Desired duration in seconds
 * @param {string} outputPath - Where to write the adjusted audio
 * @returns {Promise<void>}
 */
const atempoStretch = (inputPath, targetDuration, outputPath) =>
  new Promise((resolve, reject) => {
    getFileDuration(inputPath).then((actualDuration) => {
      if (actualDuration <= 0) return reject(new Error("Cannot get audio duration"));

      const ratio = actualDuration / targetDuration; // > 1 means speed up, < 1 means slow down
      const clampedRatio = Math.min(MAX_ATEMPO, Math.max(MIN_ATEMPO, ratio));

      // Build chained atempo filters (each filter accepts 0.5–2.0 range)
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

/**
 * Pad an audio file with silence at the end to reach a target duration.
 *
 * @param {string} inputPath
 * @param {number} targetDuration
 * @param {string} outputPath
 * @returns {Promise<void>}
 */
const padWithSilence = (inputPath, targetDuration, outputPath) =>
  new Promise(async (resolve, reject) => {
    const actualDuration = await getFileDuration(inputPath);
    const silenceDuration = targetDuration - actualDuration;

    if (silenceDuration <= 0) {
      // Already long enough — just copy
      fs.copyFileSync(inputPath, outputPath);
      return resolve();
    }

    // apad filter appends silence until the stream reaches `whole_dur`
    ffmpeg(inputPath)
      .audioFilters(`apad=whole_dur=${targetDuration.toFixed(3)}`)
      .output(outputPath)
      .on("end", resolve)
      .on("error", reject)
      .run();
  });

/**
 * Adjust a single dubbed audio segment to fit within its original timing slot.
 *
 * Strategy:
 *   - If dubbed duration ≤ original → pad with silence (keeps timing tight)
 *   - If dubbed duration > original AND speedup ≤ MAX_ATEMPO → speed up
 *   - If required speedup > MAX_ATEMPO → speed up to MAX_ATEMPO (audio will overrun slightly)
 *
 * @param {string} audioPath - Path to the dubbed segment audio file
 * @param {number} originalDuration - Original segment duration in seconds
 * @returns {Promise<{adjustedPath:string, originalDuration:number, actualDuration:number, adjustedDuration:number, strategy:string}>}
 */
const syncSegmentTiming = async (audioPath, originalDuration) => {
  const actualDuration = await getFileDuration(audioPath);
  const outputPath = path.join(os.tmpdir(), `synced_${uuidv4()}.mp3`);

  let strategy;

  if (actualDuration <= originalDuration) {
    // Dubbed is shorter or equal — pad with silence to fill the slot
    await padWithSilence(audioPath, originalDuration, outputPath);
    strategy = "padded";
  } else {
    const requiredRatio = actualDuration / originalDuration;

    if (requiredRatio <= MAX_ATEMPO) {
      // Speed up to fit exactly
      await atempoStretch(audioPath, originalDuration, outputPath);
      strategy = "stretched";
    } else {
      // Can't fit without distortion — speed up to max, accept slight overrun
      const maxOutputDuration = actualDuration / MAX_ATEMPO;
      await atempoStretch(audioPath, maxOutputDuration, outputPath);
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

/**
 * Build the final timeline by combining segment metadata with synced audio paths.
 * Each entry specifies exactly when (offset) in the full audio the segment should play.
 *
 * @param {Array<{start:number, end:number, speaker_id:string, translatedText:string}>} segments
 * @param {Array<{adjustedPath:string, adjustedDuration:number, strategy:string}>} syncedBuffers
 * @returns {Array<{start:number, end:number, speaker_id:string, adjustedPath:string, adjustedDuration:number, strategy:string}>}
 */
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
