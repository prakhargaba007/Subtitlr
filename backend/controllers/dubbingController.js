const fs = require("fs");
const path = require("path");
const os = require("os");
const { v4: uuidv4 } = require("uuid");
const mongoose = require("mongoose");
const OpenAI = require("openai");

const DubbingJob = require("../models/DubbingJob");
const { generateSRT, generateVTT, generateASS } = require("../utils/subtitleUtils");
const User = require("../models/User");
const UserSubscription = require("../models/UserSubscription");
const PlanCatalog = require("../models/PlanCatalog");
const { storage, createPresignedPutUrl } = require("../utils/storage");
const AUDIO_VIDEO_MIMES = require("../constants/audioVideoMimes");
const {
  extractRandomVideoThumbnailJpg,
} = require("../utils/videoThumbnailUtils");
const {
  assertEnoughCredits,
} = require("../utils/creditUtils");

const {
  getFileDuration,
  getMediaStreamSummary,
  extractAudio,
  extractAudioWindow,
  concatMp3Files,
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
  getGeminiTtsModel,
} = require("../utils/geminiTtsUtils");
const {
  buildBatchScript,
  buildMultiSpeakerScript,
  synthesizePerSpeakerBatch,
  synthesizeMultiSpeakerGemini,
  recoverTimestampsViaRetranscription,
  sliceAudioSegment,
} = require("../utils/geminiBatchTtsUtils");
const {
  flattenTranslatedSegmentsForTts,
  flattenJobSegmentForTts,
} = require("../utils/dubbingSegmentFlatten");
const {
  getTtsProvider,
  isElevenLabsLibraryVoiceBlockedError,
} = require("../utils/ttsUtils");
const {
  syncSegmentTiming,
  buildTimeline,
} = require("../utils/timingSyncUtils");
const {
  layerSpeechOverBackground,
  muxWithVideo,
} = require("../utils/audioMergeUtils");
const {
  getJobOutputDir,
  saveArtifact,
} = require("../utils/dubbingOutputUtils");
const { lipSyncVideo } = require("../utils/lipSyncRunner");
const {
  isInworldConfigured,
} = require("../utils/inworldTtsUtils");
const {
  selectBestSarvamVoice,
} = require("../utils/sarvamTtsUtils");
const {
  isSarvamVoiceCloneConfigured,
  sarvamVoiceCloneConfigMissing,
  createSarvamVoiceClone,
  deleteSarvamVoiceClone,
  getSarvamCloneFailureMode,
} = require("../utils/sarvamVoiceCloneUtils");
const {
  isSmallestConfigured,
} = require("../utils/smallestTtsUtils");
const { loadLocalInworldVoices } = require("../utils/localInworldVoices");
const {
  createProjectForDubbingJob,
} = require("../utils/projectUtils");
const {
  findProjectIdByJobId,
  recordProjectUsage,
} = require("../utils/usageTracker");
const { downloadYoutubeVideo } = require("../utils/youtubeDownloadUtils");
const dubbingProviderService = require("../services/dubbing/dubbingProviderService");
const dubbingSegmentAudioService = require("../services/dubbing/dubbingSegmentAudioService");
const {
  downloadStorageFileToTemp,
  saveLocalFileToStorage,
} = require("../utils/storageFileUtils");
const dubbingJobFinalizer = require("../services/dubbing/dubbingJobFinalizer");

// Dubbing credits: 1 credit per second (rounded up to the next whole second).
const DUBBING_CREDITS_PER_SECOND = 1;

const calculateDubbingCredits = (durationSeconds) =>
  Math.ceil(durationSeconds) * DUBBING_CREDITS_PER_SECOND;

const envNumber = (key, fallback, min, max) => {
  const raw = String(process.env[key] || "").trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
};

const isSarvamCloneModeRequested = (req) => {
  const bodyMode = String(req.body.voiceMode || req.body.dubbingVoiceMode || "")
    .trim()
    .toLowerCase();
  const envMode = String(process.env.DUBBING_VOICE_MODE || "")
    .trim()
    .toLowerCase();
  const explicitBody =
    String(req.body.useVoiceClone || "").trim().toLowerCase() === "true" ||
    String(req.body.useVoiceClone || "").trim() === "1";
  return (
    explicitBody ||
    bodyMode === "sarvam_clone" ||
    bodyMode === "clone" ||
    envMode === "sarvam_clone"
  );
};

const buildSpeakerCloneSample = async ({
  speakerId,
  segments,
  audioPath,
  tmpPaths,
  jobIdStr,
}) => {
  const targetSeconds = envNumber("SARVAM_CLONE_SAMPLE_SECONDS", 35, 8, 120);
  const minSeconds = envNumber("SARVAM_CLONE_MIN_SAMPLE_SECONDS", 8, 2, 60);
  const maxClipSeconds = envNumber("SARVAM_CLONE_MAX_CLIP_SECONDS", 10, 2, 30);
  const minClipSeconds = envNumber("SARVAM_CLONE_MIN_CLIP_SECONDS", 1.2, 0.3, 10);

  const usable = (segments || [])
    .filter((s) => s.speaker_id === speakerId)
    .map((s) => ({
      start: Number(s.start) || 0,
      end: Number(s.end) || 0,
      text: String(s.text || "").trim(),
    }))
    .map((s) => ({ ...s, duration: Math.max(0, s.end - s.start) }))
    .filter((s) => s.duration >= minClipSeconds && s.text.length >= 3)
    .sort((a, b) => b.duration - a.duration);

  let total = 0;
  const selected = [];
  for (const seg of usable) {
    if (total >= targetSeconds) break;
    selected.push(seg);
    total += Math.min(seg.duration, maxClipSeconds);
  }

  if (total < minSeconds) {
    throw new Error(
      `Not enough clean speech for ${speakerId}: ${total.toFixed(1)}s available, need ${minSeconds.toFixed(1)}s.`,
    );
  }

  selected.sort((a, b) => a.start - b.start);
  const sampleDir = path.join(os.tmpdir(), `sarvam_clone_${jobIdStr}_${speakerId}_${uuidv4()}`);
  fs.mkdirSync(sampleDir, { recursive: true });
  tmpPaths.push(sampleDir);

  const clips = [];
  for (let i = 0; i < selected.length; i++) {
    const seg = selected[i];
    const clipPath = path.join(sampleDir, `clip_${String(i + 1).padStart(2, "0")}.mp3`);
    await extractAudioWindow(
      audioPath,
      clipPath,
      seg.start,
      Math.min(seg.duration, maxClipSeconds),
    );
    clips.push(clipPath);
  }

  const samplePath = path.join(sampleDir, "sample.mp3");
  await concatMp3Files(clips, samplePath);
  saveArtifact(jobIdStr, `voice_clone_samples/${speakerId}.mp3`, samplePath);
  return samplePath;
};

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

async function synthesizeDubbingTts(
  ttsProviderResolved,
  text,
  voiceKey,
  targetLanguage,
) {
  return dubbingSegmentAudioService.synthesizeDubbingTts(
    ttsProviderResolved,
    text,
    voiceKey,
    targetLanguage,
  );
}

function getDubbingSegmentPipelineConcurrency() {
  return dubbingSegmentAudioService.getDubbingSegmentPipelineConcurrency();
}

/**
 * Per TTS row: synthesize → sync timing → save artifacts; solo parents also upload to S3.
 * Arrays are filled by index so downstream timeline/DB stay aligned.
 */
async function pipelineTtsSyncUploadForDubbing({
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
  projectId,
}) {
  return dubbingSegmentAudioService.pipelineTtsSyncUploadForDubbing({
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
    projectId,
  });
}

function resolveRetargetTtsProvider(req, targetLanguage) {
  return dubbingProviderService.resolveDubbingTtsProvider(req, targetLanguage);
}

async function selectVoicesForRetarget({
  job,
  ttsProvider,
  speakerProfiles,
  targetLanguage,
  emit,
}) {
  return dubbingProviderService.selectAndPersistVoices({
    job,
    ttsProvider,
    speakerProfiles,
    targetLanguage,
    emit,
  });
}

async function sendDubbingCompletionEmailIfNeeded(userId, finalJob) {
  return dubbingJobFinalizer.sendCompletionEmailIfNeeded(userId, finalJob);
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

  const isVideo = String(inputMimeType || "").startsWith("video/");
  const ext =
    path.extname(originalFileName || "") || (isVideo ? ".mp4" : ".mp3");

  const duration = await getFileDuration(tmpInput);
  const creditsNeeded = calculateDubbingCredits(duration);

  emit({
    stage: "validating",
    message: "Checking file and credits…",
    durationSec: duration,
  });

  const user = await User.findById(req.userId);
  if (!user) {
    const err = new Error("User not found.");
    err.statusCode = 404;
    throw err;
  }

  assertEnoughCredits(user, creditsNeeded);

  // Prefer provider from request body if present, else use .env default.
  const ttsProvider = dubbingProviderService.resolveDubbingTtsProvider(
    req,
    targetLanguage,
    { requireTranscription: true },
  );

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
  const projectId = await findProjectIdByJobId(job._id, "dubbing");

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
          await saveLocalFileToStorage(tmpThumb, key, "image/jpeg");
          await DubbingJob.findByIdAndUpdate(job._id, { thumbnailKey: key });
        } catch (thumbErr) {
          console.warn(
            "[dubbing] thumbnail generation failed:",
            thumbErr.message,
          );
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
      } else if (
        inputBuffer &&
        Buffer.isBuffer(inputBuffer) &&
        inputBuffer.length
      ) {
        const key = `dubbing/${req.userId}/${uuidv4()}${ext}`;
        await storage.saveFile(inputBuffer, key, inputMimeType);
        videoKey = key;
      } else if (isVideo) {
        // Disk-upload path: we may not have req.file.buffer. Fall back to reading tmpInput.
        // NOTE: This reads the whole file into memory; acceptable for typical short uploads.
        const key = `dubbing/${req.userId}/${uuidv4()}${ext}`;
        await saveLocalFileToStorage(tmpInput, key, inputMimeType);
        videoKey = key;
      }

      const audioOrigKey = `dubbing/${req.userId}/${uuidv4()}_original_audio.mp3`;
      await saveLocalFileToStorage(audioPath, audioOrigKey, "audio/mpeg");

      const update = { originalAudioKey: audioOrigKey };
      if (videoKey) update.originalVideoKey = videoKey;
      await DubbingJob.findByIdAndUpdate(job._id, update);
    } catch (uploadErr) {
      console.warn(
        "[dubbing] Original asset upload failed:",
        uploadErr.message,
      );
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
      console.log(
        `[dubbing:timing] separation done: ${Date.now() - _tSepStart}ms`,
      );
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
            await saveLocalFileToStorage(result.vocalsPath, key, "audio/mpeg");
            return key;
          })(),
          (async () => {
            const key = `dubbing/${req.userId}/${uuidv4()}_background.mp3`;
            await saveLocalFileToStorage(result.backgroundPath, key, "audio/mpeg");
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

      // Record Separation Usage
      if (projectId) {
        if (result.method === "replicate") {
          await recordProjectUsage(projectId, {
            model: "ryan5453/demucs",
            seconds: duration,
          });
        } else if (result.method === "elevenlabs_fallback") {
          await recordProjectUsage(projectId, {
            model: "audio-isolation",
            seconds: duration,
          });
        }
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
  )
    .trim()
    .toLowerCase();

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
  const {
    segments: rawSegments,
    speaker_profiles,
    usage: transcribeUsage,
  } = await transcribeWithSpeakers(transcribeInputPath, sourceLanguage);

  if (Array.isArray(transcribeUsage) && projectId) {
    for (const u of transcribeUsage) {
      await recordProjectUsage(projectId, {
        model: "gemini-3.1-flash-lite",
        inputTokens: u.promptTokenCount,
        outputTokens: u.candidatesTokenCount,
      });
    }
  }
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
  const { results: translatedSegments, usage: translationUsage } =
    await translateToSpeechReady(
      segmentsForTranslate,
      targetLanguage,
      speaker_profiles,
      { sourceLanguage, translationMode },
    );

  if (translationUsage && projectId) {
    await recordProjectUsage(projectId, {
      model: "gpt-4o-mini",
      inputTokens: translationUsage.prompt_tokens,
      outputTokens: translationUsage.completion_tokens,
    });
  }

  emit({ stage: "translating", message: "Translation complete." });
  console.log(
    `[dubbing:timing] translate done: ${Date.now() - _t0}ms elapsed total`,
  );

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
    cloneSampleAudioPath: transcribeInputPath,
    sepPromise,
    translatedSegments,
    rawSegments,
    speaker_profiles,
    segmentsForTranslate,
    _t0,
    // Best-effort background tasks that read temp files; await before cleanup.
    thumbPromise,
    origUploadPromise,
    projectId,
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
      return res
        .status(415)
        .json({ message: `Unsupported mime type: ${mimeType}` });
    }
    if (!Number.isFinite(byteSize) || byteSize <= 0) {
      return res
        .status(400)
        .json({ message: "byteSize must be a positive number." });
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

  const emitRaw = (data) => {
    try {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (_) {}
  };

  // Smooth, time-based overall progress (0–100). Dubbing throughput varies with input duration:
  // - >= 60s content: ~1s dubbing work takes ~1.25s wall time
  // - <  60s content: ~1s dubbing work takes ~1.8s wall time (estimate)
  //
  // We use stage "targets" as caps so progress does not jump instantly between steps.
  const STAGE_TARGET_PROGRESS = {
    validating: 5,
    extracting: 15,
    uploading: 25,
    transcribing: 30,
    separating: 28,
    translating: 40,
    generating: 55,
    syncing: 72,
    merging: 88,
    lipsync: 92,
    saving: 94,
    done: 100,
  };

  const progressState = {
    startedAtMs: Date.now(),
    expectedTotalSec: null, // becomes available once we know input duration
    value: 0,
    target: 0,
    lastEmittedInt: -1,
    stage: "validating",
    message: "Preparing…",
    tickId: null,
    lastTickAtMs: Date.now(),
  };

  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

  const setExpectedFromDuration = (durationSec) => {
    const d = Number(durationSec);
    if (!Number.isFinite(d) || d <= 0) return;
    const ratio = d < 60 ? 1.8 : 1.25;
    // keep a small floor so tiny files don't race to 100
    progressState.expectedTotalSec = Math.max(12, d * ratio);
  };

  const setStageTarget = (stage) => {
    if (!stage) return;
    const t = STAGE_TARGET_PROGRESS[stage];
    if (typeof t === "number")
      progressState.target = Math.max(progressState.target, t);
  };

  const emitProgressFrameIfChanged = () => {
    const pInt = Math.round(clamp(progressState.value, 0, 100));
    if (pInt === progressState.lastEmittedInt) return;
    progressState.lastEmittedInt = pInt;
    emitRaw({
      stage: progressState.stage,
      message: progressState.message,
      progress: pInt,
    });
  };

  const tickProgress = () => {
    const nowMs = Date.now();
    const dtSec = Math.max(
      0,
      Math.min(0.5, (nowMs - progressState.lastTickAtMs) / 1000),
    );
    progressState.lastTickAtMs = nowMs;

    const expected = progressState.expectedTotalSec;
    const elapsedSec = Math.max(0, (nowMs - progressState.startedAtMs) / 1000);
    const timeBasedCap =
      typeof expected === "number"
        ? clamp((elapsedSec / expected) * 100, 0, 99)
        : 0;

    // Always cap by time *and* stage target, so progress can't jump early.
    const desired = Math.min(progressState.target, timeBasedCap);

    // Max step per tick to avoid "instant" jumps even if we fall behind.
    const pctPerSec = typeof expected === "number" ? 100 / expected : 4;
    const maxStep = Math.max(0.4, pctPerSec * dtSec * 1.15);

    const diff = desired - progressState.value;
    const step = clamp(diff, -maxStep, maxStep);
    progressState.value = clamp(progressState.value + step, 0, 99.5);

    emitProgressFrameIfChanged();
  };

  const startProgressTicker = () => {
    if (progressState.tickId) return;
    progressState.lastTickAtMs = Date.now();
    progressState.tickId = setInterval(tickProgress, 250);
  };

  const stopProgressTicker = () => {
    if (progressState.tickId) clearInterval(progressState.tickId);
    progressState.tickId = null;
  };

  const emit = (data) => {
    // If duration is provided on any frame, use it to calibrate progress speed early.
    if (data && typeof data === "object") {
      const d =
        typeof data.durationSec === "number"
          ? data.durationSec
          : typeof data.duration === "number"
            ? data.duration
            : null;
      if (typeof d === "number") setExpectedFromDuration(d);
    }

    // Preserve transcription sub-progress semantics (frontend maps it into overall).
    if (
      data &&
      data.stage === "transcribing" &&
      typeof data.progress === "number"
    ) {
      progressState.stage = data.stage;
      progressState.message = data.message ?? progressState.message;
      setStageTarget(data.stage);
      startProgressTicker();
      return emitRaw(data);
    }

    if (data && typeof data.stage === "string") {
      progressState.stage = data.stage;
      progressState.message = data.message ?? progressState.message;
      setStageTarget(data.stage);
      startProgressTicker();
    }

    // Attach the current overall progress to non-transcribing frames.
    const payload =
      data && typeof data === "object"
        ? { ...data, progress: Math.round(clamp(progressState.value, 0, 100)) }
        : data;

    return emitRaw(payload);
  };

  const tmpPaths = [];
  let job = null;
  let thumbPromise = null;
  let origUploadPromise = null;
  const temporarySarvamCloneIds = [];

  try {
    // Use reserved duration estimate (if present) to avoid fast early progress.
    if (typeof req.dubbingDurationSeconds === "number") {
      setExpectedFromDuration(req.dubbingDurationSeconds);
    }

    const hasDiskInput = Boolean(
      req.dubbingTmpProbeFile && fs.existsSync(req.dubbingTmpProbeFile),
    );
    const hasBufferInput = Boolean(
      req.file && req.file.buffer && req.file.buffer.length,
    );
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
      rawSegments,
      speaker_profiles,
      audioPath,
      cloneSampleAudioPath,
      sepPromise,
      _t0,
      thumbPromise: preparedThumbPromise,
      origUploadPromise: preparedOrigUploadPromise,
      projectId,
    } = prepared;
    thumbPromise = preparedThumbPromise;
    origUploadPromise = preparedOrigUploadPromise;

    // Now that we know the media duration, calibrate progress speed.
    setExpectedFromDuration(duration);

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

    if (ttsProvider !== "sarvam" && ttsProvider !== "auto") {
      ({
        resolvedProvider: resolvedTtsProvider,
        voiceMap,
        updatedProfiles,
      } = await dubbingProviderService.selectAndPersistVoices({
        job,
        ttsProvider,
        speakerProfiles: speaker_profiles,
        targetLanguage,
        emit,
      }));
    } else if (ttsProvider === "sarvam") {
      emit({
        stage: "generating",
        message: "Selecting Sarvam TTS voices for speakers…",
      });
      const assignedSarvamIds = [];
      const cloneRequested = isSarvamCloneModeRequested(req);
      const cloneFailureMode = getSarvamCloneFailureMode();
      const canClone = cloneRequested && isSarvamVoiceCloneConfigured();

      if (cloneRequested && !canClone) {
        const msg =
          "Sarvam voice clone requested, but clone API is not configured.";
        if (cloneFailureMode === "strict") {
          throw new Error(msg);
        }
        const missing = sarvamVoiceCloneConfigMissing().join(", ");
        console.warn(
          `[dubbing] ${msg} Fix: set ${missing}. Falling back to Sarvam preset voices.`,
        );
        emit({
          stage: "generating",
          message: "Sarvam voice clone is not configured; using preset voices.",
        });
      }

      for (const profile of speaker_profiles) {
        emit({
          stage: "generating",
          message: `Selecting voice for ${profile.speaker_id}…`,
        });
        let synthesisVoice = null;
        let persistedVoice = null;
        if (canClone) {
          try {
            emit({
              stage: "generating",
              message: `Creating Sarvam voice clone for ${profile.speaker_id}…`,
            });
            const samplePath = await buildSpeakerCloneSample({
              speakerId: profile.speaker_id,
              segments: rawSegments,
              audioPath: cloneSampleAudioPath || audioPath,
              tmpPaths,
              jobIdStr,
            });
            const clone = await createSarvamVoiceClone({
              speakerId: profile.speaker_id,
              samplePath,
              targetLanguage,
              jobId: jobIdStr,
            });
            synthesisVoice = clone.voiceId;
            temporarySarvamCloneIds.push(synthesisVoice);
            persistedVoice = await selectBestSarvamVoice(
              profile.voice_description,
              {
                excludeVoiceIds: assignedSarvamIds,
                speakerCount: dubbingSpeakerCount,
                targetLanguage,
              },
            );
          } catch (cloneErr) {
            // console.error("[dubbing] Sarvam voice clone failed:", cloneErr);
            if (cloneFailureMode === "strict") {
              throw cloneErr;
            }
            // console.warn(
            //   `[dubbing] Sarvam clone failed for ${profile.speaker_id}; using preset voice:`,
            //   cloneErr.message,
            // );
            emit({
              stage: "generating",
              message: `Voice clone failed for ${profile.speaker_id}; using a Sarvam preset voice.`,
            });
          }
        }
        if (!synthesisVoice) {
          synthesisVoice = await selectBestSarvamVoice(profile.voice_description, {
            excludeVoiceIds: assignedSarvamIds,
            speakerCount: dubbingSpeakerCount,
            targetLanguage,
          });
          persistedVoice = synthesisVoice;
        }
        if (persistedVoice) assignedSarvamIds.push(persistedVoice);
        voiceMap[profile.speaker_id] = synthesisVoice;
        updatedProfiles.push({
          speaker_id: profile.speaker_id,
          voice_description: profile.voice_description,
          elevenlabs_voice_id: persistedVoice || synthesisVoice,
        });
      }
      await DubbingJob.findByIdAndUpdate(job._id, {
        speakerProfiles: updatedProfiles,
        ttsProvider: "sarvam",
      });
    } else if (ttsProvider === "auto") {
      // Voice map + synthesis for auto: Inworld → Smallest → ElevenLabs → OpenAI (Step 6)
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
        projectId,
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
      // ── New Gemini Batch TTS Path ──────────────────────────────────────────
      // Instead of 1 TTS call per segment, we batch all lines per speaker into
      // a single call, then re-transcribe to recover per-segment cut timestamps.
      emit({ stage: "generating", message: "Building Gemini batch TTS scripts…" });

      segmentIds = translatedSegments.map(() => uuidv4());
      const audioKeys = new Map();
      segmentAudioKeys = audioKeys;

      const n = ttsRows.length;
      rawDubbedPaths = new Array(n);
      wordTsForRows  = new Array(n).fill([]);
      syncedBuffers  = new Array(n);

      // Build per-speaker segment groups (preserve original ttsRows index)
      const speakerGroups = new Map(); // speakerId → [{ rowIndex, row }]
      for (let k = 0; k < n; k++) {
        const row = ttsRows[k];
        if (!speakerGroups.has(row.speaker_id)) speakerGroups.set(row.speaker_id, []);
        speakerGroups.get(row.speaker_id).push({ rowIndex: k, row });
      }

      const speakerList = [...speakerGroups.keys()];
      const usedMultiSpeaker =
        speakerList.length === 2 && String(process.env.GEMINI_MULTISPEAKER_DISABLED || "") !== "1";

      // ── Path A: ≤2 speakers — attempt single multi-speaker call ──────────
      if (usedMultiSpeaker) {
        emit({
          stage: "generating",
          message: `Generating multi-speaker Gemini audio (${speakerList.length} speaker(s))…`,
        });
        try {
          const msScript = buildMultiSpeakerScript(
            ttsRows.map((r) => ({ speaker_id: r.speaker_id, text: r.text, tts_performance_hint: r.tts_performance_hint })),
          );
          const msVoiceMap = {};
          const msPersonaMap = {};
          for (const profile of speaker_profiles) {
            msVoiceMap[profile.speaker_id]   = voiceMap[profile.speaker_id] || "Kore";
            msPersonaMap[profile.speaker_id] = profile.voice_description || "";
          }

          const { audioPath: msAudioPath, usage: msUsage } =
            await synthesizeMultiSpeakerGemini(msScript, msVoiceMap, msPersonaMap);
          tmpPaths.push(msAudioPath);
          if (msUsage && projectId) await recordProjectUsage(projectId, { model: getGeminiTtsModel?.() || "gemini-tts", ...msUsage });

          emit({ stage: "generating", message: "Recovering per-segment timestamps from multi-speaker audio…" });
          const msExpectedTexts = ttsRows.map((r) => r.text);
          const msTimestamps = await recoverTimestampsViaRetranscription(msAudioPath, n, msExpectedTexts);

          emit({ stage: "syncing", message: "Slicing and speed-adjusting multi-speaker audio…" });
          await DubbingJob.findByIdAndUpdate(job._id, { status: "syncing" });

          let msProcessed = 0;
          for (let k = 0; k < n; k++) {
            const row = ttsRows[k];
            const ts  = msTimestamps[k] || { start: 0, end: 0.1 };
            const durSec = Math.max(0.05, ts.end - ts.start);
            const slicedPath = path.join(os.tmpdir(), `gbatch_slice_${uuidv4()}.mp3`);
            sliceAudioSegment(msAudioPath, ts.start, durSec, slicedPath);
            tmpPaths.push(slicedPath);
            rawDubbedPaths[k] = slicedPath;

            const originalDuration = Math.max(0.05, row.end - row.start);
            const synced = await syncSegmentTiming(slicedPath, originalDuration, { maxAtempo });
            tmpPaths.push(synced.adjustedPath);
            syncedBuffers[k] = synced;

            // Upload per-segment clip to S3 (so individual segments can be played in UI)
            if (row.subIndex < 0) {
              try {
                const segId  = segmentIds[row.parentIndex];
                const segKey = `dubbing/${req.userId}/${job._id}/segments/${segId}_r0.mp3`;
                await saveLocalFileToStorage(synced.adjustedPath, segKey, "audio/mpeg");
                audioKeys.set(row.parentIndex, segKey);
              } catch (uploadErr) {
                console.warn(`[dubbing:gemini] Segment ${row.parentIndex} upload failed:`, uploadErr.message);
              }
            }

            msProcessed++;
            emit({ stage: "syncing", message: `Clips ready: ${msProcessed}/${n}…`, progress: Math.round((msProcessed / n) * 100) });
          }
        } catch (msErr) {
          if (msErr.code === "MULTI_SPEAKER_UNSUPPORTED") {
            console.warn("[dubbing:gemini] Multi-speaker not supported on this model — falling back to per-speaker batch");
            // Fall through to per-speaker path by resetting arrays
            rawDubbedPaths = new Array(n);
            wordTsForRows  = new Array(n).fill([]);
            syncedBuffers  = new Array(n);
            audioKeys.clear();
          } else {
            throw msErr;
          }
        }
      }

      // ── Path B: 3+ speakers (or multi-speaker fallback) — one call per speaker
      const needsPerSpeaker = !usedMultiSpeaker || syncedBuffers.some((b) => b === undefined);
      if (needsPerSpeaker) {
        let speakersDone = 0;
        let segmentsProcessed = 0;
        const totalSpeakers = speakerGroups.size;

        for (const [speakerId, entries] of speakerGroups) {
          emit({
            stage: "generating",
            message: `Generating Gemini batch audio for ${speakerId} (${++speakersDone}/${totalSpeakers})…`,
          });

          const speakerProfile = speaker_profiles.find((p) => p.speaker_id === speakerId) || {};
          const persona    = speakerProfile.voice_description || "";
          const voiceName  = voiceMap[speakerId] || "Kore";
          const speakerSegs = entries.map(({ row }) => ({
            text: row.text,
            tts_performance_hint: row.tts_performance_hint,
          }));

          const batchScript = buildBatchScript(speakerSegs);
          const { audioPath: batchAudio, usage: batchUsage } =
            await synthesizePerSpeakerBatch(batchScript, voiceName, persona);
          tmpPaths.push(batchAudio);
          if (batchUsage && projectId) await recordProjectUsage(projectId, { model: "gemini-tts-batch", ...batchUsage });

          emit({ stage: "generating", message: `Recovering timestamps for ${speakerId}…` });
          const bExpectedTexts = entries.map(({ row }) => row.text);
          const timestamps = await recoverTimestampsViaRetranscription(batchAudio, entries.length, bExpectedTexts);

          emit({ stage: "syncing", message: `Slicing and speed-adjusting clips for ${speakerId}…` });
          if (!syncedBuffers.some((b) => b !== undefined)) {
            await DubbingJob.findByIdAndUpdate(job._id, { status: "syncing" });
          }

          for (let i = 0; i < entries.length; i++) {
            const { rowIndex, row } = entries[i];
            const ts      = timestamps[i] || { start: 0, end: 0.1 };
            const durSec  = Math.max(0.05, ts.end - ts.start);
            const slicedPath = path.join(os.tmpdir(), `gbatch_slice_${uuidv4()}.mp3`);
            sliceAudioSegment(batchAudio, ts.start, durSec, slicedPath);
            tmpPaths.push(slicedPath);
            rawDubbedPaths[rowIndex] = slicedPath;

            const originalDuration = Math.max(0.05, row.end - row.start);
            const synced = await syncSegmentTiming(slicedPath, originalDuration, { maxAtempo });
            tmpPaths.push(synced.adjustedPath);
            syncedBuffers[rowIndex] = synced;

            // Upload per-segment clip to S3 (same as old pipeline)
            if (row.subIndex < 0) {
              try {
                const segId  = segmentIds[row.parentIndex];
                const segKey = `dubbing/${req.userId}/${job._id}/segments/${segId}_r0.mp3`;
                await saveLocalFileToStorage(synced.adjustedPath, segKey, "audio/mpeg");
                audioKeys.set(row.parentIndex, segKey);
              } catch (uploadErr) {
                console.warn(`[dubbing:gemini] Segment ${row.parentIndex} upload failed:`, uploadErr.message);
              }
            }

            segmentsProcessed++;
            emit({ stage: "syncing", message: `Clips ready: ${segmentsProcessed}/${n}…`, progress: Math.round((segmentsProcessed / n) * 100) });
          }
        }
      }

      emit({ stage: "syncing", message: "All Gemini batch clips ready." });
    } else if (ttsProvider === "auto") {
      let autoDone = false;
      const iwPaths = [];

      if (isInworldConfigured()) {
        try {
          emit({ stage: "generating", message: "Trying Inworld TTS…" });
          ({
            resolvedProvider: resolvedTtsProvider,
            voiceMap,
            updatedProfiles,
          } = await dubbingProviderService.selectAndPersistVoices({
            job,
            ttsProvider: "inworld",
            speakerProfiles: speaker_profiles,
            targetLanguage,
            emit,
          }));

          ({
            rawDubbedPaths,
            wordTsForRows,
            syncedBuffers,
            segmentIds,
            segmentAudioKeys,
          } = await runSegmentPipeline("inworld", iwPaths));
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
          ({
            resolvedProvider: resolvedTtsProvider,
            voiceMap,
            updatedProfiles,
          } = await dubbingProviderService.selectAndPersistVoices({
            job,
            ttsProvider: "smallest",
            speakerProfiles: speaker_profiles,
            targetLanguage,
            emit,
          }));

          ({
            rawDubbedPaths,
            wordTsForRows,
            syncedBuffers,
            segmentIds,
            segmentAudioKeys,
          } = await runSegmentPipeline("smallest", smPaths));
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
          ({
            resolvedProvider: resolvedTtsProvider,
            voiceMap,
            updatedProfiles,
          } = await dubbingProviderService.selectAndPersistVoices({
            job,
            ttsProvider: "elevenlabs",
            speakerProfiles: speaker_profiles,
            targetLanguage,
            emit,
          }));

          ({
            rawDubbedPaths,
            wordTsForRows,
            syncedBuffers,
            segmentIds,
            segmentAudioKeys,
          } = await runSegmentPipeline("elevenlabs", elPaths));
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
        ({
          resolvedProvider: resolvedTtsProvider,
          voiceMap,
          updatedProfiles,
        } = await dubbingProviderService.selectAndPersistVoices({
          job,
          ttsProvider: "openai",
          speakerProfiles: speaker_profiles,
          targetLanguage,
          emit,
        }));

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

    console.log(
      `[dubbing:timing] TTS+sync done: ${Date.now() - (_t0 || Date.now())}ms elapsed total`,
    );

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
    console.log(
      `[dubbing:timing] mix done: ${Date.now() - (_t0 || Date.now())}ms elapsed total`,
    );

    // ── Step 9 (v1): Upload dubbed audio only — video mux is done client-side ─
    // Lip-sync and server-side video mux are deferred to a future opt-in path.
    emit({ stage: "merging", message: "Uploading dubbed audio…" });

    let dubbedAudioKey = null;
    try {
      dubbedAudioKey = `dubbing/${req.userId}/${uuidv4()}_dubbed_audio.mp3`;
      await saveLocalFileToStorage(mixedAudioForOutput, dubbedAudioKey, "audio/mpeg");
    } catch (mixUploadErr) {
      console.warn("Dubbed audio upload failed:", mixUploadErr.message);
    }

    saveArtifact(jobIdStr, "final_dubbed.mp3", mixedAudioForOutput);
    console.log(
      `[dubbing:timing] upload done: ${Date.now() - (_t0 || Date.now())}ms elapsed total`,
    );

    // ── Step 10: Confirm usage reservation + Deduct credits + finalise job ────
    emit({ stage: "saving", message: "Saving results…" });

    await dubbingJobFinalizer.confirmUsageIfReserved({
      userId: req.userId,
      jobId: job._id,
      reservedSeconds: req.dubbingDurationSeconds ?? duration,
      processedSeconds: duration,
      usageReserved: req.dubbingUsageReserved,
    });

    await DubbingJob.findByIdAndUpdate(job._id, {
      processedSeconds: duration,
    }).catch(() => {});

    await dubbingJobFinalizer.deductDubbingCredits({
      userId: req.userId,
      creditsNeeded,
      fileName: job.originalFileName,
      fileType: preparedIsVideo ? "video" : "audio",
      sourceLanguage: sourceLanguage || "auto",
      targetLanguage,
      duration,
      jobId: job._id,
    });

    // Persist final state to DB
    const segmentsForDb = dubbingSegmentAudioService.buildSegmentsForDb({
      translatedSegments,
      segmentIds,
      parentSubSegments,
      parentSolo,
      segmentAudioKeys,
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
    await dubbingJobFinalizer.refreshCompletedJob(finalJob);

    console.log(
      `[dubbing:timing] TOTAL pipeline: ${Date.now() - (_t0 || Date.now())}ms`,
    );

    emit({
      stage: "done",
      message: "Dubbing complete!",
      job: finalJob,
      dubbedUrl: dubbedAudioKey,
      progress: 100,
    });

    await sendDubbingCompletionEmailIfNeeded(req.userId, finalJob);

    res.end();
  } catch (err) {
    console.error("Dubbing pipeline error:", err);

    // Atomically refund the usage reservation.
    // Only refunds the unused portion: reserved - processed.
    // processedSeconds is null until the pipeline stamps it, so failed early-stage
    // jobs (transcription, separation) get a full refund (processedSeconds = 0).
    await dubbingJobFinalizer.refundReservedUsageOnFailure({
      userId: req.userId,
      job,
      reservedSeconds: req.dubbingDurationSeconds,
      usageReserved: req.dubbingUsageReserved,
    });
    await dubbingJobFinalizer.markJobFailed({ job, error: err });

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
    stopProgressTicker();
    // Ensure background uploads that read temp files finish before cleanup.
    try {
      const bg = [];
      if (typeof thumbPromise?.then === "function") bg.push(thumbPromise);
      if (typeof origUploadPromise?.then === "function")
        bg.push(origUploadPromise);
      await Promise.allSettled(bg);
    } catch (_) {}

    if (temporarySarvamCloneIds.length) {
      const cloneCleanup = await Promise.allSettled(
        temporarySarvamCloneIds.map((voiceId) => deleteSarvamVoiceClone(voiceId)),
      );
      cloneCleanup.forEach((result, index) => {
        const voiceId = temporarySarvamCloneIds[index];
        if (result.status === "rejected") {
          console.warn(
            `[dubbing] Failed to delete Sarvam voice clone ${voiceId}:`,
            result.reason?.message || result.reason,
          );
        } else if (result.value?.skipped) {
          console.warn(
            `[dubbing] Skipped Sarvam voice clone cleanup for ${voiceId}: ${result.value.reason}`,
          );
        }
      });
    }

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
      mimetype,
      originalname: `YouTube - ${dl.title}${nameExt}`,
    };
    req.dubbingTmpProbeFile = dl.filePath;

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
 * POST /api/dubbing/:id/retarget
 * Creates a new dubbing job in another language using the source job's
 * stored transcript, original assets, and background stem.
 */
exports.startDubbingRetargetJob = async (req, res) => {
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
    const sourceJob = req.dubbingRetargetSourceJob;
    if (!sourceJob) {
      const err = new Error("Source dubbing job was not prepared.");
      err.statusCode = 500;
      throw err;
    }
    const targetLanguage = (req.body.targetLanguage || "").trim();
    if (!targetLanguage) {
      const err = new Error("targetLanguage is required.");
      err.statusCode = 422;
      throw err;
    }
    if (
      targetLanguage.toLowerCase() ===
      String(sourceJob.targetLanguage || "").trim().toLowerCase()
    ) {
      const err = new Error("Choose a different target language for this dub.");
      err.statusCode = 422;
      throw err;
    }
    if (!sourceJob.originalAudioKey) {
      const err = new Error("Cannot reuse this dub: original audio is unavailable.");
      err.statusCode = 422;
      throw err;
    }
    if (!sourceJob.backgroundKey) {
      const err = new Error("Cannot reuse this dub: background stem is unavailable.");
      err.statusCode = 422;
      throw err;
    }

    const duration = sourceJob.duration || req.dubbingDurationSeconds || 0;
    const creditsNeeded = calculateDubbingCredits(duration);

    emit({
      stage: "validating",
      message: "Checking saved dub and credits…",
      durationSec: duration,
      progress: 5,
    });

    const user = await User.findById(req.userId);
    if (!user) {
      const err = new Error("User not found.");
      err.statusCode = 404;
      throw err;
    }
    assertEnoughCredits(user, creditsNeeded);

    const sourceLanguage =
      (req.body.sourceLanguage || "").trim() ||
      sourceJob.sourceLanguage ||
      "auto";
    const ttsProvider = resolveRetargetTtsProvider(req, targetLanguage);

    job = await DubbingJob.create({
      user: req.userId,
      originalFileName: sourceJob.originalFileName,
      fileType: sourceJob.fileType,
      sourceLanguage,
      targetLanguage,
      duration,
      creditsUsed: creditsNeeded,
      status: "translating",
      idempotencyKey: req.dubbingIdempotencyKey ?? null,
      reservedSeconds: req.dubbingDurationSeconds ?? duration,
      processingStartedAt: new Date(),
      originalVideoKey: sourceJob.originalVideoKey || null,
      originalAudioKey: sourceJob.originalAudioKey || null,
      vocalsKey: sourceJob.vocalsKey || null,
      backgroundKey: sourceJob.backgroundKey || null,
      thumbnailKey: sourceJob.thumbnailKey || null,
      separationMethod: sourceJob.separationMethod || null,
    });

    await createProjectForDubbingJob(req.userId, job._id);
    const projectId = await findProjectIdByJobId(job._id, "dubbing");
    const jobIdStr = job._id.toString();
    const localOutputPath = getJobOutputDir(jobIdStr);
    fs.mkdirSync(localOutputPath, { recursive: true });

    emit({
      stage: "validating",
      message: "Job created from saved dub.",
      jobId: job._id,
      progress: 10,
    });

    emit({
      stage: "translating",
      message: "Reusing transcript and background stem from your previous dub…",
      progress: 30,
    });

    const backgroundPath = await downloadStorageFileToTemp(
      sourceJob.backgroundKey,
      tmpPaths,
      "dub_retarget_bg",
      ".mp3",
    );
    saveArtifact(jobIdStr, "03_background_reused.mp3", backgroundPath);

    const originalAudioPath = await downloadStorageFileToTemp(
      sourceJob.originalAudioKey,
      tmpPaths,
      "dub_retarget_original",
      ".mp3",
    );
    saveArtifact(jobIdStr, "01_full_audio_reused.mp3", originalAudioPath);

    const reusableSegments = (sourceJob.segments || [])
      .map((seg) => ({
        start: Number(seg.start) || 0,
        end: Number(seg.end) || 0,
        speaker_id: String(seg.speaker_id || "").trim(),
        text: String(seg.originalText || "").trim(),
        voiceProfile: seg.voiceProfile,
      }))
      .filter((seg) => seg.speaker_id && seg.text && seg.end > seg.start)
      .sort((a, b) => a.start - b.start);

    if (!reusableSegments.length) {
      const err = new Error("Source job does not have reusable transcript segments.");
      err.statusCode = 422;
      throw err;
    }

    const speakerProfiles = (sourceJob.speakerProfiles || []).map((profile) => ({
      speaker_id: profile.speaker_id,
      voice_description: profile.voice_description || "",
    }));

    emit({
      stage: "translating",
      message: `Translating to ${targetLanguage}…`,
      progress: 40,
    });
    const translationMode =
      String(req.body.translationMode || "auto").trim() || "auto";
    const { results: translatedSegments, usage: translationUsage } =
      await translateToSpeechReady(
        reusableSegments,
        targetLanguage,
        speakerProfiles,
        { sourceLanguage, translationMode },
      );

    if (translationUsage && projectId) {
      await recordProjectUsage(projectId, {
        model: "gpt-4o-mini",
        inputTokens: translationUsage.prompt_tokens,
        outputTokens: translationUsage.completion_tokens,
      });
    }

    emit({ stage: "translating", message: "Translation complete.", progress: 50 });
    await DubbingJob.findByIdAndUpdate(job._id, { status: "generating" });

    const {
      resolvedProvider,
      voiceMap,
      updatedProfiles,
    } = await selectVoicesForRetarget({
      job,
      ttsProvider,
      speakerProfiles,
      targetLanguage,
      emit,
    });

    emit({
      stage: "generating",
      message: "Generating dubbed audio for each segment…",
      progress: 55,
    });

    const ttsRows = flattenTranslatedSegmentsForTts(translatedSegments);
    const maxAtempo = resolveMaxAtempo(targetLanguage);
    const segmentIds = translatedSegments.map(() => uuidv4());
    const segmentAudioKeys = new Map();
    const { wordTsForRows, syncedBuffers } =
      await pipelineTtsSyncUploadForDubbing({
        jobMongoId: job._id,
        ttsRows,
        synthesizeProvider: resolvedProvider,
        voiceMap,
        targetLanguage,
        syncOpts: { maxAtempo },
        tmpPaths,
        emit,
        jobIdStr,
        segmentIds,
        segmentAudioKeys,
        userId: req.userId,
        projectId,
      });

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

    emit({
      stage: "merging",
      message: "Mixing dubbed speech with reused background audio…",
      progress: 82,
    });
    await DubbingJob.findByIdAndUpdate(job._id, { status: "merging" });

    const mixedAudioPath = path.join(os.tmpdir(), `dub_retarget_mixed_${uuidv4()}.mp3`);
    tmpPaths.push(mixedAudioPath);
    await layerSpeechOverBackground(timeline, backgroundPath, mixedAudioPath, duration);

    const mixTargetSec = Math.max(
      duration,
      (await getFileDuration(backgroundPath).catch(() => 0)) || 0,
    );
    const paddedMixPath = path.join(os.tmpdir(), `dub_retarget_pad_${uuidv4()}.mp3`);
    const mixResult = await ensureMinAudioDuration(
      mixedAudioPath,
      mixTargetSec,
      paddedMixPath,
    );
    if (mixResult.padded) tmpPaths.push(paddedMixPath);
    const mixedAudioForOutput = mixResult.path;
    saveArtifact(jobIdStr, "final_dubbed.mp3", mixedAudioForOutput);

    emit({ stage: "merging", message: "Uploading dubbed audio…", progress: 90 });
    const dubbedAudioKey = `dubbing/${req.userId}/${uuidv4()}_dubbed_audio.mp3`;
    await saveLocalFileToStorage(mixedAudioForOutput, dubbedAudioKey, "audio/mpeg");

    emit({ stage: "saving", message: "Saving results…", progress: 94 });
    await dubbingJobFinalizer.confirmUsageIfReserved({
      userId: req.userId,
      jobId: job._id,
      reservedSeconds: req.dubbingDurationSeconds ?? duration,
      processedSeconds: duration,
      usageReserved: req.dubbingUsageReserved,
    });

    await DubbingJob.findByIdAndUpdate(job._id, {
      processedSeconds: duration,
    }).catch(() => {});

    await dubbingJobFinalizer.deductDubbingCredits({
      userId: req.userId,
      creditsNeeded,
      fileName: job.originalFileName,
      fileType: sourceJob.fileType,
      sourceLanguage: sourceLanguage || "auto",
      targetLanguage,
      duration,
      jobId: job._id,
      sourceJobId: sourceJob._id,
    });

    const segmentsForDb = dubbingSegmentAudioService.buildSegmentsForDb({
      translatedSegments,
      segmentIds,
      parentSubSegments,
      parentSolo,
      segmentAudioKeys,
    });

    const finalJob = await DubbingJob.findByIdAndUpdate(
      job._id,
      {
        status: "completed",
        dubbedVideoKey: sourceJob.originalVideoKey || null,
        dubbedVideoUrl: null,
        dubbedAudioKey,
        dubbedAudioUrl: null,
        separationMethod: sourceJob.separationMethod || "no_separation",
        ttsProvider: resolvedProvider,
        segments: segmentsForDb,
        speakerProfiles: updatedProfiles,
      },
      { new: true },
    );
    await dubbingJobFinalizer.refreshCompletedJob(finalJob);

    emit({
      stage: "done",
      message: "Dubbing complete!",
      job: finalJob,
      dubbedUrl: dubbedAudioKey,
      progress: 100,
    });

    await sendDubbingCompletionEmailIfNeeded(req.userId, finalJob);
    res.end();
  } catch (err) {
    console.error("Dubbing retarget pipeline error:", err);

    await dubbingJobFinalizer.refundReservedUsageOnFailure({
      userId: req.userId,
      job,
      reservedSeconds: req.dubbingDurationSeconds,
      usageReserved: req.dubbingUsageReserved,
    });
    await dubbingJobFinalizer.markJobFailed({ job, error: err });

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

    const projectId = await findProjectIdByJobId(job._id, "dubbing");
    if (projectId && response.usage) {
      await recordProjectUsage(projectId, {
        model: "gpt-4o-mini",
        inputTokens: response.usage.prompt_tokens,
        outputTokens: response.usage.completion_tokens,
      });
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

    const projectId = await findProjectIdByJobId(job._id, "dubbing");
    const nextRev = (seg.revision ?? 0) + 1;
    const audioResult =
      await dubbingSegmentAudioService.synthesizeSyncAndUploadSegment({
        provider,
        text: rawText,
        voiceKey,
        targetLanguage: job.targetLanguage,
        start: seg.start ?? 0,
        end: seg.end ?? 0,
        syncOpts: { maxAtempo: resolveMaxAtempo(job.targetLanguage) },
        tmpPaths,
        userId: req.userId,
        jobMongoId: job._id,
        segmentId,
        revision: nextRev,
        projectId,
      });
    const key = audioResult.audioKey;
    const url = await storage.getPublicUrl(key);

    seg.dubbedAudioKey = key;
    seg.timingStrategy = audioResult.timingStrategy;
    seg.revision = nextRev;
    await job.save();

    res.json({
      segment: seg,
      audio: {
        key,
        url,
        strategy: audioResult.timingStrategy,
        adjustedDuration: audioResult.adjustedDuration,
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
    const projectId = await findProjectIdByJobId(job._id, "dubbing");
    const segmentId = uuidv4();
    const audioResult =
      await dubbingSegmentAudioService.synthesizeSyncAndUploadSegment({
        provider,
        text: rawText,
        voiceKey,
        targetLanguage: job.targetLanguage,
        start,
        end,
        syncOpts: { maxAtempo: resolveMaxAtempo(job.targetLanguage) },
        tmpPaths,
        userId: req.userId,
        jobMongoId: job._id,
        segmentId,
        revision: 0,
        projectId,
      });
    const key = audioResult.audioKey;
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
      timingStrategy: audioResult.timingStrategy,
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
        strategy: audioResult.timingStrategy,
        adjustedDuration: audioResult.adjustedDuration,
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
    const bgPath = await downloadStorageFileToTemp(
      job.backgroundKey,
      tmpPaths,
      "dub_bg",
      ".mp3",
    );

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
        const localMp3Path = await downloadStorageFileToTemp(
          seg.dubbedAudioKey,
          tmpPaths,
          `seg_${seg.segmentId}`,
          ".mp3",
        );
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
      const vidPath = await downloadStorageFileToTemp(
        job.originalVideoKey,
        tmpPaths,
        "dub_vid",
        ".mp4",
      );

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
      await saveLocalFileToStorage(outVideoPath, key, "video/mp4");
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
    await saveLocalFileToStorage(mixedForUpload, dubbedAudioKey, "audio/mpeg");
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
    await dubbingJobFinalizer.refreshCompletedJob(updated);

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

/**
 * GET /api/dubbing/:id/subtitles
 * Query params:
 *   format  – "srt" | "vtt" | "ass"  (default: "srt")
 *   lang    – "translated" | "original"  (default: "translated")
 *
 * Returns the subtitle file as a download attachment.
 */
exports.getDubbingSubtitles = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      const err = new Error("Dubbing job not found.");
      err.statusCode = 404;
      throw err;
    }

    const job = await DubbingJob.findById(req.params.id).select(
      "user status originalFileName segments",
    );
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
    if (job.status !== "completed") {
      const err = new Error("Subtitles are only available for completed jobs.");
      err.statusCode = 422;
      throw err;
    }

    const format = (req.query.format || "srt").toLowerCase().trim();
    if (!["srt", "vtt", "ass"].includes(format)) {
      const err = new Error("format must be one of: srt, vtt, ass.");
      err.statusCode = 400;
      throw err;
    }

    const useLang = (req.query.lang || "translated").toLowerCase().trim();
    if (!["translated", "original"].includes(useLang)) {
      const err = new Error('lang must be "translated" or "original".');
      err.statusCode = 400;
      throw err;
    }

    const segments = [...(job.segments || [])].sort((a, b) => a.start - b.start);
    const mapped = segments
      .map((seg) => ({
        start: seg.start,
        end: seg.end,
        text: (
          useLang === "original"
            ? (seg.originalText ?? seg.translatedText ?? "")
            : (seg.translatedText ?? seg.originalText ?? "")
        ).trim(),
      }))
      .filter((s) => s.text);

    if (!mapped.length) {
      const err = new Error("No subtitle segments available for this job.");
      err.statusCode = 422;
      throw err;
    }

    const GENERATORS = { srt: generateSRT, vtt: generateVTT, ass: generateASS };
    const MIME_TYPES = {
      srt: "text/plain; charset=utf-8",
      vtt: "text/vtt; charset=utf-8",
      ass: "text/x-ass; charset=utf-8",
    };

    const content = GENERATORS[format](mapped);
    const baseName = job.originalFileName.replace(/\.[^/.]+$/, "");
    const filename = `${baseName}_${useLang}.${format}`;

    res.setHeader("Content-Type", MIME_TYPES[format]);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(filename)}"`,
    );
    res.send(content);
  } catch (err) {
    if (!err.statusCode) err.statusCode = 500;
    next(err);
  }
};
