const express = require("express");
const multer = require("multer");
const router = express.Router();

const isAuth = require("../middleware/is-auth");
const {
  generateSubtitles,
  exportSubtitles,
  getSubtitleJobs,
  getSubtitleJob,
  getUserCredits,
  getCreditHistory,
  getCreditSummary,
  getLanguages,
} = require("../controllers/subtitleController");

// Accepted MIME types for audio and video files
const AUDIO_VIDEO_MIMES = new Set([
  // Audio
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/ogg",
  "audio/flac",
  "audio/aac",
  "audio/mp4",
  "audio/webm",
  "audio/x-m4a",
  "audio/m4a",
  "audio/x-flac",
  // Video
  "video/mp4",
  "video/mpeg",
  "video/quicktime",
  "video/x-msvideo",
  "video/webm",
  "video/x-matroska",
  "video/3gpp",
  "video/3gpp2",
  "video/x-flv",
  "video/x-ms-wmv",
  "video/ogg",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB
  fileFilter: (_req, file, cb) => {
    if (AUDIO_VIDEO_MIMES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `Unsupported file type "${file.mimetype}". Please upload an audio or video file.`
        ),
        false
      );
    }
  },
});

// GET /api/subtitles/languages  (public — no auth)
router.get("/languages", getLanguages);

// POST /api/subtitles/generate
// Body: multipart/form-data — field "file" (audio/video) + optional field "language"
router.post("/generate", isAuth, upload.single("file"), generateSubtitles);

// GET /api/subtitles/credits
router.get("/credits", isAuth, getUserCredits);

// GET /api/subtitles/credits/history?page=1&limit=10
router.get("/credits/history", isAuth, getCreditHistory);

// GET /api/subtitles/credits/summary
router.get("/credits/summary", isAuth, getCreditSummary);

// GET /api/subtitles/:id/export?format=srt|vtt|ass
router.get("/:id/export", isAuth, exportSubtitles);

// GET /api/subtitles/:id
router.get("/:id", isAuth, getSubtitleJob);

// GET /api/subtitles?page=1&limit=10
router.get("/", isAuth, getSubtitleJobs);

module.exports = router;
