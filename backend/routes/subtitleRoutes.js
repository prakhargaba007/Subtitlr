const express = require("express");
const multer = require("multer");
const router = express.Router();

const isAuth = require("../middleware/is-auth");
const {
  prepareSubtitleStartFromS3,
} = require("../middleware/subtitlePrepareS3Input");
const AUDIO_VIDEO_MIMES = require("../constants/audioVideoMimes");
const {
  requestSubtitleUploadUrl,
  generateSubtitles,
  exportSubtitles,
  getSubtitleJobs,
  getSubtitleJob,
  getUserCredits,
  getCreditHistory,
  getCreditSummary,
  getLanguages,
} = require("../controllers/subtitleController");

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

// POST /api/subtitles/upload-url — presigned PUT (STORAGE_TYPE=s3 only)
router.post("/upload-url", isAuth, requestSubtitleUploadUrl);

function subtitleMultipartOrS3(req, res, next) {
  prepareSubtitleStartFromS3(req, res, (err) => {
    if (err) return next(err);
    if (req.subtitleTmpProbeFile) return next();
    upload.single("file")(req, res, next);
  });
}

// POST /api/subtitles/generate
// multipart: file + optional language, OR JSON: { s3Key, originalFileName, mimeType, language? }
router.post("/generate", isAuth, subtitleMultipartOrS3, generateSubtitles);

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
