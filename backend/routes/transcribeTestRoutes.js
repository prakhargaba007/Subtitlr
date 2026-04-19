const express = require("express");
const multer = require("multer");
const router = express.Router();

const isAuth = require("../middleware/is-auth");
const {
  testTranscribe,
  youtubeDownloadDebug,
} = require("../controllers/transcribeTestController");

const AUDIO_VIDEO_MIMES = new Set([
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
  limits: { fileSize: 500 * 1024 * 1024 },
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

router.post("/test", isAuth, upload.single("file"), testTranscribe);
router.post("/youtube-video", isAuth, youtubeDownloadDebug);

module.exports = router;
