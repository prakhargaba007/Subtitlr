const fs = require("fs");
const path = require("path");
const os = require("os");
const { v4: uuidv4 } = require("uuid");
const mongoose = require("mongoose");
const OpenAI = require("openai");

const DubbingJob = require("../models/DubbingJob");
const User = require("../models/User");
const UserSubscription = require("../models/UserSubscription");
const PlanCatalog = require("../models/PlanCatalog");
const { storage, createPresignedPutUrl } = require("../utils/storage");
const AUDIO_VIDEO_MIMES = require("../constants/audioVideoMimes");
const {
  extractRandomVideoThumbnailJpg,
} = require("../utils/videoThumbnailUtils");
const {
  calculateCreditsNeeded,
  assertEnoughCredits,
  deductCredits,
} = require("../utils/creditUtils");
const {
  confirmDubbingUsage,
  refundDubbingUsage,
} = require("../utils/usageService");

const {
  getFileDuration,
  getMediaStreamSummary,
  extractAudio,
  cleanupPath,
  ensureMinAudioDuration,
} = require("../utils/audioUtils");
const {
  separateVocalsAndBackground,
} = require("../utils/sourceSeparationUtils");
const { transcribeWithSpeakers } = require("../utils/transcribeUtils");
const { translateToSpeechReady } = require("../utils/translationUtils");
const {
  enrichSegmentsWithInworldVoiceProfile,
} = require("../utils/inworldSttUtils");
const { resolveMaxAtempo } = require("../utils/dubbingConfig");
const {
  textForInworldTts,
  textForNonInworldTts,
  textForGeminiTts,
} = require("../utils/dubbingTextUtils");
const {
  isGeminiTtsConfigured,
  selectBestGeminiVoice,
  synthesizeGeminiTts,
} = require("../utils/geminiTtsUtils");
const {
  flattenTranslatedSegmentsForTts,
  flattenJobSegmentForTts,
} = require("../utils/dubbingSegmentFlatten");
const {
  getTtsProvider,
  isElevenLabsLibraryVoiceBlockedError,
  fetchAvailableVoices,
  selectBestVoice,
  selectBestOpenAIVoice,
  generateSpeech,
  generateSpeechOpenAI,
} = require("../utils/ttsUtils");
const {
  syncSegmentTiming,
  buildTimeline,
} = require("../utils/timingSyncUtils");
const {
  layerSpeechOverBackground,
  muxWithVideo,
  mergeAudioOnly,
} = require("../utils/audioMergeUtils");
const {
  getJobOutputDir,
  saveArtifact,
} = require("../utils/dubbingOutputUtils");
const { lipSyncVideo } = require("../utils/lipSyncRunner");
const {
  isInworldConfigured,
  fetchInworldVoiceCatalog,
  selectBestInworldVoice,
  synthesizeInworldTts,
} = require("../utils/inworldTtsUtils");
const {
  isSarvamConfigured,
  selectBestSarvamVoice,
  synthesizeSarvamTts,
  BCP_47_MAP,
} = require("../utils/sarvamTtsUtils");
const {
  isSmallestConfigured,
  fetchSmallestVoiceCatalog,
  selectBestSmallestVoice,
  synthesizeSmallestTts,
} = require("../utils/smallestTtsUtils");
const { loadLocalInworldVoices } = require("../utils/localInworldVoices");
const { createProjectForDubbingJob } = require("../utils/projectUtils");
const { downloadYoutubeVideo } = require("../utils/youtubeDownloadUtils");

// Dubbing credits: 1 credit per second (rounded up to the next whole second).
const DUBBING_CREDITS_PER_SECOND = 1;

const calculateDubbingCredits = (durationSeconds) =>
  Math.ceil(durationSeconds) * DUBBING_CREDITS_PER_SECOND;

let _openai = null;
const getOpenAI = () => {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
};

/** GET — bundled Inworld voice list from backend/voices/inworld_voices_last.json */
exports.listLocalInworldVoices = (req, res, next) => {
  try {
    const voices = loadLocalInworldVoices();
    res.json({ voices, count: voices.length });
  } catch (err) {
    next(err);
  }
};

async function streamToBuffer(body) {
  if (!body) return Buffer.alloc(0);
  if (Buffer.isBuffer(body)) return body;
  if (typeof body.transformToByteArray === "function") {
    const arr = await body.transformToByteArray();
    return Buffer.from(arr);
  }
  // Node stream
  return await new Promise((resolve, reject) => {
    const chunks = [];
    body.on("data", (c) => chunks.push(Buffer.from(c)));
    body.on("end", () => resolve(Buffer.concat(chunks)));
    body.on("error", reject);
  });
}

async function synthesizeDubbingTts(
  ttsProviderResolved,
  text,
  voiceKey,
  targetLanguage,
) {
  const plain = textForNonInworldTts(text);
  const iwText = textForInworldTts(text, targetLanguage);
  if (ttsProviderResolved === "openai") {
    const o = await generateSpeechOpenAI(plain, voiceKey);
    return { audioPath: o.audioPath, wordTimestamps: [] };
  }
  if (ttsProviderResolved === "sarvam") {
    const o = await synthesizeSarvamTts(plain, voiceKey, targetLanguage);
    return { audioPath: o.audioPath, wordTimestamps: [] };
  }
  if (ttsProviderResolved === "inworld") {
    const o = await synthesizeInworldTts(iwText, voiceKey);
    return { audioPath: o.audioPath, wordTimestamps: o.wordTimestamps || [] };
  }
  if (ttsProviderResolved === "smallest") {
    const o = await synthesizeSmallestTts(plain, voiceKey);
    return { audioPath: o.audioPath, wordTimestamps: [] };
  }
  if (ttsProviderResolved === "gemini") {
    const o = await synthesizeGeminiTts(textForGeminiTts(text), voiceKey);
    return { audioPath: o.audioPath, wordTimestamps: [] };
  }
  const o = await generateSpeech(plain, voiceKey);
  return { audioPath: o.audioPath, wordTimestamps: [] };
}

function getDubbingSegmentPipelineConcurrency() {
  const raw = String(
    process.env.DUBBING_SEGMENT_PIPELINE_CONCURRENCY || "3",
  ).trim();
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return 3;
  return Math.min(8, n);
}

/**
 * Per TTS row: synthesize → sync timing → save artifacts; solo parents also upload to S3.
 * Arrays are filled by index so downstream timeline/DB stay aligned.
 */
async function pipelineTtsSyncUploadForDubbing({
  DubbingJob,
  jobMongoId,
  ttsRows,
  synthesizeProvider,
  voiceMap,
  targetLanguage,
  syncOpts,
  tmpPaths,
  emit,
  jobIdStr,
  segmentIds,
  segmentAudioKeys,
  userId,
  pathCollector,
}) {
  const n = ttsRows.length;
  const rawDubbedPaths = new Array(n);
  const wordTsForRows = new Array(n);
  const syncedBuffers = new Array(n);

  if (n === 0) {
    emit({ stage: "syncing", message: "Synchronising segment timing…" });
    await DubbingJob.findByIdAndUpdate(jobMongoId, { status: "syncing" });
    emit({ stage: "syncing", message: "Timing sync complete." });
    return { rawDubbedPaths, wordTsForRows, syncedBuffers };
  }

  const limit = getDubbingSegmentPipelineConcurrency();
  let firstSyncEmitted = false;
  let uploadMsgEmitted = false;
  let completed = 0;
  let pipelineError = null;
  let nextK = 0;

  const processOne = async (k) => {
    const row = ttsRows[k];
    const voiceKey = voiceMap[row.speaker_id];
    if (!voiceKey) {
      throw new Error(`No voice selected for speaker: ${row.speaker_id}`);
    }

    emit({
      stage: "generating",
      message: `Generating speech: clip ${k + 1}/${n}…`,
    });

    const { audioPath, wordTimestamps } = await synthesizeDubbingTts(
      synthesizeProvider,
      row.text,
      voiceKey,
      targetLanguage,
    );
    tmpPaths.push(audioPath);
    rawDubbedPaths[k] = audioPath;
    wordTsForRows[k] = wordTimestamps;
    if (pathCollector) pathCollector.push(audioPath);

    saveArtifact(
      jobIdStr,
      `tts_raw/segment_${String(k + 1).padStart(3, "0")}.mp3`,
      audioPath,
    );

    if (!firstSyncEmitted) {
      firstSyncEmitted = true;
      emit({ stage: "syncing", message: "Synchronising segment timing…" });
      await DubbingJob.findByIdAndUpdate(jobMongoId, { status: "syncing" });
    }

    const originalDuration = Math.max(0.05, row.end - row.start);
    const synced = await syncSegmentTiming(
      audioPath,
      originalDuration,
      syncOpts,
    );
    tmpPaths.push(synced.adjustedPath);
    syncedBuffers[k] = synced;
    if (pathCollector) pathCollector.push(synced.adjustedPath);

    saveArtifact(
      jobIdStr,
      `tts_synced/segment_${String(k + 1).padStart(3, "0")}.mp3`,
      synced.adjustedPath,
    );

    if (row.subIndex < 0) {
      if (!uploadMsgEmitted) {
        uploadMsgEmitted = true;
        emit({
          stage: "syncing",
          message: "Uploading per-segment audio clips…",
        });
      }
      try {
        const segId = segmentIds[row.parentIndex];
        const segKey = `dubbing/${userId}/${jobMongoId.toString()}/segments/${segId}_r0.mp3`;
        await storage.saveFile(
          fs.readFileSync(synced.adjustedPath),
          segKey,
          "audio/mpeg",
        );
        segmentAudioKeys.set(row.parentIndex, segKey);
      } catch (segUploadErr) {
        console.warn(
          `[dubbing] Segment ${row.parentIndex} audio upload failed:`,
          segUploadErr.message,
        );
      }
    }

    completed += 1;
    emit({
      stage: "syncing",
      message: `Clips ready: ${completed}/${n} (TTS + sync + upload)…`,
      progress: Math.round((completed / n) * 100),
    });
  };

  const worker = async () => {
    for (;;) {
      if (pipelineError) return;
      const k = nextK;
      nextK += 1;
      if (k >= n) return;
      try {
        await processOne(k);
      } catch (e) {
        pipelineError = pipelineError || e;
        return;
      }
    }
  };

  const workerCount = Math.min(limit, n);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  if (pipelineError) throw pipelineError;

  emit({ stage: "syncing", message: "Timing sync complete." });

  return { rawDubbedPaths, wordTsForRows, syncedBuffers };
}

async function ensureJobEditable(req, jobId) {
  if (!mongoose.Types.ObjectId.isValid(jobId)) {
    const err = new Error("Dubbing job not found.");
    err.statusCode = 404;
    throw err;
  }
  const job = await DubbingJob.findById(jobId);
  if (!job) {
    const err = new Error("Dubbing job not found.");
    err.statusCode = 404;
    throw err;
  }
  if (job.user.toString() !== req.userId) {
    const err = new Error("Access denied.");
    err.statusCode = 403;
    throw err;
  }
  return job;
}

async function runDubbingPipelineFromInput(
  req,
  emit,
  tmpPaths,
  {
    tmpInput,
    inputBuffer,
    inputMimeType,
    originalFileName,
    existingOriginalS3Key = null,
  },
) {
  const targetLanguage = (req.body.targetLanguage || "").trim();
  if (!targetLanguage) {
    const err = new Error("targetLanguage is required.");
    err.statusCode = 422;
    throw err;
  }

  const sourceLanguage = (req.body.sourceLanguage || "").trim() || null;

  emit({ stage: "validating", message: "Checking file and credits…" });

  const isVideo = String(inputMimeType || "").startsWith("video/");
  const ext =
    path.extname(originalFileName || "") || (isVideo ? ".mp4" : ".mp3");

  const duration = await getFileDuration(tmpInput);
  const creditsNeeded = calculateDubbingCredits(duration);

  const user = await User.findById(req.userId);
  if (!user) {
    const err = new Error("User not found.");
    err.statusCode = 404;
    throw err;
  }

  assertEnoughCredits(user, creditsNeeded);

  let ttsProvider = getTtsProvider();
  const sarvamSupportedLanguages = Object.keys(BCP_47_MAP);
  if (
    sarvamSupportedLanguages.includes((targetLanguage || "").toLowerCase()) &&
    ttsProvider !== "gemini"
  ) {
    ttsProvider = "sarvam";
  }

  if (
    ttsProvider === "elevenlabs" &&
    !String(process.env.ELEVENLABS_API_KEY || "").trim()
  ) {
    const err = new Error(
      "ELEVENLABS_API_KEY is required when DUBBING_TTS_PROVIDER=elevenlabs.",
    );
    err.statusCode = 422;
    throw err;
  }
  if (
    !String(
      process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "",
    ).trim()
  ) {
    const err = new Error(
      "GOOGLE_API_KEY (or GEMINI_API_KEY) is required for dubbing transcription.",
    );
    err.statusCode = 422;
    throw err;
  }
  if (!String(process.env.OPENAI_API_KEY || "").trim()) {
    const err = new Error(
      "OPENAI_API_KEY is required for dubbing (translation and voice selection).",
    );
    err.statusCode = 422;
    throw err;
  }
  if (ttsProvider === "inworld" && !isInworldConfigured()) {
    const err = new Error(
      "INWORLD_API_KEY is required when DUBBING_TTS_PROVIDER=inworld.",
    );
    err.statusCode = 422;
    throw err;
  }
  if (ttsProvider === "sarvam" && !isSarvamConfigured()) {
    const err = new Error(
      "SARVAM_API_KEY is required when DUBBING_TTS_PROVIDER=sarvam or for Indic languages.",
    );
    err.statusCode = 422;
    throw err;
  }
  if (ttsProvider === "smallest" && !isSmallestConfigured()) {
    const err = new Error(
      "SMALLEST_API_KEY is required when DUBBING_TTS_PROVIDER=smallest.",
    );
    err.statusCode = 422;
    throw err;
  }
  if (ttsProvider === "gemini" && !isGeminiTtsConfigured()) {
    const err = new Error(
      "GOOGLE_API_KEY or GEMINI_API_KEY is required when DUBBING_TTS_PROVIDER=gemini.",
    );
    err.statusCode = 422;
    throw err;
  }

  // Create a DB record immediately so the client can poll by ID
  const job = await DubbingJob.create({
    user: req.userId,
    originalFileName,
    fileType: isVideo ? "video" : "audio",
    sourceLanguage: sourceLanguage || "auto",
    targetLanguage,
    duration,
    creditsUsed: creditsNeeded,
    status: "extracting",
    // Limit-system fields
    idempotencyKey: req.dubbingIdempotencyKey ?? null,
    reservedSeconds: req.dubbingDurationSeconds ?? duration,
    processingStartedAt: new Date(),
  });

  await createProjectForDubbingJob(req.userId, job._id);

  emit({ stage: "validating", message: "Job created.", jobId: job._id });

  const jobIdStr = job._id.toString();
  const localOutputPath = getJobOutputDir(jobIdStr);
  try {
    fs.mkdirSync(localOutputPath, { recursive: true });
  } catch (mkdirErr) {
    console.warn(
      "Could not create dubbing local output dir:",
      mkdirErr.message,
    );
  }
  saveArtifact(jobIdStr, `00_input${ext}`, tmpInput);

  // ── Thumbnail: start non-blocking immediately (only needs tmpInput) ────────
  const thumbPromise = isVideo
    ? (async () => {
        try {
          const tmpThumb = path.join(os.tmpdir(), `dub_thumb_${uuidv4()}.jpg`);
          tmpPaths.push(tmpThumb);
          await extractRandomVideoThumbnailJpg(tmpInput, tmpThumb);
          const key = `dubbing/${req.userId}/${uuidv4()}_thumb.jpg`;
          await storage.saveFile(fs.readFileSync(tmpThumb), key, "image/jpeg");
          await DubbingJob.findByIdAndUpdate(job._id, { thumbnailKey: key });
        } catch (thumbErr) {
          console.warn("[dubbing] thumbnail generation failed:", thumbErr.message);
        }
      })()
    : Promise.resolve();

  // ── Step 1: Extract audio ─────────────────────────────────────────────────
  emit({ stage: "extracting", message: "Extracting audio from file…" });
  const _t0 = Date.now();

  let audioPath = tmpInput;
  if (isVideo) {
    const tmpMp3 = path.join(os.tmpdir(), `dub_audio_${uuidv4()}.mp3`);
    tmpPaths.push(tmpMp3);
    await extractAudio(tmpInput, tmpMp3);
    audioPath = tmpMp3;
  }

  saveArtifact(jobIdStr, "01_full_audio.mp3", audioPath);
  console.log(`[dubbing:timing] extract done: ${Date.now() - _t0}ms`);

  // ── Original asset upload: non-blocking (video key + new audio key) ───────
  const origUploadPromise = (async () => {
    try {
      let videoKey = null;
      if (existingOriginalS3Key) {
        videoKey = existingOriginalS3Key;
      } else if (inputBuffer && Buffer.isBuffer(inputBuffer) && inputBuffer.length) {
        const key = `dubbing/${req.userId}/${uuidv4()}${ext}`;
        await storage.saveFile(inputBuffer, key, inputMimeType);
        videoKey = key;
      } else if (isVideo) {
        // Disk-upload path: we may not have req.file.buffer. Fall back to reading tmpInput.
        // NOTE: This reads the whole file into memory; acceptable for typical short uploads.
        const key = `dubbing/${req.userId}/${uuidv4()}${ext}`;
        await storage.saveFile(fs.readFileSync(tmpInput), key, inputMimeType);
        videoKey = key;
      }

      const audioOrigKey = `dubbing/${req.userId}/${uuidv4()}_original_audio.mp3`;
      await storage.saveFile(fs.readFileSync(audioPath), audioOrigKey, "audio/mpeg");

      const update = { originalAudioKey: audioOrigKey };
      if (videoKey) update.originalVideoKey = videoKey;
      await DubbingJob.findByIdAndUpdate(job._id, update);
    } catch (uploadErr) {
      console.warn("[dubbing] Original asset upload failed:", uploadErr.message);
    }
  })();

  // ── Step 2: Source separation — start non-blocking, stems needed only at mix
  emit({
    stage: "separating",
    message: "Separating vocals from background audio…",
  });
  await DubbingJob.findByIdAndUpdate(job._id, { status: "separating" });

  const separationDir = path.join(os.tmpdir(), `dub_stems_${uuidv4()}`);
  tmpPaths.push(separationDir);
  const _tSepStart = Date.now();

  const sepPromise = separateVocalsAndBackground(audioPath, separationDir).then(
    async (result) => {
      console.log(`[dubbing:timing] separation done: ${Date.now() - _tSepStart}ms`);
      emit({
        stage: "separating",
        message: `Audio separated (${result.method === "replicate" ? "Demucs" : "ElevenLabs fallback"}).`,
      });
      saveArtifact(jobIdStr, "02_vocals.mp3", result.vocalsPath);
      saveArtifact(jobIdStr, "03_background.mp3", result.backgroundPath);

      // Upload stems — runs concurrently inside the resolved promise
      try {
        const [vocalsKey, backgroundKey] = await Promise.all([
          (async () => {
            const key = `dubbing/${req.userId}/${uuidv4()}_vocals.mp3`;
            await storage.saveFile(fs.readFileSync(result.vocalsPath), key, "audio/mpeg");
            return key;
          })(),
          (async () => {
            const key = `dubbing/${req.userId}/${uuidv4()}_background.mp3`;
            await storage.saveFile(fs.readFileSync(result.backgroundPath), key, "audio/mpeg");
            return key;
          })(),
        ]);
        await DubbingJob.findByIdAndUpdate(job._id, {
          vocalsKey,
          backgroundKey,
          separationMethod: result.method,
        });
      } catch (uploadErr) {
        console.warn("Stems S3 upload failed:", uploadErr.message);
      }

      return result;
    },
  );

  // ── Step 3: Transcribe ─────────────────────────────────────────────────────
  // Default (DUBBING_TRANSCRIBE_SOURCE=original): transcribe full-track audioPath
  // in parallel with separation — pipeline continues as soon as this resolves.
  // Set DUBBING_TRANSCRIBE_SOURCE=vocals to wait for stems and use clean vocals.
  const transcribeSource = String(
    process.env.DUBBING_TRANSCRIBE_SOURCE || "original",
  ).trim().toLowerCase();

  emit({
    stage: "transcribing",
    message: "Transcribing audio and identifying speakers…",
  });
  await DubbingJob.findByIdAndUpdate(job._id, { status: "transcribing" });

  let transcribeInputPath;
  if (transcribeSource === "vocals") {
    const sepResult = await sepPromise;
    transcribeInputPath = sepResult.vocalsPath;
  } else {
    transcribeInputPath = audioPath;
  }

  const _tTrStart = Date.now();
  const { segments: rawSegments, speaker_profiles } =
    await transcribeWithSpeakers(transcribeInputPath, sourceLanguage);
  console.log(`[dubbing:timing] transcribe done: ${Date.now() - _tTrStart}ms`);

  emit({
    stage: "transcribing",
    message: `Transcription complete. Found ${rawSegments.length} segments, ${speaker_profiles.length} speaker(s).`,
    speakerCount: speaker_profiles.length,
    segmentCount: rawSegments.length,
  });

  emit({
    stage: "transcribing",
    message: "Enriching segments with voice profile (optional)…",
  });
  const segmentsForTranslate = await enrichSegmentsWithInworldVoiceProfile(
    rawSegments,
    audioPath,
  );

  // ── Step 4: Translate to speech-ready target language ────────────────────
  emit({
    stage: "translating",
    message: `Translating to ${targetLanguage}…`,
  });
  await DubbingJob.findByIdAndUpdate(job._id, { status: "translating" });

  const translationMode =
    String(req.body.translationMode || "auto").trim() || "auto";
  const translatedSegments = await translateToSpeechReady(
    segmentsForTranslate,
    targetLanguage,
    speaker_profiles,
    { sourceLanguage, translationMode },
  );

  emit({ stage: "translating", message: "Translation complete." });
  console.log(`[dubbing:timing] translate done: ${Date.now() - _t0}ms elapsed total`);

  // Separation may still be running; it will be awaited in startDubbingJob
  // immediately before layerSpeechOverBackground (which needs backgroundPath).
  return {
    job,
    jobIdStr,
    localOutputPath,
    isVideo,
    ext,
    duration,
    creditsNeeded,
    ttsProvider,
    sourceLanguage,
    targetLanguage,
    audioPath,
    sepPromise,
    translatedSegments,
    speaker_profiles,
    segmentsForTranslate,
    _t0,
    // Best-effort background tasks that read temp files; await before cleanup.
    thumbPromise,
    origUploadPromise,
  };
}

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * POST /api/dubbing/upload-url
 * Returns a presigned PUT URL for direct browser → S3 upload (STORAGE_TYPE=s3 only).
 */
exports.requestDubbingUploadUrl = async (req, res, next) => {
  try {
    if ((process.env.STORAGE_TYPE || "local") !== "s3") {
      return res.status(501).json({
        message: "Direct S3 upload is not enabled on this server.",
        code: "STORAGE_LOCAL",
      });
    }

    const fileName = (req.body?.fileName || req.body?.filename || "").trim();
    const mimeType = (req.body?.mimeType || "").trim();
    const byteSize = Number(req.body?.byteSize);

    if (!fileName || !mimeType) {
      return res.status(400).json({
        message: "fileName (or filename) and mimeType are required.",
      });
    }
    if (!AUDIO_VIDEO_MIMES.has(mimeType)) {
      return res.status(415).json({ message: `Unsupported mime type: ${mimeType}` });
    }
    if (!Number.isFinite(byteSize) || byteSize <= 0) {
      return res.status(400).json({ message: "byteSize must be a positive number." });
    }

    const user = await User.findById(req.userId)
      .select("activeSubscriptionId")
      .lean();
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    let planFlags = {};
    if (user.activeSubscriptionId) {
      const sub = await UserSubscription.findById(user.activeSubscriptionId)
        .select("status planCatalog")
        .lean();
      if (sub && sub.status === "active" && sub.planCatalog) {
        const plan = await PlanCatalog.findById(sub.planCatalog)
          .select("featureFlags")
          .lean();
        if (plan?.featureFlags) planFlags = plan.featureFlags;
      }
    }

    const maxFileSizeMB = planFlags.maxFileSizeMB ?? null;
    if (maxFileSizeMB !== null && byteSize > maxFileSizeMB * 1024 * 1024) {
      return res.status(413).json({
        message: `Declared file size exceeds the plan limit of ${maxFileSizeMB} MB.`,
      });
    }

    const safeName = path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = `dubbing/${req.userId}/${uuidv4()}-${safeName}`;
    const { uploadUrl } = await createPresignedPutUrl(key, mimeType, 900);
    return res.json({ uploadUrl, key });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/dubbing/start
 * Accepts a video or audio file + source/target language.
 * Streams progress back via SSE and persists the job to MongoDB.
 */
exports.startDubbingJob = async (req, res) => {
  console.log("startDubbingJob endpoint called");

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const emit = (data) => {
    try {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (_) {}
  };

  const tmpPaths = [];
  let job = null;

  try {
    const hasDiskInput = Boolean(
      req.dubbingTmpProbeFile && fs.existsSync(req.dubbingTmpProbeFile),
    );
    const hasBufferInput = Boolean(req.file && req.file.buffer && req.file.buffer.length);
    if (!req.file || (!hasBufferInput && !hasDiskInput)) {
      emit({ stage: "error", message: "No file uploaded.", statusCode: 422 });
      return res.end();
    }

    const isVideo = req.file.mimetype.startsWith("video/");
    const ext =
      path.extname(req.file.originalname) || (isVideo ? ".mp4" : ".mp3");

    let tmpInput;
    if (hasDiskInput) {
      tmpInput = req.dubbingTmpProbeFile;
    } else {
      tmpInput = path.join(os.tmpdir(), `dub_input_${uuidv4()}${ext}`);
      fs.writeFileSync(tmpInput, req.file.buffer);
    }
    tmpPaths.push(tmpInput);

    const prepared = await runDubbingPipelineFromInput(req, emit, tmpPaths, {
      tmpInput,
      inputBuffer: hasBufferInput ? req.file.buffer : null,
      inputMimeType: req.file.mimetype,
      originalFileName: req.file.originalname,
      existingOriginalS3Key: req.dubbingPresignedS3Key || null,
    });

    job = prepared.job;

    const {
      jobIdStr,
      localOutputPath,
      ttsProvider,
      sourceLanguage,
      targetLanguage,
      duration,
      creditsNeeded,
      isVideo: preparedIsVideo,
      translatedSegments,
      speaker_profiles,
      audioPath,
      sepPromise,
      _t0,
      thumbPromise,
      origUploadPromise,
    } = prepared;

    // ── Step 5: Match each speaker to a TTS voice (OpenAI, Inworld, Smallest, or ElevenLabs) ─
    emit({ stage: "generating", message: "Matching speakers to voices…" });
    await DubbingJob.findByIdAndUpdate(job._id, { status: "generating" });

    const dubbingSpeakerCount = speaker_profiles.length;

    let resolvedTtsProvider =
      ttsProvider === "openai"
        ? "openai"
        : ttsProvider === "inworld"
          ? "inworld"
          : ttsProvider === "smallest"
            ? "smallest"
            : ttsProvider === "sarvam"
              ? "sarvam"
              : ttsProvider === "gemini"
                ? "gemini"
                : ttsProvider === "auto"
                  ? "openai"
                  : "elevenlabs";
    let voiceMap = {};
    let updatedProfiles = [];

    if (ttsProvider === "openai") {
      emit({
        stage: "generating",
        message: "Selecting OpenAI TTS voices for speakers…",
      });
      const assignedVoiceIds = [];
      for (const profile of speaker_profiles) {
        emit({
          stage: "generating",
          message: `Selecting voice for ${profile.speaker_id}…`,
        });
        const v = await selectBestOpenAIVoice(profile.voice_description, {
          excludeVoiceIds: assignedVoiceIds,
          speakerCount: dubbingSpeakerCount,
        });
        assignedVoiceIds.push(v);
        voiceMap[profile.speaker_id] = v;
        updatedProfiles.push({
          speaker_id: profile.speaker_id,
          voice_description: profile.voice_description,
          elevenlabs_voice_id: v,
        });
      }
      await DubbingJob.findByIdAndUpdate(job._id, {
        speakerProfiles: updatedProfiles,
        ttsProvider: "openai",
      });
    } else if (ttsProvider === "inworld") {
      // console.log("targetLanguage", targetLanguage);

      emit({ stage: "generating", message: "Loading Inworld voice catalog…" });
      const inworldCatalog = await fetchInworldVoiceCatalog(targetLanguage);
      // console.log("inworldCatalog", inworldCatalog);

      emit({
        stage: "generating",
        message: "Selecting Inworld TTS voices for speakers…",
      });
      const assignedInworldIds = [];
      for (const profile of speaker_profiles) {
        emit({
          stage: "generating",
          message: `Selecting voice for ${profile.speaker_id}…`,
        });
        const v = await selectBestInworldVoice(
          profile.voice_description,
          inworldCatalog,
          {
            excludeVoiceIds: assignedInworldIds,
            speakerCount: dubbingSpeakerCount,
          },
        );
        assignedInworldIds.push(v);
        voiceMap[profile.speaker_id] = v;
        updatedProfiles.push({
          speaker_id: profile.speaker_id,
          voice_description: profile.voice_description,
          elevenlabs_voice_id: v,
        });
      }
      await DubbingJob.findByIdAndUpdate(job._id, {
        speakerProfiles: updatedProfiles,
        ttsProvider: "inworld",
      });
    } else if (ttsProvider === "smallest") {
      emit({
        stage: "generating",
        message: "Loading Smallest.ai Waves voice catalog…",
      });
      const smallestCatalog = await fetchSmallestVoiceCatalog();
      emit({
        stage: "generating",
        message: "Selecting Smallest TTS voices for speakers…",
      });
      const assignedSmallestIds = [];
      for (const profile of speaker_profiles) {
        emit({
          stage: "generating",
          message: `Selecting voice for ${profile.speaker_id}…`,
        });
        const v = await selectBestSmallestVoice(
          profile.voice_description,
          smallestCatalog,
          {
            excludeVoiceIds: assignedSmallestIds,
            speakerCount: dubbingSpeakerCount,
          },
        );
        assignedSmallestIds.push(v);
        voiceMap[profile.speaker_id] = v;
        updatedProfiles.push({
          speaker_id: profile.speaker_id,
          voice_description: profile.voice_description,
          elevenlabs_voice_id: v,
        });
      }
      await DubbingJob.findByIdAndUpdate(job._id, {
        speakerProfiles: updatedProfiles,
        ttsProvider: "smallest",
      });
    } else if (ttsProvider === "sarvam") {
      emit({
        stage: "generating",
        message: "Selecting Sarvam TTS voices for speakers…",
      });
      const assignedSarvamIds = [];
      for (const profile of speaker_profiles) {
        emit({
          stage: "generating",
          message: `Selecting voice for ${profile.speaker_id}…`,
        });
        const v = await selectBestSarvamVoice(profile.voice_description, {
          excludeVoiceIds: assignedSarvamIds,
          speakerCount: dubbingSpeakerCount,
        });
        assignedSarvamIds.push(v);
        voiceMap[profile.speaker_id] = v;
        updatedProfiles.push({
          speaker_id: profile.speaker_id,
          voice_description: profile.voice_description,
          elevenlabs_voice_id: v,
        });
      }
      await DubbingJob.findByIdAndUpdate(job._id, {
        speakerProfiles: updatedProfiles,
        ttsProvider: "sarvam",
      });
    } else if (ttsProvider === "gemini") {
      emit({
        stage: "generating",
        message: "Selecting Gemini 3.1 Flash TTS prebuilt voices for speakers…",
      });
      const assignedGemini = [];
      for (const profile of speaker_profiles) {
        emit({
          stage: "generating",
          message: `Selecting Gemini voice for ${profile.speaker_id}…`,
        });
        const v = await selectBestGeminiVoice(profile.voice_description, {
          excludeVoiceIds: assignedGemini,
          speakerCount: dubbingSpeakerCount,
        });
        assignedGemini.push(v);
        voiceMap[profile.speaker_id] = v;
        updatedProfiles.push({
          speaker_id: profile.speaker_id,
          voice_description: profile.voice_description,
          elevenlabs_voice_id: v,
        });
      }
      await DubbingJob.findByIdAndUpdate(job._id, {
        speakerProfiles: updatedProfiles,
        ttsProvider: "gemini",
      });
    } else if (ttsProvider === "auto") {
      // Voice map + synthesis for auto: Inworld → Smallest → ElevenLabs → OpenAI (Step 6)
    } else {
      const availableVoices = await fetchAvailableVoices();
      const assignedElIds = [];
      for (const profile of speaker_profiles) {
        emit({
          stage: "generating",
          message: `Selecting voice for ${profile.speaker_id}…`,
        });
        const voiceId = await selectBestVoice(
          profile.voice_description,
          availableVoices,
          {
            excludeVoiceIds: assignedElIds,
          },
        );
        assignedElIds.push(voiceId);
        voiceMap[profile.speaker_id] = voiceId;
        updatedProfiles.push({
          speaker_id: profile.speaker_id,
          voice_description: profile.voice_description,
          elevenlabs_voice_id: voiceId,
        });
      }
      await DubbingJob.findByIdAndUpdate(job._id, {
        speakerProfiles: updatedProfiles,
        ttsProvider: "elevenlabs",
      });
    }

    // ── Step 6: Generate TTS audio for each segment ──────────────────────────
    emit({
      stage: "generating",
      message: "Generating dubbed audio for each segment…",
    });

    const ttsRows = flattenTranslatedSegmentsForTts(translatedSegments);
    const maxAtempo = resolveMaxAtempo(targetLanguage);
    const syncOpts = { maxAtempo };

    let rawDubbedPaths;
    let wordTsForRows;
    let syncedBuffers;
    let segmentIds;
    let segmentAudioKeys;

    const stripAndCleanupPaths = (paths) => {
      const set = new Set(paths);
      for (let j = tmpPaths.length - 1; j >= 0; j--) {
        if (set.has(tmpPaths[j])) tmpPaths.splice(j, 1);
      }
      paths.forEach(cleanupPath);
    };

    const runSegmentPipeline = async (synthesizeProvider, pathCollector) => {
      const ids = translatedSegments.map(() => uuidv4());
      const audioKeys = new Map();
      const out = await pipelineTtsSyncUploadForDubbing({
        DubbingJob,
        jobMongoId: job._id,
        ttsRows,
        synthesizeProvider,
        voiceMap,
        targetLanguage,
        syncOpts,
        tmpPaths,
        emit,
        jobIdStr,
        segmentIds: ids,
        segmentAudioKeys: audioKeys,
        userId: req.userId,
        pathCollector,
      });
      return {
        rawDubbedPaths: out.rawDubbedPaths,
        wordTsForRows: out.wordTsForRows,
        syncedBuffers: out.syncedBuffers,
        segmentIds: ids,
        segmentAudioKeys: audioKeys,
      };
    };

    if (ttsProvider === "openai") {
      ({
        rawDubbedPaths,
        wordTsForRows,
        syncedBuffers,
        segmentIds,
        segmentAudioKeys,
      } = await runSegmentPipeline("openai"));
    } else if (ttsProvider === "inworld") {
      ({
        rawDubbedPaths,
        wordTsForRows,
        syncedBuffers,
        segmentIds,
        segmentAudioKeys,
      } = await runSegmentPipeline("inworld"));
    } else if (ttsProvider === "smallest") {
      ({
        rawDubbedPaths,
        wordTsForRows,
        syncedBuffers,
        segmentIds,
        segmentAudioKeys,
      } = await runSegmentPipeline("smallest"));
    } else if (ttsProvider === "sarvam") {
      ({
        rawDubbedPaths,
        wordTsForRows,
        syncedBuffers,
        segmentIds,
        segmentAudioKeys,
      } = await runSegmentPipeline("sarvam"));
    } else if (ttsProvider === "gemini") {
      ({
        rawDubbedPaths,
        wordTsForRows,
        syncedBuffers,
        segmentIds,
        segmentAudioKeys,
      } = await runSegmentPipeline("gemini"));
    } else if (ttsProvider === "auto") {
      let autoDone = false;
      const iwPaths = [];

      if (isInworldConfigured()) {
        try {
          emit({ stage: "generating", message: "Trying Inworld TTS…" });
          emit({
            stage: "generating",
            message: "Loading Inworld voice catalog…",
          });
          console.log("targetLanguage", targetLanguage);

          const inworldCatalog = await fetchInworldVoiceCatalog(targetLanguage);

          console.log("inworldCatalog", inworldCatalog);

          voiceMap = {};
          updatedProfiles = [];
          const assignedIwAuto = [];
          for (const profile of speaker_profiles) {
            emit({
              stage: "generating",
              message: `Selecting Inworld voice for ${profile.speaker_id}…`,
            });
            const v = await selectBestInworldVoice(
              profile.voice_description,
              inworldCatalog,
              {
                excludeVoiceIds: assignedIwAuto,
                speakerCount: dubbingSpeakerCount,
              },
            );
            assignedIwAuto.push(v);
            voiceMap[profile.speaker_id] = v;
            updatedProfiles.push({
              speaker_id: profile.speaker_id,
              voice_description: profile.voice_description,
              elevenlabs_voice_id: v,
            });
          }
          await DubbingJob.findByIdAndUpdate(job._id, {
            speakerProfiles: updatedProfiles,
            ttsProvider: "inworld",
          });

          ({
            rawDubbedPaths,
            wordTsForRows,
            syncedBuffers,
            segmentIds,
            segmentAudioKeys,
          } = await runSegmentPipeline("inworld", iwPaths));
          resolvedTtsProvider = "inworld";
          autoDone = true;
        } catch (iwErr) {
          console.warn("[dubbing] Inworld TTS failed:", iwErr.message);
          stripAndCleanupPaths(iwPaths);
          emit({
            stage: "generating",
            message: `Inworld TTS failed; trying Smallest.ai. (${iwErr.message})`,
          });
        }
      }

      if (!autoDone && isSmallestConfigured()) {
        const smPaths = [];
        try {
          emit({
            stage: "generating",
            message: "Trying Smallest.ai Waves TTS…",
          });
          const smallestCatalog = await fetchSmallestVoiceCatalog();
          voiceMap = {};
          updatedProfiles = [];
          const assignedSmAuto = [];
          for (const profile of speaker_profiles) {
            emit({
              stage: "generating",
              message: `Selecting Smallest voice for ${profile.speaker_id}…`,
            });
            const v = await selectBestSmallestVoice(
              profile.voice_description,
              smallestCatalog,
              {
                excludeVoiceIds: assignedSmAuto,
                speakerCount: dubbingSpeakerCount,
              },
            );
            assignedSmAuto.push(v);
            voiceMap[profile.speaker_id] = v;
            updatedProfiles.push({
              speaker_id: profile.speaker_id,
              voice_description: profile.voice_description,
              elevenlabs_voice_id: v,
            });
          }
          await DubbingJob.findByIdAndUpdate(job._id, {
            speakerProfiles: updatedProfiles,
            ttsProvider: "smallest",
          });

          ({
            rawDubbedPaths,
            wordTsForRows,
            syncedBuffers,
            segmentIds,
            segmentAudioKeys,
          } = await runSegmentPipeline("smallest", smPaths));
          resolvedTtsProvider = "smallest";
          autoDone = true;
        } catch (smErr) {
          console.warn("[dubbing] Smallest TTS failed:", smErr.message);
          stripAndCleanupPaths(smPaths);
          emit({
            stage: "generating",
            message: `Smallest TTS failed; trying ElevenLabs. (${smErr.message})`,
          });
        }
      }

      if (!autoDone) {
        const elPaths = [];
        try {
          emit({ stage: "generating", message: "Trying ElevenLabs TTS…" });
          const availableVoices = await fetchAvailableVoices();
          voiceMap = {};
          updatedProfiles = [];
          const assignedElAuto = [];
          for (const profile of speaker_profiles) {
            emit({
              stage: "generating",
              message: `Selecting voice for ${profile.speaker_id}…`,
            });
            const voiceId = await selectBestVoice(
              profile.voice_description,
              availableVoices,
              {
                excludeVoiceIds: assignedElAuto,
              },
            );
            assignedElAuto.push(voiceId);
            voiceMap[profile.speaker_id] = voiceId;
            updatedProfiles.push({
              speaker_id: profile.speaker_id,
              voice_description: profile.voice_description,
              elevenlabs_voice_id: voiceId,
            });
          }
          await DubbingJob.findByIdAndUpdate(job._id, {
            speakerProfiles: updatedProfiles,
            ttsProvider: "elevenlabs",
          });

          ({
            rawDubbedPaths,
            wordTsForRows,
            syncedBuffers,
            segmentIds,
            segmentAudioKeys,
          } = await runSegmentPipeline("elevenlabs", elPaths));
          resolvedTtsProvider = "elevenlabs";
          autoDone = true;
        } catch (elErr) {
          stripAndCleanupPaths(elPaths);
          const blocked = isElevenLabsLibraryVoiceBlockedError(elErr);
          console.warn("[dubbing] ElevenLabs TTS failed:", elErr.message);
          emit({
            stage: "generating",
            message: blocked
              ? "ElevenLabs TTS not available on this plan; using OpenAI TTS."
              : `ElevenLabs TTS failed; using OpenAI TTS. (${elErr.message})`,
          });
        }
      }

      if (!autoDone) {
        emit({
          stage: "generating",
          message: "Selecting OpenAI TTS voices for speakers…",
        });
        voiceMap = {};
        updatedProfiles = [];
        const assignedOaiAuto = [];
        for (const profile of speaker_profiles) {
          emit({
            stage: "generating",
            message: `Selecting voice for ${profile.speaker_id}…`,
          });
          const v = await selectBestOpenAIVoice(profile.voice_description, {
            excludeVoiceIds: assignedOaiAuto,
            speakerCount: dubbingSpeakerCount,
          });
          assignedOaiAuto.push(v);
          voiceMap[profile.speaker_id] = v;
          updatedProfiles.push({
            speaker_id: profile.speaker_id,
            voice_description: profile.voice_description,
            elevenlabs_voice_id: v,
          });
        }
        await DubbingJob.findByIdAndUpdate(job._id, {
          speakerProfiles: updatedProfiles,
          ttsProvider: "openai",
        });
        resolvedTtsProvider = "openai";

        ({
          rawDubbedPaths,
          wordTsForRows,
          syncedBuffers,
          segmentIds,
          segmentAudioKeys,
        } = await runSegmentPipeline("openai"));
      }
    } else {
      ({
        rawDubbedPaths,
        wordTsForRows,
        syncedBuffers,
        segmentIds,
        segmentAudioKeys,
      } = await runSegmentPipeline("elevenlabs"));
    }

    const timelineSegments = ttsRows.map((row) => ({
      start: row.start,
      end: row.end,
      speaker_id: row.speaker_id,
      translatedText: row.text,
    }));

    const timeline = buildTimeline(timelineSegments, syncedBuffers);

    const parentSubSegments = new Map();
    const parentSolo = new Map();
    translatedSegments.forEach((_, i) => parentSubSegments.set(i, []));
    for (let k = 0; k < ttsRows.length; k++) {
      const row = ttsRows[k];
      const sync = syncedBuffers[k];
      const wts = wordTsForRows[k];
      if (row.subIndex >= 0) {
        parentSubSegments.get(row.parentIndex).push({
          relStart: row.relStart,
          relEnd: row.relEnd,
          translatedText: row.text,
          timingStrategy: sync.strategy,
          ttsWordTimestamps: wts && wts.length ? wts : undefined,
        });
      } else {
        parentSolo.set(row.parentIndex, {
          timingStrategy: sync.strategy,
          ttsWordTimestamps: wts && wts.length ? wts : undefined,
        });
      }
    }

    console.log(`[dubbing:timing] TTS+sync done: ${Date.now() - (_t0 || Date.now())}ms elapsed total`);

    // ── Step 8: Await stems (may already be done) then mix ────────────────────
    emit({
      stage: "merging",
      message: "Mixing dubbed speech with background audio…",
    });
    await DubbingJob.findByIdAndUpdate(job._id, { status: "merging" });

    // Separation runs concurrently with TTS; await the result now.
    const { backgroundPath, method: separationMethod } = await sepPromise;

    const mixedAudioPath = path.join(os.tmpdir(), `dub_mixed_${uuidv4()}.mp3`);
    tmpPaths.push(mixedAudioPath);

    await layerSpeechOverBackground(
      timeline,
      backgroundPath,
      mixedAudioPath,
      duration,
    );

    const mixTargetSec = Math.max(
      duration,
      (await getFileDuration(tmpInput).catch(() => 0)) || 0,
      (await getFileDuration(backgroundPath).catch(() => 0)) || 0,
    );
    const paddedMixPath = path.join(
      os.tmpdir(),
      `dub_mixed_pad_${uuidv4()}.mp3`,
    );
    const mixResult = await ensureMinAudioDuration(
      mixedAudioPath,
      mixTargetSec,
      paddedMixPath,
    );
    if (mixResult.padded) {
      tmpPaths.push(paddedMixPath);
      console.warn(
        `[dubbing] Final mix was ${mixResult.before.toFixed(2)}s; padded to ${mixResult.after.toFixed(2)}s (target ${mixTargetSec.toFixed(2)}s) so audio matches video length.`,
      );
    }
    const mixedAudioForOutput = mixResult.path;

    saveArtifact(jobIdStr, "dubbed_mix.mp3", mixedAudioForOutput);
    console.log(`[dubbing:timing] mix done: ${Date.now() - (_t0 || Date.now())}ms elapsed total`);

    // ── Step 9 (v1): Upload dubbed audio only — video mux is done client-side ─
    // Lip-sync and server-side video mux are deferred to a future opt-in path.
    emit({ stage: "merging", message: "Uploading dubbed audio…" });

    let dubbedAudioKey = null;
    try {
      dubbedAudioKey = `dubbing/${req.userId}/${uuidv4()}_dubbed_audio.mp3`;
      await storage.saveFile(
        fs.readFileSync(mixedAudioForOutput),
        dubbedAudioKey,
        "audio/mpeg",
      );
    } catch (mixUploadErr) {
      console.warn("Dubbed audio upload failed:", mixUploadErr.message);
    }

    saveArtifact(jobIdStr, "final_dubbed.mp3", mixedAudioForOutput);
    console.log(`[dubbing:timing] upload done: ${Date.now() - (_t0 || Date.now())}ms elapsed total`);

    // ── Step 10: Confirm usage reservation + Deduct credits + finalise job ────
    emit({ stage: "saving", message: "Saving results…" });

    if (req.dubbingUsageReserved) {
      await confirmDubbingUsage(
        req.userId,
        job._id,
        req.dubbingDurationSeconds ?? duration,
        duration,
      ).catch((e) =>
        console.warn("[dubbing] Usage confirm failed (non-fatal):", e.message),
      );
    }

    await DubbingJob.findByIdAndUpdate(job._id, {
      processedSeconds: duration,
    }).catch(() => {});

    await deductCredits(
      req.userId,
      creditsNeeded,
      "dubbing_job",
      `Dubbed ${job.originalFileName} → ${targetLanguage} (${creditsNeeded} credits)`,
      {
        fileName: job.originalFileName,
        fileType: preparedIsVideo ? "video" : "audio",
        sourceLanguage: sourceLanguage || "auto",
        targetLanguage,
        duration,
        jobId: job._id,
      },
    );

    // Persist final state to DB
    const segmentsForDb = translatedSegments.map((ts, i) => {
      const subs = parentSubSegments.get(i) || [];
      const solo = parentSolo.get(i);
      return {
        segmentId: segmentIds[i],
        revision: 0,
        start: ts.start,
        end: ts.end,
        speaker_id: ts.speaker_id,
        originalText: ts.originalText,
        translatedText: ts.translatedText,
        subSegments: subs.length ? subs : [],
        timingStrategy: subs.length ? null : (solo?.timingStrategy ?? null),
        ttsWordTimestamps: subs.length ? undefined : solo?.ttsWordTimestamps,
        voiceProfile: ts.voiceProfile,
        dubbedAudioKey: subs.length ? null : (segmentAudioKeys.get(i) ?? null),
      };
    });

    // Ensure background uploads that set original keys have finished before we finalize the job.
    await Promise.allSettled([origUploadPromise, thumbPromise]);
    const originalKeys = await DubbingJob.findById(job._id)
      .select("originalVideoKey originalAudioKey")
      .lean()
      .catch(() => null);
    const originalVideoKeyForJob = originalKeys?.originalVideoKey ?? null;

    const finalJob = await DubbingJob.findByIdAndUpdate(
      job._id,
      {
        status: "completed",
        // v1: we don't generate a dubbed MP4; keep the original video key here for the UI.
        dubbedVideoKey: originalVideoKeyForJob,
        dubbedVideoUrl: null,
        dubbedAudioKey,
        dubbedAudioUrl: null,
        separationMethod,
        ttsProvider: resolvedTtsProvider,
        segments: segmentsForDb,
        speakerProfiles: updatedProfiles,
      },
      { new: true },
    );

    console.log(`[dubbing:timing] TOTAL pipeline: ${Date.now() - (_t0 || Date.now())}ms`);

    emit({
      stage: "done",
      message: "Dubbing complete!",
      job: finalJob,
      dubbedUrl: dubbedAudioKey,
    });

    // Best-effort completion email (send once per job).
    try {
      const alreadySent = Boolean(finalJob?.completionEmailSentAt);
      if (!alreadySent) {
        const user = await User.findById(req.userId)
          .select("email preferences.emailNotifications")
          .lean();
        const emailOk =
          Boolean(user?.email) && user?.preferences?.emailNotifications !== false;
        if (emailOk) {
          await sendDubbingCompletedEmail({
            email: user.email,
            jobId: finalJob._id.toString(),
            fileName: finalJob.originalFileName,
            targetLanguage: finalJob.targetLanguage,
          });
          await DubbingJob.findByIdAndUpdate(finalJob._id, {
            completionEmailSentAt: new Date(),
          }).catch(() => {});
        }
      }
    } catch (e) {
      console.warn("[dubbing] completion email failed (non-fatal):", e.message);
    }

  

    res.end();
  } catch (err) {
    console.error("Dubbing pipeline error:", err);

    // Atomically refund the usage reservation.
    // Only refunds the unused portion: reserved - processed.
    // processedSeconds is null until the pipeline stamps it, so failed early-stage
    // jobs (transcription, separation) get a full refund (processedSeconds = 0).
    if (req.dubbingUsageReserved && req.dubbingDurationSeconds) {
      const processedSec =
        job && job.processedSeconds != null ? job.processedSeconds : 0; // no partial processing tracked → full refund
      await refundDubbingUsage(
        req.userId,
        job?._id ?? "unknown",
        req.dubbingDurationSeconds,
        processedSec,
      ).catch((e) =>
        console.warn("[dubbing] Usage refund failed (non-fatal):", e.message),
      );
    }

    if (job) {
      await DubbingJob.findByIdAndUpdate(job._id, {
        status: "failed",
        error: err.message || "Unknown error",
      }).catch(() => {});
    }

    try {
      emit({
        stage: "error",
        message: err.message || "An unexpected error occurred.",
        statusCode: err.statusCode || 500,
        jobId: job?._id || null,
      });
      res.end();
    } catch (_) {}
  } finally {
    // Ensure background uploads that read temp files finish before cleanup.
    try {
      const bg = [];
      if (typeof thumbPromise?.then === "function") bg.push(thumbPromise);
      if (typeof origUploadPromise?.then === "function") bg.push(origUploadPromise);
      await Promise.allSettled(bg);
    } catch (_) {}

    // Clean up all temp files
    tmpPaths.forEach(cleanupPath);
  }
};

/**
 * POST /api/dubbing/start-youtube
 * Body: { youtubeUrl, targetLanguage, sourceLanguage? }
 *
 * Notes:
 * - Downloads the video first, then reuses the existing upload-based SSE pipeline.
 * - The SSE stream begins after the download completes (simpler + minimal-risk).
 */
exports.startDubbingFromYoutube = async (req, res) => {
  const tmpPaths = [];
  try {
    const youtubeUrl = (req.body.youtubeUrl || "").trim();
    const dl = await downloadYoutubeVideo(youtubeUrl);
    tmpPaths.push(dl.filePath);

    const buf = fs.readFileSync(dl.filePath);
    const summary = await getMediaStreamSummary(dl.filePath);
    const extFromPath = path.extname(dl.filePath).toLowerCase() || ".mp4";

    let mimetype;
    let nameExt;
    if (summary.hasVideo) {
      if (extFromPath === ".webm") mimetype = "video/webm";
      else if (extFromPath === ".mkv") mimetype = "video/x-matroska";
      else mimetype = "video/mp4";
      nameExt = [".mp4", ".webm", ".mkv"].includes(extFromPath)
        ? extFromPath
        : ".mp4";
    } else {
      const audioMimeByExt = {
        ".m4a": "audio/mp4",
        ".mp4": "audio/mp4",
        ".webm": "audio/webm",
        ".opus": "audio/opus",
        ".ogg": "audio/ogg",
        ".mp3": "audio/mpeg",
      };
      mimetype = audioMimeByExt[extFromPath] || "audio/mp4";
      nameExt = extFromPath || ".m4a";
    }

    req.file = {
      buffer: buf,
      mimetype,
      originalname: `YouTube - ${dl.title}${nameExt}`,
    };

    return await exports.startDubbingJob(req, res);
  } catch (err) {
    const status = err.statusCode || 500;
    return res.status(status).json({
      message: err.message || "Failed to download YouTube video.",
    });
  } finally {
    tmpPaths.forEach(cleanupPath);
  }
};

/**
 * GET /api/dubbing/:id
 * Returns the current state of a dubbing job.
 */
exports.getDubbingJob = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      const err = new Error("Dubbing job not found.");
      err.statusCode = 404;
      throw err;
    }

    const job = await DubbingJob.findById(req.params.id);
    if (!job) {
      const err = new Error("Dubbing job not found.");
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

/**
 * GET /api/dubbing
 * Returns a paginated list of the user's dubbing jobs (without segment data).
 */
exports.getDubbingJobs = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 10);
    const skip = (page - 1) * limit;

    const [jobs, total] = await Promise.all([
      DubbingJob.find({ user: req.userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select("-segments"),
      DubbingJob.countDocuments({ user: req.userId }),
    ]);

    const jobsWithThumbs = await Promise.all(
      jobs.map(async (j) => {
        const job = j.toObject ? j.toObject() : j;
        if (!job.thumbnailKey) return job;
        try {
          return {
            ...job,
            thumbnailUrl: await storage.getPublicUrl(job.thumbnailKey),
          };
        } catch (_) {
          return job;
        }
      }),
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

/**
 * GET /api/dubbing/:id/editor
 * Returns job data needed for the editor UI.
 * Backfills missing segmentId values for older jobs.
 */
exports.getDubbingEditor = async (req, res, next) => {
  try {
    const job = await ensureJobEditable(req, req.params.id);

    let touched = false;
    const segments = (job.segments || []).map((s) => {
      if (!s.segmentId) {
        touched = true;
        return {
          ...(s.toObject?.() ?? s),
          segmentId: uuidv4(),
          revision: s.revision ?? 0,
        };
      }
      return s;
    });

    if (touched) {
      job.segments = segments;
      await job.save();
    }

    res.json({
      job: {
        _id: job._id,
        status: job.status,
        originalFileName: job.originalFileName,
        fileType: job.fileType,
        sourceLanguage: job.sourceLanguage,
        targetLanguage: job.targetLanguage,
        duration: job.duration,
        dubbedVideoUrl: job.dubbedVideoUrl,
        dubbedAudioUrl: job.dubbedAudioUrl,
        originalVideoKey: job.originalVideoKey,
        originalAudioKey: job.originalAudioKey,
        vocalsKey: job.vocalsKey,
        backgroundKey: job.backgroundKey,
        ttsProvider: job.ttsProvider,
        speakerProfiles: job.speakerProfiles,
        segments: job.segments,
      },
    });
  } catch (err) {
    if (!err.statusCode) err.statusCode = 500;
    next(err);
  }
};

/**
 * PATCH /api/dubbing/:id/segments/:segmentId
 * Updates editable segment metadata (text/timing/strategy).
 */
exports.patchDubbingSegment = async (req, res, next) => {
  try {
    const job = await ensureJobEditable(req, req.params.id);
    const { segmentId } = req.params;

    const idx = (job.segments || []).findIndex(
      (s) => s.segmentId === segmentId,
    );
    if (idx === -1) {
      const err = new Error("Segment not found.");
      err.statusCode = 404;
      throw err;
    }

    const patch = req.body || {};
    const seg = job.segments[idx];

    if (typeof patch.translatedText === "string") {
      seg.translatedText = patch.translatedText;
    }
    if (typeof patch.start === "number") seg.start = patch.start;
    if (typeof patch.end === "number") seg.end = patch.end;
    if (typeof patch.timingStrategy === "string")
      seg.timingStrategy = patch.timingStrategy;

    // Basic validation
    if (
      !(Number.isFinite(seg.start) && Number.isFinite(seg.end)) ||
      seg.end <= seg.start
    ) {
      const err = new Error("Invalid segment timing.");
      err.statusCode = 422;
      throw err;
    }

    seg.revision = (seg.revision ?? 0) + 1;
    await job.save();

    res.json({ segment: seg });
  } catch (err) {
    if (!err.statusCode) err.statusCode = 500;
    next(err);
  }
};

/**
 * POST /api/dubbing/:id/segments/:segmentId/improve
 * Improves translated text for natural speech while keeping timing constraints.
 */
exports.improveDubbingSegment = async (req, res, next) => {
  try {
    const job = await ensureJobEditable(req, req.params.id);
    const { segmentId } = req.params;
    const seg = (job.segments || []).find((s) => s.segmentId === segmentId);
    if (!seg) {
      const err = new Error("Segment not found.");
      err.statusCode = 404;
      throw err;
    }

    const targetSeconds = Math.max(0.2, (seg.end ?? 0) - (seg.start ?? 0));
    const systemPrompt = `You are a professional dubbing script editor.

Task: Rewrite the provided text to sound natural for SPOKEN delivery in ${job.targetLanguage}.

Constraints:
1) Keep the meaning the same.
2) Fit a time budget of ~${targetSeconds.toFixed(2)} seconds when spoken.
3) Keep names/technical terms unchanged.
4) Keep it as ONE segment (do not add/remove sentences).
5) Return ONLY valid JSON: { "improved_text": "..." }`;

    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: JSON.stringify({
            original_text: seg.originalText || "",
            current_translated_text: seg.translatedText || "",
          }),
        },
      ],
    });

    let improvedText = "";
    try {
      let text = response.choices[0].message.content.trim();
      text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
      const parsed = JSON.parse(text);
      improvedText = String(parsed.improved_text || "").trim();
    } catch (parseErr) {
      const err = new Error(
        `Improve response parse failed: ${parseErr.message}`,
      );
      err.statusCode = 500;
      throw err;
    }

    res.json({ improvedText });
  } catch (err) {
    if (!err.statusCode) err.statusCode = 500;
    next(err);
  }
};

/**
 * POST /api/dubbing/:id/segments/:segmentId/regenerate
 * Generates new TTS audio for a segment and stores it in the job.
 */
exports.regenerateDubbingSegment = async (req, res, next) => {
  const tmpPaths = [];
  try {
    const job = await ensureJobEditable(req, req.params.id);
    const { segmentId } = req.params;
    const seg = (job.segments || []).find((s) => s.segmentId === segmentId);
    if (!seg) {
      const err = new Error("Segment not found.");
      err.statusCode = 404;
      throw err;
    }

    const speakerProfile = (job.speakerProfiles || []).find(
      (p) => p.speaker_id === seg.speaker_id,
    );
    const voiceKey = speakerProfile?.elevenlabs_voice_id;
    if (!voiceKey) {
      const err = new Error(
        `No voice configured for speaker: ${seg.speaker_id}`,
      );
      err.statusCode = 422;
      throw err;
    }

    const provider = job.ttsProvider || getTtsProvider();
    const rawText = String(seg.translatedText || "").trim();
    if (!rawText) {
      const err = new Error("Segment translatedText is empty.");
      err.statusCode = 422;
      throw err;
    }

    const maxAtempo = resolveMaxAtempo(job.targetLanguage);
    const syncOpts = { maxAtempo };

    // Step 1: Generate raw TTS
    const { audioPath: ttsPath } = await synthesizeDubbingTts(
      provider,
      rawText,
      voiceKey,
      job.targetLanguage,
    );
    tmpPaths.push(ttsPath);

    // Step 2: Sync timing to segment slot
    const originalDuration = (seg.end ?? 0) - (seg.start ?? 0);
    const synced = await syncSegmentTiming(ttsPath, originalDuration, syncOpts);
    tmpPaths.push(synced.adjustedPath);

    // Step 3: Upload per-segment audio
    const nextRev = (seg.revision ?? 0) + 1;
    const key = `dubbing/${req.userId}/${job._id.toString()}/segments/${segmentId}_r${nextRev}.mp3`;
    await storage.saveFile(
      fs.readFileSync(synced.adjustedPath),
      key,
      "audio/mpeg",
    );
    const url = await storage.getPublicUrl(key);

    seg.dubbedAudioKey = key;
    seg.timingStrategy = synced.strategy;
    seg.revision = nextRev;
    await job.save();

    res.json({
      segment: seg,
      audio: {
        key,
        url,
        strategy: synced.strategy,
        adjustedDuration: synced.adjustedDuration,
      },
    });
  } catch (err) {
    if (!err.statusCode) err.statusCode = 500;
    next(err);
  } finally {
    tmpPaths.forEach(cleanupPath);
  }
};

/**
 * POST /api/dubbing/:id/segments
 * Adds a brand-new segment (with TTS audio) to an existing completed job.
 */
exports.addDubbingSegment = async (req, res, next) => {
  const tmpPaths = [];
  try {
    const job = await ensureJobEditable(req, req.params.id);
    const { start, end, speaker_id, translatedText } = req.body || {};

    // ── Validate inputs ────────────────────────────────────────────────────────
    if (typeof start !== "number" || typeof end !== "number" || end <= start) {
      const err = new Error(
        "Valid start and end seconds are required (end > start).",
      );
      err.statusCode = 422;
      throw err;
    }
    if (!String(speaker_id || "").trim()) {
      const err = new Error("speaker_id is required.");
      err.statusCode = 422;
      throw err;
    }
    const rawText = String(translatedText || "").trim();
    if (!rawText) {
      const err = new Error("translatedText is required.");
      err.statusCode = 422;
      throw err;
    }

    // ── Resolve voice ──────────────────────────────────────────────────────────
    const speakerProfile = (job.speakerProfiles || []).find(
      (p) => p.speaker_id === speaker_id,
    );
    const voiceKey = speakerProfile?.elevenlabs_voice_id;
    if (!voiceKey) {
      const err = new Error(`No voice configured for speaker: ${speaker_id}`);
      err.statusCode = 422;
      throw err;
    }

    const provider = job.ttsProvider || getTtsProvider();
    const maxAtempo = resolveMaxAtempo(job.targetLanguage);
    const syncOpts = { maxAtempo };

    // ── Generate TTS ───────────────────────────────────────────────────────────
    const { audioPath: ttsPath } = await synthesizeDubbingTts(
      provider,
      rawText,
      voiceKey,
      job.targetLanguage,
    );
    tmpPaths.push(ttsPath);

    // ── Sync to slot duration ──────────────────────────────────────────────────
    const originalDuration = Math.max(0.05, end - start);
    const synced = await syncSegmentTiming(ttsPath, originalDuration, syncOpts);
    tmpPaths.push(synced.adjustedPath);

    // ── Upload to S3 ───────────────────────────────────────────────────────────
    const segmentId = uuidv4();
    const key = `dubbing/${req.userId}/${job._id.toString()}/segments/${segmentId}_r0.mp3`;
    await storage.saveFile(
      fs.readFileSync(synced.adjustedPath),
      key,
      "audio/mpeg",
    );
    const url = await storage.getPublicUrl(key);

    // ── Persist new segment ────────────────────────────────────────────────────
    const newSegment = {
      segmentId,
      revision: 0,
      start,
      end,
      speaker_id,
      originalText: "",
      translatedText: rawText,
      dubbedAudioKey: key,
      timingStrategy: synced.strategy,
      subSegments: [],
      voiceProfile: { source: null },
    };

    job.segments.push(newSegment);
    // Keep segments sorted by start time for timeline consistency
    job.segments.sort((a, b) => a.start - b.start);
    await job.save();

    res.status(201).json({
      segment: newSegment,
      audio: {
        key,
        url,
        strategy: synced.strategy,
        adjustedDuration: synced.adjustedDuration,
      },
    });
  } catch (err) {
    if (!err.statusCode) err.statusCode = 500;
    next(err);
  } finally {
    tmpPaths.forEach(cleanupPath);
  }
};

/**
 * POST /api/dubbing/:id/rebuild
 * Rebuilds the full dubbed mix (and muxes video if needed) using stored per-segment audio when available.
 */
exports.rebuildDubbingJob = async (req, res, next) => {
  const tmpPaths = [];
  try {
    const stream = String(req.query.stream || "0").trim() === "1";
    const emit = stream
      ? (data) => {
          try {
            res.write(`data: ${JSON.stringify(data)}\n\n`);
          } catch (_) {}
        }
      : null;

    if (stream) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders();
    }

    const job = await ensureJobEditable(req, req.params.id);
    await DubbingJob.findByIdAndUpdate(job._id, { status: "merging" }).catch(
      () => {},
    );
    if (emit) emit({ stage: "merging", message: "Starting rebuild…" });

    if (!job.backgroundKey) {
      const err = new Error(
        "Cannot rebuild: background stem not available for this job.",
      );
      err.statusCode = 422;
      throw err;
    }

    // Download background stem
    if (emit) emit({ stage: "merging", message: "Loading background stem…" });
    const bgBody = await storage.getFile(job.backgroundKey);
    const bgBuf = await streamToBuffer(bgBody);
    const bgPath = path.join(os.tmpdir(), `dub_bg_${uuidv4()}.mp3`);
    fs.writeFileSync(bgPath, bgBuf);
    tmpPaths.push(bgPath);

    // Prepare local adjusted paths for each segment
    const provider = job.ttsProvider || getTtsProvider();
    const speakerVoiceMap = {};
    for (const p of job.speakerProfiles || [])
      speakerVoiceMap[p.speaker_id] = p.elevenlabs_voice_id;

    const segmentAudioLocal = [];
    const allSegs = job.segments || [];
    const maxAtempo = resolveMaxAtempo(job.targetLanguage);
    const syncOpts = { maxAtempo };

    for (let i = 0; i < allSegs.length; i++) {
      const seg = allSegs[i];
      if (emit) {
        emit({
          stage: "merging",
          message: `Preparing segment ${i + 1}/${allSegs.length}…`,
          progress: Math.round(((i + 1) / allSegs.length) * 60),
          segmentId: seg.segmentId,
        });
      }

      const pushSyncedClip = async (localMp3Path, rowStart, rowEnd) => {
        const originalDuration = Math.max(
          0.05,
          (rowEnd ?? 0) - (rowStart ?? 0),
        );
        const synced = await syncSegmentTiming(
          localMp3Path,
          originalDuration,
          syncOpts,
        );
        tmpPaths.push(synced.adjustedPath);
        segmentAudioLocal.push({
          start: rowStart,
          adjustedPath: synced.adjustedPath,
          adjustedDuration: synced.adjustedDuration,
        });
      };

      if (seg.dubbedAudioKey) {
        const body = await storage.getFile(seg.dubbedAudioKey);
        const buf = await streamToBuffer(body);
        const localMp3Path = path.join(
          os.tmpdir(),
          `seg_${seg.segmentId}_${uuidv4()}.mp3`,
        );
        fs.writeFileSync(localMp3Path, buf);
        tmpPaths.push(localMp3Path);
        await pushSyncedClip(localMp3Path, seg.start, seg.end);
      } else {
        const voiceKey = speakerVoiceMap[seg.speaker_id];
        if (!voiceKey) {
          const err = new Error(
            `No voice configured for speaker: ${seg.speaker_id}`,
          );
          err.statusCode = 422;
          throw err;
        }
        const rows = flattenJobSegmentForTts(seg);
        if (!rows.length) continue;

        for (const row of rows) {
          const { audioPath: ttsPath } = await synthesizeDubbingTts(
            provider,
            row.text,
            voiceKey,
            job.targetLanguage,
          );
          tmpPaths.push(ttsPath);
          await pushSyncedClip(ttsPath, row.start, row.end);
        }
      }
    }

    if (emit)
      emit({
        stage: "merging",
        message: "Mixing dubbed speech over background…",
        progress: 75,
      });
    const mixedAudioPath = path.join(os.tmpdir(), `dub_mix_${uuidv4()}.mp3`);
    tmpPaths.push(mixedAudioPath);
    await layerSpeechOverBackground(
      segmentAudioLocal,
      bgPath,
      mixedAudioPath,
      job.duration || 0,
    );

    const rebuildMixTarget = Math.max(
      job.duration || 0,
      (await getFileDuration(bgPath).catch(() => 0)) || 0,
    );
    const rebuildPaddedPath = path.join(
      os.tmpdir(),
      `dub_mix_pad_${uuidv4()}.mp3`,
    );
    let mixedForRebuild = (
      await ensureMinAudioDuration(
        mixedAudioPath,
        rebuildMixTarget,
        rebuildPaddedPath,
      )
    ).path;
    if (mixedForRebuild === rebuildPaddedPath) tmpPaths.push(rebuildPaddedPath);

    let dubbedAudioKey = null;
    let dubbedAudioUrl = null;
    let dubbedVideoUrl = job.dubbedVideoUrl;
    let dubbedVideoKey = job.dubbedVideoKey;

    let mixedForUpload = mixedForRebuild;

    if (job.fileType === "video") {
      if (!job.originalVideoKey) {
        const err = new Error(
          "Cannot rebuild video: original video key not available.",
        );
        err.statusCode = 422;
        throw err;
      }
      if (emit)
        emit({
          stage: "merging",
          message: "Rebuilding video output…",
          progress: 90,
        });
      const vidBody = await storage.getFile(job.originalVideoKey);
      const vidBuf = await streamToBuffer(vidBody);
      const vidPath = path.join(os.tmpdir(), `dub_vid_${uuidv4()}.mp4`);
      fs.writeFileSync(vidPath, vidBuf);
      tmpPaths.push(vidPath);

      const vidDur = (await getFileDuration(vidPath).catch(() => 0)) || 0;
      const muxTarget = Math.max(rebuildMixTarget, vidDur);
      const rebuildMuxPadPath = path.join(
        os.tmpdir(),
        `dub_mix_muxpad_${uuidv4()}.mp3`,
      );
      const muxMix = (
        await ensureMinAudioDuration(
          mixedForRebuild,
          muxTarget,
          rebuildMuxPadPath,
        )
      ).path;
      if (muxMix === rebuildMuxPadPath) tmpPaths.push(rebuildMuxPadPath);
      mixedForUpload = muxMix;

      const outVideoPath = path.join(os.tmpdir(), `dub_final_${uuidv4()}.mp4`);
      tmpPaths.push(outVideoPath);

      // Try lipsync (optional) else mux
      let lipsyncedPath = null;
      try {
        lipsyncedPath = await lipSyncVideo({
          inputVideoPath: vidPath,
          inputAudioPath: mixedForUpload,
          outputVideoPath: outVideoPath,
        });
      } catch (lipErr) {
        const strict = String(process.env.LIPSYNC_STRICT || "0").trim() === "1";
        if (strict) throw lipErr;
      }
      if (!lipsyncedPath) {
        await muxWithVideo(vidPath, mixedForUpload, outVideoPath);
      }

      const key = `dubbing/${req.userId}/${uuidv4()}_dubbed_rebuild.mp4`;
      await storage.saveFile(fs.readFileSync(outVideoPath), key, "video/mp4");
      dubbedVideoKey = key;
      dubbedVideoUrl = await storage.getPublicUrl(key);
    }

    if (emit)
      emit({
        stage: "merging",
        message: "Uploading rebuilt audio…",
        progress: 85,
      });
    dubbedAudioKey = `dubbing/${req.userId}/${uuidv4()}_dubbed_audio_rebuild.mp3`;
    await storage.saveFile(
      fs.readFileSync(mixedForUpload),
      dubbedAudioKey,
      "audio/mpeg",
    );
    dubbedAudioUrl = await storage.getPublicUrl(dubbedAudioKey);

    const updated = await DubbingJob.findByIdAndUpdate(
      job._id,
      {
        status: "completed",
        dubbedAudioKey,
        dubbedAudioUrl,
        dubbedVideoKey,
        dubbedVideoUrl,
      },
      { new: true },
    );

    if (emit) {
      emit({
        stage: "done",
        message: "Rebuild complete.",
        job: updated,
        progress: 100,
      });
      return res.end();
    }
    res.json({ job: updated });
  } catch (err) {
    const stream = String(req.query.stream || "0").trim() === "1";
    if (stream) {
      try {
        res.write(
          `data: ${JSON.stringify({
            stage: "error",
            message: err.message || "Rebuild failed.",
            statusCode: err.statusCode || 500,
          })}\n\n`,
        );
        return res.end();
      } catch (_) {}
    }
    if (!err.statusCode) err.statusCode = 500;
    next(err);
  } finally {
    tmpPaths.forEach(cleanupPath);
  }
};
