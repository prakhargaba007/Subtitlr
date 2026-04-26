const express = require("express");
const multer = require("multer");
const router = express.Router();

const isAuth = require("../middleware/is-auth");
const checkDubbingLimits = require("../middleware/checkDubbingLimits");
const {
  prepareDubbingStartFromS3,
} = require("../middleware/dubbingPrepareS3Input");
const AUDIO_VIDEO_MIMES = require("../constants/audioVideoMimes");
const {
  startDubbingJob,
  startDubbingFromYoutube,
  requestDubbingUploadUrl,
  getDubbingJob,
  getDubbingJobs,
  getDubbingEditor,
  patchDubbingSegment,
  improveDubbingSegment,
  regenerateDubbingSegment,
  addDubbingSegment,
  rebuildDubbingJob,
  listLocalInworldVoices,
} = require("../controllers/dubbingController");

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

// POST /api/dubbing/upload-url — presigned PUT for direct browser → S3 (STORAGE_TYPE=s3 only)
router.post("/upload-url", isAuth, requestDubbingUploadUrl);

function dubbingMultipartOrS3(req, res, next) {
  prepareDubbingStartFromS3(req, res, (err) => {
    if (err) return next(err);
    if (req.dubbingTmpProbeFile) {
      return checkDubbingLimits(req, res, next);
    }
    upload.single("file")(req, res, (e2) => {
      if (e2) return next(e2);
      checkDubbingLimits(req, res, next);
    });
  });
}

// POST /api/dubbing/start
// Body: multipart/form-data (file + languages) OR application/json after direct S3 upload:
//   { s3Key, originalFileName, mimeType, targetLanguage, sourceLanguage? }
router.post("/start", isAuth, dubbingMultipartOrS3, startDubbingJob);

// POST /api/dubbing/start-youtube
// Body: application/json
//   - youtubeUrl: full YouTube video URL
//   - targetLanguage: e.g. "french", "spanish", "hindi"
//   - sourceLanguage: (optional) e.g. "english" — auto-detected if omitted
// Note: youtube route buffers the video internally; limit check runs inside the controller
// after the download completes (see dubbingController.startDubbingFromYoutube).
router.post("/start-youtube", isAuth, express.json(), startDubbingFromYoutube);

// GET /api/dubbing/voices/local-inworld — curated Inworld IDs from backend/voices (must be before /:id)
router.get("/voices/local-inworld", isAuth, listLocalInworldVoices);

// GET /api/dubbing/:id/editor — editor payload (segments + profiles + urls)
router.get("/:id/editor", isAuth, getDubbingEditor);

// PATCH /api/dubbing/:id/segments/:segmentId — edit text/timing/strategy
router.patch("/:id/segments/:segmentId", isAuth, patchDubbingSegment);

// POST /api/dubbing/:id/segments — add a brand-new segment with TTS audio
router.post("/:id/segments", isAuth, addDubbingSegment);

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
