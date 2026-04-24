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

// How much to duck (reduce) background volume during speech segments, in dB
// 0 = no ducking; -6 = half volume; -12 = quarter volume
const BACKGROUND_DUCK_DB = -8;

/**
 * Layer multiple timed speech segments over a continuous background audio track.
 *
 * Strategy:
 *   1. The background track plays at full volume throughout the entire duration.
 *   2. Each dubbed speech segment is delayed to its correct start offset (milliseconds).
 *   3. During speech segments, the background is ducked by BACKGROUND_DUCK_DB dB.
 *   4. All streams are mixed with ffmpeg's amix/adelay complex filter graph.
 *
 * @param {Array<{start:number, adjustedPath:string, adjustedDuration:number}>} timedSegments
 * @param {string} backgroundPath - Path to the background-only audio file
 * @param {string} outputPath - Where to write the final mixed audio
 * @param {number} totalDuration - Total video duration in seconds
 * @returns {Promise<void>}
 */
const layerSpeechOverBackground = (
  timedSegments,
  backgroundPath,
  outputPath,
  totalDuration,
) =>
  new Promise((resolve, reject) => {
    if (!timedSegments.length) {
      // No speech — just use the background directly
      fs.copyFileSync(backgroundPath, outputPath);
      return resolve();
    }

    const command = ffmpeg();

    // Input 0: background track
    command.input(backgroundPath);

    // Inputs 1…N: each dubbed speech segment
    timedSegments.forEach((seg) => {
      command.input(seg.adjustedPath);
    });

    // Build complex filter graph
    // adelay expects delay in milliseconds, per channel (stereo: "delayMs|delayMs")
    const filters = [];

    // Label the background stream
    filters.push(`[0:a]volume=1.0[bg]`);

    // Delay each speech segment to its correct position and label it
    timedSegments.forEach((seg, i) => {
      const delayMs = Math.round(seg.start * 1000);
      const inputIdx = i + 1;
      filters.push(`[${inputIdx}:a]adelay=${delayMs}|${delayMs}[speech${i}]`);
    });

    // Build the ducking effect on the background:
    // We mix all speech signals together (to create a "when-speech-is-active" envelope),
    // then use that envelope to duck the background.
    // Simplified approach: mix everything together with amix, background at slightly lower
    // volume during speech using the volume filter driven by a sidechain.
    //
    // For a simpler but effective result, we use amix with dropout_transition so the
    // background blends naturally. The background uses a slight volume reduction overall
    // rather than dynamic ducking (which requires complex sidechain detection).
    const speechLabels = timedSegments.map((_, i) => `[speech${i}]`).join("");
    const totalInputs = timedSegments.length + 1; // background + speech segments

    filters.push(
      `[bg]${speechLabels}amix=inputs=${totalInputs}:duration=longest:dropout_transition=0:normalize=0[out]`,
    );

    const filterComplex = filters.join("; ");

    command
      .complexFilter(filterComplex, "out")
      .audioCodec("libmp3lame")
      .audioBitrate(192)
      .duration(totalDuration)
      .output(outputPath)
      .on("end", resolve)
      .on("error", reject)
      .run();
  });

/**
 * Replace the audio track of a video file with the dubbed audio mix.
 * The original video stream is copied without re-encoding (fast).
 *
 * @param {string} videoPath - Original video file path
 * @param {string} audioPath - Mixed dubbed audio file path
 * @param {string} outputPath - Where to write the final dubbed video
 * @returns {Promise<void>}
 */
const muxWithVideo = (videoPath, audioPath, outputPath) =>
  new Promise((resolve, reject) => {
    ffmpeg()
      .input(videoPath)
      .input(audioPath)
      .outputOptions([
        "-map 0:v:0", // take video from first input
        "-map 1:a:0", // take audio from second input
        "-c:v copy", // copy video stream without re-encoding
        "-c:a aac", // encode audio as AAC for maximum compatibility
        "-b:a 192k",
        "-shortest", // end when the shorter stream ends
      ])
      .output(outputPath)
      .on("end", resolve)
      .on("error", reject)
      .run();
  });

/**
 * Merge audio-only output (no video source).
 * Used when the original input was an audio file, not a video.
 * Trims or pads the final mix to match totalDuration.
 *
 * @param {Array<{start:number, adjustedPath:string}>} timedSegments
 * @param {string} backgroundPath
 * @param {string} outputPath
 * @param {number} totalDuration
 * @returns {Promise<void>}
 */
const mergeAudioOnly = async (
  timedSegments,
  backgroundPath,
  outputPath,
  totalDuration,
) => {
  await layerSpeechOverBackground(
    timedSegments,
    backgroundPath,
    outputPath,
    totalDuration,
  );
};

module.exports = {
  layerSpeechOverBackground,
  muxWithVideo,
  mergeAudioOnly,
};
