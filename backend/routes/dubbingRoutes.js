const express = require("express");
const multer = require("multer");
const router = express.Router();

const isAuth = require("../middleware/is-auth");
const {
  startDubbingJob,
  getDubbingJob,
  getDubbingJobs,
  getDubbingEditor,
  patchDubbingSegment,
  improveDubbingSegment,
  regenerateDubbingSegment,
  rebuildDubbingJob,
} = require("../controllers/dubbingController");

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

// POST /api/dubbing/start
// Body: multipart/form-data
//   - file: audio or video file
//   - targetLanguage: e.g. "french", "spanish", "hindi"
//   - sourceLanguage: (optional) e.g. "english" — auto-detected if omitted
router.post("/start", isAuth, upload.single("file"), startDubbingJob);

// GET /api/dubbing/:id/editor — editor payload (segments + profiles + urls)
router.get("/:id/editor", isAuth, getDubbingEditor);

// PATCH /api/dubbing/:id/segments/:segmentId — edit text/timing/strategy
router.patch("/:id/segments/:segmentId", isAuth, patchDubbingSegment);

// POST /api/dubbing/:id/segments/:segmentId/improve — AI rewrite (duration-aware)
router.post("/:id/segments/:segmentId/improve", isAuth, improveDubbingSegment);

// POST /api/dubbing/:id/segments/:segmentId/regenerate — TTS regenerate + upload
router.post("/:id/segments/:segmentId/regenerate", isAuth, regenerateDubbingSegment);

// POST /api/dubbing/:id/rebuild — rebuild full mix/video
router.post("/:id/rebuild", isAuth, rebuildDubbingJob);

// GET /api/dubbing/:id  — get a specific job by ID
router.get("/:id", isAuth, getDubbingJob);

// GET /api/dubbing?page=1&limit=10  — list all user's dubbing jobs
router.get("/", isAuth, getDubbingJobs);

module.exports = router;
