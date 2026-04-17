const fs = require("fs");
const path = require("path");
const os = require("os");
const { v4: uuidv4 } = require("uuid");
const mongoose = require("mongoose");
const OpenAI = require("openai");

const DubbingJob = require("../models/DubbingJob");
const User = require("../models/User");
const { storage } = require("../utils/storage");
const { extractRandomVideoThumbnailJpg } = require("../utils/videoThumbnailUtils");
const {
  calculateCreditsNeeded,
  assertEnoughCredits,
  deductCredits,
} = require("../utils/creditUtils");

const {
  getFileDuration,
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
} = require("../utils/dubbingTextUtils");
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
  BCP_47_MAP
} = require("../utils/sarvamTtsUtils");
const {
  isSmallestConfigured,
  fetchSmallestVoiceCatalog,
  selectBestSmallestVoice,
  synthesizeSmallestTts,
} = require("../utils/smallestTtsUtils");
const { loadLocalInworldVoices } = require("../utils/localInworldVoices");

// Dubbing costs more credits than subtitles — 5 credits per minute
const DUBBING_CREDITS_PER_MINUTE = 5;

const calculateDubbingCredits = (durationSeconds) =>
  Math.ceil(durationSeconds / 60) * DUBBING_CREDITS_PER_MINUTE;

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
  const o = await generateSpeech(plain, voiceKey);
  return { audioPath: o.audioPath, wordTimestamps: [] };
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

// ─── Controllers ──────────────────────────────────────────────────────────────

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
    if (!req.file) {
      emit({ stage: "error", message: "No file uploaded.", statusCode: 422 });
      return res.end();
    }

    const targetLanguage = (req.body.targetLanguage || "").trim();
    if (!targetLanguage) {
      emit({
        stage: "error",
        message: "targetLanguage is required.",
        statusCode: 422,
      });
      return res.end();
    }
    console.log("targetLanguage", targetLanguage);

    const sourceLanguage = (req.body.sourceLanguage || "").trim() || null;

    emit({ stage: "validating", message: "Checking file and credits…" });

    const isVideo = req.file.mimetype.startsWith("video/");
    const ext =
      path.extname(req.file.originalname) || (isVideo ? ".mp4" : ".mp3");
    const tmpInput = path.join(os.tmpdir(), `dub_input_${uuidv4()}${ext}`);
    fs.writeFileSync(tmpInput, req.file.buffer);
    tmpPaths.push(tmpInput);

    const duration = await getFileDuration(tmpInput);
    const creditsNeeded = calculateDubbingCredits(duration);

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

    let ttsProvider = getTtsProvider();

    const sarvamSupportedLanguages = Object.keys(BCP_47_MAP);
    if (sarvamSupportedLanguages.includes((targetLanguage || "").toLowerCase())) {
      ttsProvider = "sarvam";
    }

    if (
      ttsProvider === "elevenlabs" &&
      !String(process.env.ELEVENLABS_API_KEY || "").trim()
    ) {
      emit({
        stage: "error",
        message:
          "ELEVENLABS_API_KEY is required when DUBBING_TTS_PROVIDER=elevenlabs.",
        statusCode: 422,
      });
      return res.end();
    }
    if (
      !String(
        process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "",
      ).trim()
    ) {
      emit({
        stage: "error",
        message:
          "GOOGLE_API_KEY (or GEMINI_API_KEY) is required for dubbing transcription.",
        statusCode: 422,
      });
      return res.end();
    }
    if (!String(process.env.OPENAI_API_KEY || "").trim()) {
      emit({
        stage: "error",
        message:
          "OPENAI_API_KEY is required for dubbing (translation and voice selection).",
        statusCode: 422,
      });
      return res.end();
    }
    if (ttsProvider === "inworld" && !isInworldConfigured()) {
      emit({
        stage: "error",
        message:
          "INWORLD_API_KEY is required when DUBBING_TTS_PROVIDER=inworld.",
        statusCode: 422,
      });
      return res.end();
    }
    if (ttsProvider === "sarvam" && !isSarvamConfigured()) {
      emit({
        stage: "error",
        message:
          "SARVAM_API_KEY is required when DUBBING_TTS_PROVIDER=sarvam or for Indic languages.",
        statusCode: 422,
      });
      return res.end();
    }
    if (ttsProvider === "smallest" && !isSmallestConfigured()) {
      emit({
        stage: "error",
        message:
          "SMALLEST_API_KEY is required when DUBBING_TTS_PROVIDER=smallest.",
        statusCode: 422,
      });
      return res.end();
    }

    // Create a DB record immediately so the client can poll by ID
    job = await DubbingJob.create({
      user: req.userId,
      originalFileName: req.file.originalname,
      fileType: isVideo ? "video" : "audio",
      sourceLanguage: sourceLanguage || "auto",
      targetLanguage,
      duration,
      creditsUsed: creditsNeeded,
      status: "extracting",
    });

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

    // Generate a thumbnail for video uploads (best-effort)
    if (isVideo) {
      try {
        const tmpThumb = path.join(os.tmpdir(), `dub_thumb_${uuidv4()}.jpg`);
        tmpPaths.push(tmpThumb);
        await extractRandomVideoThumbnailJpg(tmpInput, tmpThumb);
        const key = `dubbing/${req.userId}/${uuidv4()}_thumb.jpg`;
        await storage.saveFile(fs.readFileSync(tmpThumb), key, "image/jpeg");
        job.thumbnailKey = key;
        await job.save();
      } catch (thumbErr) {
        console.warn("[dubbing] thumbnail generation failed:", thumbErr.message);
      }
    }

    // ── Step 1: Extract audio ─────────────────────────────────────────────────
    emit({ stage: "extracting", message: "Extracting audio from file…" });

    let audioPath = tmpInput;
    if (isVideo) {
      const tmpMp3 = path.join(os.tmpdir(), `dub_audio_${uuidv4()}.mp3`);
      tmpPaths.push(tmpMp3);
      await extractAudio(tmpInput, tmpMp3);
      audioPath = tmpMp3;
    }

    saveArtifact(jobIdStr, "01_full_audio.mp3", audioPath);

    // Upload original file to S3
    try {
      const videoKey = `dubbing/${req.userId}/${uuidv4()}${ext}`;
      await storage.saveFile(req.file.buffer, videoKey, req.file.mimetype);
      job.originalVideoKey = videoKey;
      await job.save();
    } catch (uploadErr) {
      console.warn("Original file S3 upload failed:", uploadErr.message);
    }

    // ── Step 2: Source separation ─────────────────────────────────────────────
    emit({
      stage: "separating",
      message: "Separating vocals from background audio…",
    });
    await DubbingJob.findByIdAndUpdate(job._id, { status: "separating" });

    const separationDir = path.join(os.tmpdir(), `dub_stems_${uuidv4()}`);
    tmpPaths.push(separationDir);

    const {
      vocalsPath,
      backgroundPath,
      method: separationMethod,
    } = await separateVocalsAndBackground(audioPath, separationDir);

    emit({
      stage: "separating",
      message: `Audio separated (${separationMethod === "replicate" ? "Demucs" : "ElevenLabs fallback"}).`,
    });

    saveArtifact(jobIdStr, "02_vocals.mp3", vocalsPath);
    saveArtifact(jobIdStr, "03_background.mp3", backgroundPath);

    // Upload stems to S3
    try {
      const [vocalsKey, backgroundKey] = await Promise.all([
        (async () => {
          const key = `dubbing/${req.userId}/${uuidv4()}_vocals.mp3`;
          await storage.saveFile(
            fs.readFileSync(vocalsPath),
            key,
            "audio/mpeg",
          );
          return key;
        })(),
        (async () => {
          const key = `dubbing/${req.userId}/${uuidv4()}_background.mp3`;
          await storage.saveFile(
            fs.readFileSync(backgroundPath),
            key,
            "audio/mpeg",
          );
          return key;
        })(),
      ]);
      await DubbingJob.findByIdAndUpdate(job._id, {
        vocalsKey,
        backgroundKey,
        separationMethod,
      });
    } catch (uploadErr) {
      console.warn("Stems S3 upload failed:", uploadErr.message);
    }

    // ── Step 3: Transcribe with speaker diarization ───────────────────────────
    emit({
      stage: "transcribing",
      message: "Transcribing audio and identifying speakers…",
    });
    await DubbingJob.findByIdAndUpdate(job._id, { status: "transcribing" });

    const { segments: rawSegments, speaker_profiles } =
      await transcribeWithSpeakers(vocalsPath, sourceLanguage, {
        fullMixPath: audioPath,
        backgroundPath,
      });

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
      console.log("targetLanguage", targetLanguage);

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
      emit({ stage: "generating", message: "Selecting Sarvam TTS voices for speakers…" });
      const assignedSarvamIds = [];
      for (const profile of speaker_profiles) {
        emit({ stage: "generating", message: `Selecting voice for ${profile.speaker_id}…` });
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
    const totalTtsUnits = ttsRows.length;
    const maxAtempo = resolveMaxAtempo(targetLanguage);
    const syncOpts = { maxAtempo };

    const rawDubbedPaths = [];
    let wordTsForRows = [];

    const stripAndCleanupPaths = (paths) => {
      const set = new Set(paths);
      for (let j = tmpPaths.length - 1; j >= 0; j--) {
        if (set.has(tmpPaths[j])) tmpPaths.splice(j, 1);
      }
      paths.forEach(cleanupPath);
    };

    if (ttsProvider === "openai") {
      for (let k = 0; k < totalTtsUnits; k++) {
        const row = ttsRows[k];
        const voiceKey = voiceMap[row.speaker_id];
        if (!voiceKey) {
          throw new Error(`No voice selected for speaker: ${row.speaker_id}`);
        }
        emit({
          stage: "generating",
          message: `Generating speech: clip ${k + 1}/${totalTtsUnits}…`,
          progress: Math.round(((k + 1) / totalTtsUnits) * 100),
        });
        const { audioPath, wordTimestamps } = await synthesizeDubbingTts(
          "openai",
          row.text,
          voiceKey,
          targetLanguage,
        );
        tmpPaths.push(audioPath);
        rawDubbedPaths.push(audioPath);
        wordTsForRows.push(wordTimestamps);
      }
    } else if (ttsProvider === "inworld") {
      for (let k = 0; k < totalTtsUnits; k++) {
        const row = ttsRows[k];
        const voiceKey = voiceMap[row.speaker_id];
        if (!voiceKey) {
          throw new Error(`No voice selected for speaker: ${row.speaker_id}`);
        }
        emit({
          stage: "generating",
          message: `Generating speech: clip ${k + 1}/${totalTtsUnits}…`,
          progress: Math.round(((k + 1) / totalTtsUnits) * 100),
        });
        const { audioPath, wordTimestamps } = await synthesizeDubbingTts(
          "inworld",
          row.text,
          voiceKey,
          targetLanguage,
        );
        tmpPaths.push(audioPath);
        rawDubbedPaths.push(audioPath);
        wordTsForRows.push(wordTimestamps);
      }
    } else if (ttsProvider === "smallest") {
      for (let k = 0; k < totalTtsUnits; k++) {
        const row = ttsRows[k];
        const voiceKey = voiceMap[row.speaker_id];
        if (!voiceKey) {
          throw new Error(`No voice selected for speaker: ${row.speaker_id}`);
        }
        emit({
          stage: "generating",
          message: `Generating speech: clip ${k + 1}/${totalTtsUnits}…`,
          progress: Math.round(((k + 1) / totalTtsUnits) * 100),
        });
        const { audioPath, wordTimestamps } = await synthesizeDubbingTts(
          "smallest",
          row.text,
          voiceKey,
          targetLanguage,
        );
        tmpPaths.push(audioPath);
        rawDubbedPaths.push(audioPath);
        wordTsForRows.push(wordTimestamps);
      }
    } else if (ttsProvider === "sarvam") {
      for (let k = 0; k < totalTtsUnits; k++) {
        const row = ttsRows[k];
        const voiceKey = voiceMap[row.speaker_id];
        if (!voiceKey) {
          throw new Error(`No voice selected for speaker: ${row.speaker_id}`);
        }
        emit({
          stage: "generating",
          message: `Generating speech: clip ${k + 1}/${totalTtsUnits}…`,
          progress: Math.round(((k + 1) / totalTtsUnits) * 100),
        });
        const { audioPath, wordTimestamps } = await synthesizeDubbingTts(
          "sarvam",
          row.text,
          voiceKey,
          targetLanguage,
        );
        tmpPaths.push(audioPath);
        rawDubbedPaths.push(audioPath);
        wordTsForRows.push(wordTimestamps);
      }
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

          wordTsForRows = [];
          for (let k = 0; k < totalTtsUnits; k++) {
            const row = ttsRows[k];
            emit({
              stage: "generating",
              message: `Generating speech: clip ${k + 1}/${totalTtsUnits}…`,
              progress: Math.round(((k + 1) / totalTtsUnits) * 100),
            });
            const { audioPath, wordTimestamps } = await synthesizeDubbingTts(
              "inworld",
              row.text,
              voiceMap[row.speaker_id],
              targetLanguage,
            );
            tmpPaths.push(audioPath);
            rawDubbedPaths.push(audioPath);
            iwPaths.push(audioPath);
            wordTsForRows.push(wordTimestamps);
          }
          resolvedTtsProvider = "inworld";
          autoDone = true;
        } catch (iwErr) {
          console.warn("[dubbing] Inworld TTS failed:", iwErr.message);
          stripAndCleanupPaths(iwPaths);
          rawDubbedPaths.length = 0;
          wordTsForRows = [];
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

          wordTsForRows = [];
          for (let k = 0; k < totalTtsUnits; k++) {
            const row = ttsRows[k];
            emit({
              stage: "generating",
              message: `Generating speech: clip ${k + 1}/${totalTtsUnits}…`,
              progress: Math.round(((k + 1) / totalTtsUnits) * 100),
            });
            const { audioPath, wordTimestamps } = await synthesizeDubbingTts(
              "smallest",
              row.text,
              voiceMap[row.speaker_id],
              targetLanguage,
            );
            tmpPaths.push(audioPath);
            rawDubbedPaths.push(audioPath);
            smPaths.push(audioPath);
            wordTsForRows.push(wordTimestamps);
          }
          resolvedTtsProvider = "smallest";
          autoDone = true;
        } catch (smErr) {
          console.warn("[dubbing] Smallest TTS failed:", smErr.message);
          stripAndCleanupPaths(smPaths);
          rawDubbedPaths.length = 0;
          wordTsForRows = [];
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

          wordTsForRows = [];
          for (let k = 0; k < totalTtsUnits; k++) {
            const row = ttsRows[k];
            emit({
              stage: "generating",
              message: `Generating speech: clip ${k + 1}/${totalTtsUnits}…`,
              progress: Math.round(((k + 1) / totalTtsUnits) * 100),
            });
            const { audioPath, wordTimestamps } = await synthesizeDubbingTts(
              "elevenlabs",
              row.text,
              voiceMap[row.speaker_id],
              targetLanguage,
            );
            tmpPaths.push(audioPath);
            rawDubbedPaths.push(audioPath);
            elPaths.push(audioPath);
            wordTsForRows.push(wordTimestamps);
          }
          resolvedTtsProvider = "elevenlabs";
          autoDone = true;
        } catch (elErr) {
          stripAndCleanupPaths(elPaths);
          rawDubbedPaths.length = 0;
          wordTsForRows = [];
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

        wordTsForRows = [];
        for (let k = 0; k < totalTtsUnits; k++) {
          const row = ttsRows[k];
          emit({
            stage: "generating",
            message: `Generating speech: clip ${k + 1}/${totalTtsUnits}…`,
            progress: Math.round(((k + 1) / totalTtsUnits) * 100),
          });
          const { audioPath, wordTimestamps } = await synthesizeDubbingTts(
            "openai",
            row.text,
            voiceMap[row.speaker_id],
            targetLanguage,
          );
          tmpPaths.push(audioPath);
          rawDubbedPaths.push(audioPath);
          wordTsForRows.push(wordTimestamps);
        }
      }
    } else {
      for (let k = 0; k < totalTtsUnits; k++) {
        const row = ttsRows[k];
        const voiceId = voiceMap[row.speaker_id];
        if (!voiceId) {
          throw new Error(`No voice selected for speaker: ${row.speaker_id}`);
        }
        emit({
          stage: "generating",
          message: `Generating speech: clip ${k + 1}/${totalTtsUnits}…`,
          progress: Math.round(((k + 1) / totalTtsUnits) * 100),
        });
        const { audioPath, wordTimestamps } = await synthesizeDubbingTts(
          "elevenlabs",
          row.text,
          voiceId,
          targetLanguage,
        );
        tmpPaths.push(audioPath);
        rawDubbedPaths.push(audioPath);
        wordTsForRows.push(wordTimestamps);
      }
    }

    rawDubbedPaths.forEach((p, idx) => {
      saveArtifact(
        jobIdStr,
        `tts_raw/segment_${String(idx + 1).padStart(3, "0")}.mp3`,
        p,
      );
    });

    // ── Step 7: Timing sync ───────────────────────────────────────────────────
    emit({ stage: "syncing", message: "Synchronising segment timing…" });
    await DubbingJob.findByIdAndUpdate(job._id, { status: "syncing" });

    const syncedBuffers = [];
    const timelineSegments = [];
    for (let k = 0; k < ttsRows.length; k++) {
      const row = ttsRows[k];
      const originalDuration = Math.max(0.05, row.end - row.start);
      const synced = await syncSegmentTiming(
        rawDubbedPaths[k],
        originalDuration,
        syncOpts,
      );
      tmpPaths.push(synced.adjustedPath);
      syncedBuffers.push(synced);
      timelineSegments.push({
        start: row.start,
        end: row.end,
        speaker_id: row.speaker_id,
        translatedText: row.text,
      });
    }

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

    syncedBuffers.forEach((synced, idx) => {
      saveArtifact(
        jobIdStr,
        `tts_synced/segment_${String(idx + 1).padStart(3, "0")}.mp3`,
        synced.adjustedPath,
      );
    });

    emit({ stage: "syncing", message: "Timing sync complete." });

    // ── Step 7b: Pre-generate segmentIds and upload per-segment synced audio to S3 ──
    emit({ stage: "syncing", message: "Uploading per-segment audio clips…" });

    const segmentIds = translatedSegments.map(() => uuidv4());
    const segmentAudioKeys = new Map(); // parentIndex → S3 key

    for (let k = 0; k < ttsRows.length; k++) {
      const row = ttsRows[k];
      // Only upload solo (non-split) segments; sub-segments are re-synthesised on rebuild
      if (row.subIndex < 0) {
        try {
          const synced = syncedBuffers[k];
          const segId = segmentIds[row.parentIndex];
          const segKey = `dubbing/${req.userId}/${job._id.toString()}/segments/${segId}_r0.mp3`;
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
    }

    // ── Step 8: Merge speech over background + mux with video ─────────────────
    emit({
      stage: "merging",
      message: "Mixing dubbed speech with background audio…",
    });
    await DubbingJob.findByIdAndUpdate(job._id, { status: "merging" });

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

    let finalOutputPath;
    let finalMimeType;
    let finalExt;

    if (isVideo) {
      finalOutputPath = path.join(os.tmpdir(), `dub_final_${uuidv4()}.mp4`);
      finalMimeType = "video/mp4";
      finalExt = ".mp4";
      tmpPaths.push(finalOutputPath);

      let lipsyncedPath = null;
      try {
        emit({ stage: "lipsync", message: "Lip-syncing video…" });
        lipsyncedPath = await lipSyncVideo({
          inputVideoPath: tmpInput,
          inputAudioPath: mixedAudioForOutput,
          outputVideoPath: finalOutputPath,
        });
      } catch (lipErr) {
        const strict = String(process.env.LIPSYNC_STRICT || "0").trim() === "1";
        console.warn(
          "Lip-sync failed:",
          lipErr && lipErr.message ? lipErr.message : lipErr,
        );
        if (strict) throw lipErr;
      }

      if (lipsyncedPath) {
        saveArtifact(jobIdStr, "final_dubbed_lipsynced.mp4", finalOutputPath);
      } else {
        emit({ stage: "merging", message: "Muxing dubbed audio into video…" });
        await muxWithVideo(tmpInput, mixedAudioForOutput, finalOutputPath);
        saveArtifact(jobIdStr, "final_dubbed.mp4", finalOutputPath);
      }
    } else {
      finalOutputPath = mixedAudioForOutput;
      finalMimeType = "audio/mpeg";
      finalExt = ".mp3";
      saveArtifact(jobIdStr, "final_dubbed.mp3", finalOutputPath);
    }

    // ── Step 9: Upload dubbed mix + final output to storage ───────────────────
    emit({ stage: "merging", message: "Uploading final dubbed output…" });

    let dubbedAudioKey = null;
    let dubbedAudioUrl = null;
    try {
      dubbedAudioKey = `dubbing/${req.userId}/${uuidv4()}_dubbed_audio.mp3`;
      await storage.saveFile(
        fs.readFileSync(mixedAudioForOutput),
        dubbedAudioKey,
        "audio/mpeg",
      );
      dubbedAudioUrl = await storage.getPublicUrl(dubbedAudioKey);
    } catch (mixUploadErr) {
      console.warn("Dubbed audio (mix) upload failed:", mixUploadErr.message);
    }

    const finalKey = `dubbing/${req.userId}/${uuidv4()}_dubbed${finalExt}`;
    await storage.saveFile(
      fs.readFileSync(finalOutputPath),
      finalKey,
      finalMimeType,
    );
    const finalUrl = await storage.getPublicUrl(finalKey);

    // ── Step 10: Deduct credits + finalise job ────────────────────────────────
    emit({ stage: "saving", message: "Saving results…" });

    await deductCredits(
      req.userId,
      creditsNeeded,
      "dubbing_job",
      `Dubbed ${req.file.originalname} → ${targetLanguage} (${creditsNeeded} credits)`,
      {
        fileName: req.file.originalname,
        fileType: isVideo ? "video" : "audio",
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
        segmentId: segmentIds[i],                          // use pre-generated ID
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
        // Solo segments get their own S3 key; sub-segment parents stay null (rebuilt on demand)
        dubbedAudioKey: subs.length ? null : (segmentAudioKeys.get(i) ?? null),
      };
    });

    const finalJob = await DubbingJob.findByIdAndUpdate(
      job._id,
      {
        status: "completed",
        dubbedVideoKey: finalKey,
        dubbedVideoUrl: finalUrl,
        dubbedAudioKey,
        dubbedAudioUrl,
        localOutputPath,
        separationMethod,
        ttsProvider: resolvedTtsProvider,
        segments: segmentsForDb,
        speakerProfiles: updatedProfiles,
      },
      { new: true },
    );

    emit({
      stage: "done",
      message: "Dubbing complete!",
      job: finalJob,
      dubbedUrl: finalUrl,
      dubbedAudioUrl,
      localOutputPath,
    });

    res.end();
  } catch (err) {
    console.error("Dubbing pipeline error:", err);

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
    // Clean up all temp files
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
      const err = new Error("Valid start and end seconds are required (end > start).");
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
      audio: { key, url, strategy: synced.strategy, adjustedDuration: synced.adjustedDuration },
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
