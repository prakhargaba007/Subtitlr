const fs = require("fs");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegStatic = require("ffmpeg-static");
const ffprobeStatic = require("ffprobe-static");

ffmpeg.setFfmpegPath(ffmpegStatic);
ffmpeg.setFfprobePath(ffprobeStatic.path);

/**
 * Extract a single JPG frame from a video at a random timestamp.
 * - Keeps output small (width 320) for fast grids.
 * - Returns the chosen timestamp (seconds).
 */
async function extractRandomVideoThumbnailJpg(inputVideoPath, outputJpgPath) {
  await fs.promises.mkdir(path.dirname(outputJpgPath), { recursive: true });

  const duration = await new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputVideoPath, (err, metadata) => {
      if (err) return reject(err);
      resolve(Number(metadata?.format?.duration || 0));
    });
  });

  const safeDuration = Number.isFinite(duration) ? duration : 0;
  const maxT = Math.max(0, safeDuration - 1);
  const t = maxT > 1 ? 1 + Math.random() * (maxT - 1) : 0;

  await new Promise((resolve, reject) => {
    ffmpeg(inputVideoPath)
      .seekInput(t)
      .videoFilters("scale=320:-1")
      .outputOptions([
        "-frames:v 1",
        "-q:v 3",
        "-an",
        "-y",
      ])
      .output(outputJpgPath)
      .on("end", resolve)
      .on("error", reject)
      .run();
  });

  return { timestampSec: t, durationSec: safeDuration };
}

module.exports = {
  extractRandomVideoThumbnailJpg,
};

