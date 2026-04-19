const fs = require("fs");
const path = require("path");
const os = require("os");
const { v4: uuidv4 } = require("uuid");
const { extractAudio, getMediaStreamSummary } = require("../utils/audioUtils");
const { transcribeWithSpeakers } = require("../utils/transcribeUtils");
const {
  normalizeYoutubeUrl,
  getYoutubeMetadata,
  downloadYoutubeToMp4,
  cleanupYoutubeDownload,
} = require("../utils/youtubeDownloadUtils");

function safeYoutubeDebugFilename(title, ext) {
  const part = String(title || "youtube")
    .replace(/[/\\?%*:|"<>]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return `${part || "youtube"}_${uuidv4()}${ext}`;
}

/**
 * POST /api/transcribe/test
 * Multipart: file (audio/video), optional sourceLanguage (e.g. english, hinglish, auto).
 * Runs Gemini dubbing-style transcription on extracted MP3 (full mix, no stem separation).
 */
exports.testTranscribe = async (req, res, next) => {
  try {
    if (!req.file?.buffer) {
      return res.status(422).json({ message: 'Missing file. Send multipart field "file".' });
    }
    if (!String(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "").trim()) {
      return res.status(422).json({
        message: "GOOGLE_API_KEY or GEMINI_API_KEY is required for transcription.",
      });
    }

    const sourceLanguageRaw = (req.body.sourceLanguage || "").trim();
    const sourceLanguage =
      !sourceLanguageRaw || sourceLanguageRaw.toLowerCase() === "auto"
        ? null
        : sourceLanguageRaw;

    const isVideo = req.file.mimetype.startsWith("video/");
    const ext = path.extname(req.file.originalname) || (isVideo ? ".mp4" : ".bin");
    const tmpInput = path.join(os.tmpdir(), `transcribe_test_in_${uuidv4()}${ext}`);
    const tmpMp3 = path.join(os.tmpdir(), `transcribe_test_${uuidv4()}.mp3`);

    fs.writeFileSync(tmpInput, req.file.buffer);

    try {
      await extractAudio(tmpInput, tmpMp3);
      const { segments, speaker_profiles } = await transcribeWithSpeakers(
        tmpMp3,
        sourceLanguage,
        null
      );
      return res.json({
        ok: true,
        segments,
        speaker_profiles,
        segmentCount: segments.length,
        speakerCount: speaker_profiles.length,
      });
    } finally {
      try {
        fs.unlinkSync(tmpInput);
      } catch {
        /* ignore */
      }
      try {
        fs.unlinkSync(tmpMp3);
      } catch {
        /* ignore */
      }
    }
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/transcribe/youtube-video
 * JSON body: { youtubeUrl }
 * Gated by ENABLE_YOUTUBE_DEBUG=1 or NODE_ENV !== production.
 * Downloads with same yt-dlp settings as dubbing, saves a copy under tmp/youtube-video (or YOUTUBE_VIDEO_DEBUG_SAVE_DIR),
 * returns metadata + ffprobe stream summary; temp download is removed after copy.
 */
exports.youtubeDownloadDebug = async (req, res) => {
  const debugOk =
    process.env.ENABLE_YOUTUBE_DEBUG === "1" ||
    process.env.NODE_ENV !== "production";
  if (!debugOk) {
    return res.status(404).json({ message: "Not found." });
  }

  const youtubeUrlRaw = (req.body?.youtubeUrl || "").trim();
  if (!youtubeUrlRaw) {
    return res.status(422).json({ message: 'Missing youtubeUrl in JSON body.' });
  }

  let filePath = null;
  try {
    const normalizedUrl = normalizeYoutubeUrl(youtubeUrlRaw);
    const meta = await getYoutubeMetadata(normalizedUrl);
    const { filePath: fp } = await downloadYoutubeToMp4(normalizedUrl);
    filePath = fp;

    const summary = await getMediaStreamSummary(filePath);

    const ext = path.extname(filePath) || ".mp4";
    const saveDir = path.resolve(
      process.env.YOUTUBE_VIDEO_DEBUG_SAVE_DIR ||
        path.join(__dirname, "..", "tmp", "youtube-video"),
    );
    fs.mkdirSync(saveDir, { recursive: true });
    const savedBasename = safeYoutubeDebugFilename(meta.title, ext);
    const savedPath = path.join(saveDir, savedBasename);
    fs.copyFileSync(filePath, savedPath);

    return res.json({
      ok: true,
      youtubeUrl: normalizedUrl,
      title: meta.title,
      durationSeconds: meta.duration,
      downloadedBasename: path.basename(filePath),
      savedPath,
      savedBasename,
      hasVideo: summary.hasVideo,
      formatName: summary.formatName,
      streams: summary.streams,
    });
  } catch (err) {
    const status = err.statusCode || 500;
    return res.status(status).json({
      ok: false,
      message: err.message || "YouTube debug download failed.",
    });
  } finally {
    if (filePath) cleanupYoutubeDownload(filePath);
  }
};
