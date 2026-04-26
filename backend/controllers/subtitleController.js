const fs = require("fs");
const path = require("path");
const os = require("os");
const { v4: uuidv4 } = require("uuid");
const mongoose = require("mongoose");

const SubtitleJob = require("../models/Subtitle");
const User = require("../models/User");
const { storage } = require("../utils/storage");
const {
  calculateCreditsNeeded,
  assertEnoughCredits,
  deductCredits,
  getCreditHistory,
  getCreditSummary,
} = require("../utils/creditUtils");

const {
  getFileDuration,
  extractAudio,
  splitAudioIntoChunks,
  cleanupPath,
} = require("../utils/audioUtils");

const { extractRandomVideoThumbnailJpg } = require("../utils/videoThumbnailUtils");

const {
  LANGUAGE_LIST,
  DUBBING_LANGUAGE_LIST,
  resolveLanguage,
  transcribeSpeechClip,
  shiftSegments,
  transliterateToHinglish,
  generateSRT,
  generateVTT,
  generateASS,
} = require("../utils/subtitleUtils");

const {
  isSubtitleSileroVadEnabled,
  getSubtitleVadTranscribeMode,
  detectSileroVadTimeline,
  transcribeWithVadPipeline,
  refineSegmentsWithVadTimeline,
} = require("../utils/sileroVadUtils");
const { createProjectForSubtitleJob } = require("../utils/projectUtils");

// Whisper hard limit is 25 MB — keep chunks safely below it
const WHISPER_MAX_BYTES = 24 * 1024 * 1024;

// ─── Controllers ──────────────────────────────────────────────────────────────

exports.generateSubtitles = async (req, res, next) => {
  console.log("generateSubtitles endpoint called");

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const emit = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const tmpPaths = [];

  try {
    if (!req.file) {
      emit({ stage: "error", message: "No file uploaded.", statusCode: 422 });
      return res.end();
    }

    emit({ stage: "validating", message: "Checking file and credits…" });

    const { isoCode, label: langLabel } = resolveLanguage(req.body.language);

    const ext = path.extname(req.file.originalname) || ".tmp";
    const tmpInput = path.join(os.tmpdir(), `sub_input_${uuidv4()}${ext}`);
    fs.writeFileSync(tmpInput, req.file.buffer);
    tmpPaths.push(tmpInput);

    const duration = await getFileDuration(tmpInput);
    const creditsNeeded = calculateCreditsNeeded(duration);

    const user = await User.findById(req.userId);
    if (!user) {
      emit({ stage: "error", message: "User not found.", statusCode: 404 });
      return res.end();
    }

    try {
      assertEnoughCredits(user, creditsNeeded);
    } catch (creditErr) {
      emit({ stage: "error", message: creditErr.message, statusCode: 402 });
      return res.end();
    }

    const isVideo = req.file.mimetype.startsWith("video/");
    let audioPath = tmpInput;

    // Generate a thumbnail for video uploads (best-effort)
    let thumbnailKey = null;
    if (isVideo) {
      try {
        const tmpThumb = path.join(os.tmpdir(), `sub_thumb_${uuidv4()}.jpg`);
        tmpPaths.push(tmpThumb);
        await extractRandomVideoThumbnailJpg(tmpInput, tmpThumb);

        const key = `subtitles/${req.userId}/${uuidv4()}_thumb.jpg`;
        await storage.saveFile(fs.readFileSync(tmpThumb), key, "image/jpeg");
        thumbnailKey = key;
      } catch (thumbErr) {
        console.warn("[subtitles] thumbnail generation failed:", thumbErr.message);
      }
    }

    if (isVideo) {
      emit({ stage: "extracting", message: "Extracting audio from video…" });
      const tmpMp3 = path.join(os.tmpdir(), `sub_audio_${uuidv4()}.mp3`);
      tmpPaths.push(tmpMp3);
      await extractAudio(tmpInput, tmpMp3);
      audioPath = tmpMp3;
    }

    emit({ stage: "uploading", message: "Uploading audio to storage…" });
    let originalFileKey = null;
    let originalFileUrl = null;
    try {
      const s3Key = `subtitles/${req.userId}/${uuidv4()}.mp3`;
      await storage.saveFile(fs.readFileSync(audioPath), s3Key, "audio/mpeg");
      originalFileKey = s3Key;
      originalFileUrl = await storage.getPublicUrl(s3Key);
    } catch (uploadErr) {
      console.error("S3 upload failed (continuing without audio file):", uploadErr.message);
    }

    const audioSize = fs.statSync(audioPath).size;
    let allSegments = [];
    let vadUsed = false;

    const runLegacyWhisper = async () => {
      const segs = [];
      if (audioSize > WHISPER_MAX_BYTES) {
        const bytesPerSecond = audioSize / duration;
        const chunkSeconds = Math.floor((20 * 1024 * 1024) / bytesPerSecond);

        const chunkDir = path.join(os.tmpdir(), `sub_chunks_${uuidv4()}`);
        fs.mkdirSync(chunkDir, { recursive: true });
        tmpPaths.push(chunkDir);

        emit({ stage: "transcribing", message: "Splitting audio into chunks…" });
        const chunkFiles = await splitAudioIntoChunks(audioPath, chunkDir, chunkSeconds);
        const totalChunks = chunkFiles.length;

        let timeOffset = 0;
        for (let i = 0; i < chunkFiles.length; i++) {
          emit({
            stage: "transcribing",
            message: `Transcribing part ${i + 1} of ${totalChunks}…`,
            progress: Math.round((i / totalChunks) * 100),
            chunk: i + 1,
            totalChunks,
          });
          const result = await transcribeSpeechClip(chunkFiles[i], isoCode);
          segs.push(...shiftSegments(result.segments || [], timeOffset));
          const chunkDur = await getFileDuration(chunkFiles[i]);
          timeOffset += chunkDur;
        }
      } else {
        emit({ stage: "transcribing", message: "Transcribing audio…", progress: 0 });
        const result = await transcribeSpeechClip(audioPath, isoCode);
        for (const s of result.segments || []) {
          segs.push({
            start: s.start,
            end: s.end,
            text: s.text.trim(),
          });
        }
      }
      return segs;
    };

    if (isSubtitleSileroVadEnabled()) {
      try {
        emit({ stage: "vad", message: "Detecting speech and silence…" });
        const mode = getSubtitleVadTranscribeMode();

        if (mode === "clips") {
          const vadSegments = await transcribeWithVadPipeline({
            audioPath,
            duration,
            audioSize,
            transcribeClip: (clipPath) => transcribeSpeechClip(clipPath, isoCode),
            registerTmp: (p) => tmpPaths.push(p),
            onClipProgress: (i, n) => {
              emit({
                stage: "transcribing",
                message: `Transcribing speech ${i} of ${n}…`,
                progress: Math.round(((i - 1) / Math.max(n, 1)) * 100),
                chunk: i,
                totalChunks: n,
              });
            },
          });
          if (vadSegments && vadSegments.length > 0) {
            allSegments = vadSegments;
            vadUsed = true;
          }
        } else {
          const vadTmp = path.join(os.tmpdir(), `sub_vad_tl_${uuidv4()}`);
          tmpPaths.push(vadTmp);
          const timeline = await detectSileroVadTimeline(audioPath, vadTmp);
          allSegments = await runLegacyWhisper();
          allSegments = refineSegmentsWithVadTimeline(allSegments, timeline.intervals);
          vadUsed = true;
        }
      } catch (vadErr) {
        console.warn("[subtitles] Silero VAD pipeline failed, using legacy path:", vadErr.message);
      }
    }

    if (!vadUsed) {
      allSegments = await runLegacyWhisper();
    }

    if (langLabel === "hinglish") {
      emit({ stage: "transliterating", message: "Converting to Hinglish script…" });
      allSegments = await transliterateToHinglish(allSegments);
    }

    emit({ stage: "saving", message: "Saving results…" });

    const transcription = allSegments.map((s) => s.text).join(" ");

    const creditsRemaining = await deductCredits(
      req.userId,
      creditsNeeded,
      "subtitle_job",
      `Transcribed ${req.file.originalname} (${creditsNeeded} min)`,
      {
        fileName: req.file.originalname,
        fileType: isVideo ? "video" : "audio",
        language: langLabel,
        duration,
        originalFileKey,
      }
    );

    const job = await SubtitleJob.create({
      user: req.userId,
      originalFileName: req.file.originalname,
      fileType: isVideo ? "video" : "audio",
      duration,
      creditsUsed: creditsNeeded,
      status: "completed",
      language: langLabel,
      transcription,
      segments: allSegments,
      originalFileKey,
      originalFileUrl,
      thumbnailKey,
    });

    await createProjectForSubtitleJob(req.userId, job._id);

    emit({
      stage: "done",
      message: "Subtitles generated successfully.",
      job,
      creditsRemaining,
    });

    res.end();
  } catch (err) {
    try {
      emit({
        stage: "error",
        message: err.message || "An unexpected error occurred.",
        statusCode: err.statusCode || 500,
      });
      res.end();
    } catch (_) {
      if (!err.statusCode) err.statusCode = 500;
      next(err);
    }
  } finally {
    tmpPaths.forEach(cleanupPath);
  }
};

exports.exportSubtitles = async (req, res, next) => {
  try {
    const format = (req.query.format || "srt").toLowerCase();

    if (!["srt", "vtt", "ass"].includes(format)) {
      const err = new Error('Invalid format. Supported values: srt, vtt, ass.');
      err.statusCode = 422;
      throw err;
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      const err = new Error("Subtitle job not found.");
      err.statusCode = 404;
      throw err;
    }

    const job = await SubtitleJob.findById(req.params.id);
    if (!job) {
      const err = new Error("Subtitle job not found.");
      err.statusCode = 404;
      throw err;
    }
    if (job.user.toString() !== req.userId) {
      const err = new Error("Access denied.");
      err.statusCode = 403;
      throw err;
    }
    if (job.status !== "completed" || job.segments.length === 0) {
      const err = new Error("No subtitle data available for this job.");
      err.statusCode = 409;
      throw err;
    }

    const baseName = path.basename(
      job.originalFileName,
      path.extname(job.originalFileName)
    );
    const fileName = `${baseName}.${format}`;

    let content;
    if (format === "srt") content = generateSRT(job.segments);
    else if (format === "vtt") content = generateVTT(job.segments);
    else content = generateASS(job.segments);

    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.send(content);
  } catch (err) {
    if (!err.statusCode) err.statusCode = 500;
    next(err);
  }
};

exports.getSubtitleJobs = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 10);
    const skip = (page - 1) * limit;

    const [jobs, total] = await Promise.all([
      SubtitleJob.find({ user: req.userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select("-segments"),
      SubtitleJob.countDocuments({ user: req.userId }),
    ]);

    const jobsWithThumbs = await Promise.all(
      jobs.map(async (j) => {
        const job = j.toObject ? j.toObject() : j;
        if (!job.thumbnailKey) return job;
        try {
          return { ...job, thumbnailUrl: await storage.getPublicUrl(job.thumbnailKey) };
        } catch (_) {
          return job;
        }
      })
    );

    res.json({
      jobs: jobsWithThumbs,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
};

exports.getSubtitleJob = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      const err = new Error("Subtitle job not found.");
      err.statusCode = 404;
      throw err;
    }

    const job = await SubtitleJob.findById(req.params.id);
    if (!job) {
      const err = new Error("Subtitle job not found.");
      err.statusCode = 404;
      throw err;
    }
    if (job.user.toString() !== req.userId) {
      const err = new Error("Access denied.");
      err.statusCode = 403;
      throw err;
    }
    const jobObj = job.toObject ? job.toObject() : job;
    if (jobObj.thumbnailKey) {
      try {
        jobObj.thumbnailUrl = await storage.getPublicUrl(jobObj.thumbnailKey);
      } catch (_) {}
    }
    res.json({ job: jobObj });
  } catch (err) {
    if (!err.statusCode) err.statusCode = 500;
    next(err);
  }
};

exports.getUserCredits = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).select("credits name email");
    if (!user) {
      const err = new Error("User not found.");
      err.statusCode = 404;
      throw err;
    }
    res.json({ credits: user.credits ?? 0 });
  } catch (err) {
    next(err);
  }
};

exports.getCreditHistory = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 10);

    const result = await getCreditHistory(req.userId, { page, limit });
    res.json(result);
  } catch (err) {
    if (!err.statusCode) err.statusCode = 500;
    next(err);
  }
};

exports.getCreditSummary = async (req, res, next) => {
  try {
    const summary = await getCreditSummary(req.userId);
    res.json(summary);
  } catch (err) {
    if (!err.statusCode) err.statusCode = 500;
    next(err);
  }
};

exports.getLanguages = (req, res) => {
  const raw = (req.query.mode || "subtitles").toLowerCase().trim();
  // console.log(raw);
  const mode = raw === "dubbing" ? "dubbing" : "subtitles";
  const languages =
    mode === "dubbing" ? DUBBING_LANGUAGE_LIST : LANGUAGE_LIST;
  // console.log(languages);
  res.json({
    mode,
    languages,
    legend: {
      subtitles:
        "Whisper ASR; `LANGUAGE_MAP` entries with ISO codes in `backend/utils/languageCatalog.js`.",
      dubbingSarvam:
        "Indic targets route TTS to Sarvam when the target matches `SARVAM_BCP47_MAP` keys.",
      dubbingInworld:
        "Other listed targets align with `INWORLD_LANG_CODE_MAP` / Inworld voice catalog when using the Inworld TTS stack.",
    },
  });
};
