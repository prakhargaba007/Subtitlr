const os = require("os");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const ytdlp = require("yt-dlp-exec");
const ffmpegStatic = require("ffmpeg-static");
const { cleanupPath, getMediaStreamSummary } = require("./audioUtils");

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

/** Override with YT_DLP_FORMAT if you need stricter selection. */
const DEFAULT_YT_FORMAT =
  process.env.YT_DLP_FORMAT || "bestvideo+bestaudio/best";

/** MKV merges VP9+Opus without re-encoding; override with YT_DLP_MERGE_OUTPUT. */
const DEFAULT_MERGE_OUTPUT = process.env.YT_DLP_MERGE_OUTPUT || "mp4";

const YT_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "www.youtu.be",
]);

function normalizeYoutubeUrl(raw) {
  const value = String(raw || "").trim();
  if (!value) {
    const err = new Error("youtubeUrl is required.");
    err.statusCode = 422;
    throw err;
  }

  let u;
  try {
    u = new URL(value);
  } catch {
    const err = new Error("Invalid YouTube URL.");
    err.statusCode = 422;
    throw err;
  }

  const host = (u.hostname || "").toLowerCase();
  if (!YT_HOSTS.has(host)) {
    const err = new Error("Only YouTube links are supported.");
    err.statusCode = 422;
    throw err;
  }

  u.hash = "";
  return u.toString();
}

async function getYoutubeMetadata(url, { ytDlpPath } = {}) {
  const bin = String(ytDlpPath || process.env.YT_DLP_PATH || "").trim();
  const parsed = await (bin ? ytdlp.create(bin) : ytdlp)(url, {
    noPlaylist: true,
    dumpSingleJson: true,
    noWarnings: true,
  });

  const duration = Number(parsed?.duration || 0);
  const title = String(parsed?.title || "").trim() || "youtube_video";
  return { duration, title };
}

function createYtExec(ytDlpPath) {
  const bin = String(ytDlpPath || process.env.YT_DLP_PATH || "").trim();
  return bin ? ytdlp.create(bin) : ytdlp;
}

async function resolveDownloadedFile(tmpDir, base) {
  const merged = [".mkv", ".mp4"]
    .map((ext) => path.join(tmpDir, `${base}${ext}`))
    .find((p) => fs.existsSync(p));
  if (merged) return merged;

  const candidates = fs
    .readdirSync(tmpDir)
    .filter((f) => f.startsWith(`${base}.`))
    .map((f) => path.join(tmpDir, f));

  for (const c of candidates) {
    try {
      const s = await getMediaStreamSummary(c);
      if (s.hasVideo) return c;
    } catch (_) {}
  }

  return candidates[0] || null;
}

/**
 * Download merged video+audio (yt-dlp merges when ffmpeg is available).
 * @returns {Promise<{ filePath: string }>}
 */
async function downloadYoutubeToMp4(url, opts = {}) {
  const { ytDlpPath, timeoutMs = DEFAULT_TIMEOUT_MS } = opts;
  const exec = createYtExec(ytDlpPath);
  const tmpDir = os.tmpdir();
  const base = `yt_${uuidv4()}`;
  const outTemplate = path.join(tmpDir, `${base}.%(ext)s`);

  try {
    await exec.exec(
      url,
      {
        noPlaylist: true,
        format: DEFAULT_YT_FORMAT,
        mergeOutputFormat: DEFAULT_MERGE_OUTPUT,
        ffmpegLocation: ffmpegStatic,
        output: outTemplate,
      },
      { timeout: timeoutMs },
    );
  } catch (e) {
    const err = new Error(e?.stderr || e?.message || "yt-dlp failed.");
    err.statusCode = e?.timedOut ? 504 : 422;
    throw err;
  }

  const filePath = await resolveDownloadedFile(tmpDir, base);
  if (!filePath) {
    const err = new Error("yt-dlp did not produce an output file.");
    err.statusCode = 422;
    throw err;
  }

  return { filePath };
}

/**
 * Metadata + file download run in parallel (faster when duration limit passes).
 * If DUBBING_MAX_DURATION_SECONDS is set and exceeded, the downloaded file is removed.
 */
async function downloadYoutubeVideo(url, opts = {}) {
  const normalizedUrl = normalizeYoutubeUrl(url);
  const maxDur = Number(process.env.DUBBING_MAX_DURATION_SECONDS || 0);

  const [meta, { filePath }] = await Promise.all([
    getYoutubeMetadata(normalizedUrl, opts),
    downloadYoutubeToMp4(normalizedUrl, opts),
  ]);

  if (maxDur > 0 && meta.duration > maxDur) {
    cleanupPath(filePath);
    const err = new Error(
      `Video is too long (${Math.round(meta.duration)}s). Max allowed is ${Math.round(maxDur)}s.`,
    );
    err.statusCode = 413;
    throw err;
  }

  return {
    youtubeUrl: normalizedUrl,
    title: meta.title,
    durationSeconds: meta.duration,
    filePath,
  };
}

module.exports = {
  normalizeYoutubeUrl,
  getYoutubeMetadata,
  downloadYoutubeVideo,
  downloadYoutubeToMp4,
  cleanupYoutubeDownload: cleanupPath,
};
