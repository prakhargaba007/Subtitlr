const fs = require("fs");
const path = require("path");
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

module.exports = {
  getFileDuration,
  extractAudio,
  splitAudioIntoChunks,
  cleanupPath,
};
