const fs = require("fs");
const path = require("path");
const os = require("os");
const { v4: uuidv4 } = require("uuid");
const mongoose = require("mongoose");

const DubbingJob = require("../models/DubbingJob");
const User = require("../models/User");
const { storage } = require("../utils/storage");
const { calculateCreditsNeeded, assertEnoughCredits, deductCredits } = require("../utils/creditUtils");

const { getFileDuration, extractAudio, cleanupPath } = require("../utils/audioUtils");
const { separateVocalsAndBackground } = require("../utils/sourceSeparationUtils");
const { transcribeWithSpeakers } = require("../utils/transcribeUtils");
const { translateToSpeechReady } = require("../utils/translationUtils");
const {
  getTtsProvider,
  isElevenLabsLibraryVoiceBlockedError,
  fetchAvailableVoices,
  selectBestVoice,
  selectBestOpenAIVoice,
  generateSpeech,
  generateSpeechOpenAI,
} = require("../utils/ttsUtils");
const { syncSegmentTiming, buildTimeline } = require("../utils/timingSyncUtils");
const { layerSpeechOverBackground, muxWithVideo, mergeAudioOnly } = require("../utils/audioMergeUtils");
const { getJobOutputDir, saveArtifact } = require("../utils/dubbingOutputUtils");
const { lipSyncVideo } = require("../utils/lipSyncRunner");
const {
  isInworldConfigured,
  fetchInworldVoiceCatalog,
  selectBestInworldVoice,
  synthesizeInworldTts,
} = require("../utils/inworldTtsUtils");
const {
  isSmallestConfigured,
  fetchSmallestVoiceCatalog,
  selectBestSmallestVoice,
  synthesizeSmallestTts,
} = require("../utils/smallestTtsUtils");

// Dubbing costs more credits than subtitles — 5 credits per minute
const DUBBING_CREDITS_PER_MINUTE = 5;

const calculateDubbingCredits = (durationSeconds) =>
  Math.ceil(durationSeconds / 60) * DUBBING_CREDITS_PER_MINUTE;

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
      emit({ stage: "error", message: "targetLanguage is required.", statusCode: 422 });
      return res.end();
    }

    const sourceLanguage = (req.body.sourceLanguage || "").trim() || null;

    emit({ stage: "validating", message: "Checking file and credits…" });

    const isVideo = req.file.mimetype.startsWith("video/");
    const ext = path.extname(req.file.originalname) || (isVideo ? ".mp4" : ".mp3");
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

    const ttsProvider = getTtsProvider();
    if (ttsProvider === "elevenlabs" && !String(process.env.ELEVENLABS_API_KEY || "").trim()) {
      emit({
        stage: "error",
        message: "ELEVENLABS_API_KEY is required when DUBBING_TTS_PROVIDER=elevenlabs.",
        statusCode: 422,
      });
      return res.end();
    }
    if (!String(process.env.OPENAI_API_KEY || "").trim()) {
      emit({ stage: "error", message: "OPENAI_API_KEY is required for dubbing.", statusCode: 422 });
      return res.end();
    }
    if (ttsProvider === "inworld" && !isInworldConfigured()) {
      emit({
        stage: "error",
        message: "INWORLD_API_KEY is required when DUBBING_TTS_PROVIDER=inworld.",
        statusCode: 422,
      });
      return res.end();
    }
    if (ttsProvider === "smallest" && !isSmallestConfigured()) {
      emit({
        stage: "error",
        message: "SMALLEST_API_KEY is required when DUBBING_TTS_PROVIDER=smallest.",
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
      console.warn("Could not create dubbing local output dir:", mkdirErr.message);
    }
    saveArtifact(jobIdStr, `00_input${ext}`, tmpInput);

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
    emit({ stage: "separating", message: "Separating vocals from background audio…" });
    await DubbingJob.findByIdAndUpdate(job._id, { status: "separating" });

    const separationDir = path.join(os.tmpdir(), `dub_stems_${uuidv4()}`);
    tmpPaths.push(separationDir);

    const { vocalsPath, backgroundPath, method: separationMethod } = await separateVocalsAndBackground(
      audioPath,
      separationDir
    );

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
          await storage.saveFile(fs.readFileSync(vocalsPath), key, "audio/mpeg");
          return key;
        })(),
        (async () => {
          const key = `dubbing/${req.userId}/${uuidv4()}_background.mp3`;
          await storage.saveFile(fs.readFileSync(backgroundPath), key, "audio/mpeg");
          return key;
        })(),
      ]);
      await DubbingJob.findByIdAndUpdate(job._id, { vocalsKey, backgroundKey, separationMethod });
    } catch (uploadErr) {
      console.warn("Stems S3 upload failed:", uploadErr.message);
    }

    // ── Step 3: Transcribe with speaker diarization ───────────────────────────
    emit({ stage: "transcribing", message: "Transcribing audio and identifying speakers…" });
    await DubbingJob.findByIdAndUpdate(job._id, { status: "transcribing" });

    const { segments: rawSegments, speaker_profiles } = await transcribeWithSpeakers(
      vocalsPath,
      sourceLanguage
    );

    emit({
      stage: "transcribing",
      message: `Transcription complete. Found ${rawSegments.length} segments, ${speaker_profiles.length} speaker(s).`,
      speakerCount: speaker_profiles.length,
      segmentCount: rawSegments.length,
    });

    // ── Step 4: Translate to speech-ready target language ────────────────────
    emit({ stage: "translating", message: `Translating to ${targetLanguage}…` });
    await DubbingJob.findByIdAndUpdate(job._id, { status: "translating" });

    const translatedSegments = await translateToSpeechReady(
      rawSegments,
      targetLanguage,
      speaker_profiles
    );

    emit({ stage: "translating", message: "Translation complete." });

    // ── Step 5: Match each speaker to a TTS voice (OpenAI, Inworld, Smallest, or ElevenLabs) ─
    emit({ stage: "generating", message: "Matching speakers to voices…" });
    await DubbingJob.findByIdAndUpdate(job._id, { status: "generating" });

    let resolvedTtsProvider =
      ttsProvider === "openai"
        ? "openai"
        : ttsProvider === "inworld"
          ? "inworld"
          : ttsProvider === "smallest"
            ? "smallest"
            : ttsProvider === "auto"
              ? "openai"
              : "elevenlabs";
    let voiceMap = {};
    let updatedProfiles = [];

    if (ttsProvider === "openai") {
      emit({ stage: "generating", message: "Selecting OpenAI TTS voices for speakers…" });
      for (const profile of speaker_profiles) {
        emit({
          stage: "generating",
          message: `Selecting voice for ${profile.speaker_id}…`,
        });
        const v = await selectBestOpenAIVoice(profile.voice_description);
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
      emit({ stage: "generating", message: "Loading Inworld voice catalog…" });
      const inworldCatalog = await fetchInworldVoiceCatalog();
      emit({ stage: "generating", message: "Selecting Inworld TTS voices for speakers…" });
      for (const profile of speaker_profiles) {
        emit({
          stage: "generating",
          message: `Selecting voice for ${profile.speaker_id}…`,
        });
        const v = await selectBestInworldVoice(profile.voice_description, inworldCatalog);
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
      emit({ stage: "generating", message: "Loading Smallest.ai Waves voice catalog…" });
      const smallestCatalog = await fetchSmallestVoiceCatalog();
      emit({ stage: "generating", message: "Selecting Smallest TTS voices for speakers…" });
      for (const profile of speaker_profiles) {
        emit({
          stage: "generating",
          message: `Selecting voice for ${profile.speaker_id}…`,
        });
        const v = await selectBestSmallestVoice(profile.voice_description, smallestCatalog);
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
    } else if (ttsProvider === "auto") {
      // Voice map + synthesis for auto: Inworld → Smallest → ElevenLabs → OpenAI (Step 6)
    } else {
      const availableVoices = await fetchAvailableVoices();
      for (const profile of speaker_profiles) {
        emit({
          stage: "generating",
          message: `Selecting voice for ${profile.speaker_id}…`,
        });
        const voiceId = await selectBestVoice(profile.voice_description, availableVoices);
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
    emit({ stage: "generating", message: "Generating dubbed audio for each segment…" });

    const rawDubbedPaths = [];
    const totalSegments = translatedSegments.length;

    const stripAndCleanupPaths = (paths) => {
      const set = new Set(paths);
      for (let j = tmpPaths.length - 1; j >= 0; j--) {
        if (set.has(tmpPaths[j])) tmpPaths.splice(j, 1);
      }
      paths.forEach(cleanupPath);
    };

    if (ttsProvider === "openai") {
      for (let i = 0; i < totalSegments; i++) {
        const seg = translatedSegments[i];
        const voiceKey = voiceMap[seg.speaker_id];
        if (!voiceKey) {
          throw new Error(`No voice selected for speaker: ${seg.speaker_id}`);
        }
        emit({
          stage: "generating",
          message: `Generating speech: segment ${i + 1}/${totalSegments}…`,
          progress: Math.round(((i + 1) / totalSegments) * 100),
        });
        const { audioPath: ttsPath } = await generateSpeechOpenAI(seg.translatedText, voiceKey);
        tmpPaths.push(ttsPath);
        rawDubbedPaths.push(ttsPath);
      }
    } else if (ttsProvider === "inworld") {
      for (let i = 0; i < totalSegments; i++) {
        const seg = translatedSegments[i];
        const voiceKey = voiceMap[seg.speaker_id];
        if (!voiceKey) {
          throw new Error(`No voice selected for speaker: ${seg.speaker_id}`);
        }
        emit({
          stage: "generating",
          message: `Generating speech: segment ${i + 1}/${totalSegments}…`,
          progress: Math.round(((i + 1) / totalSegments) * 100),
        });
        const { audioPath: ttsPath } = await synthesizeInworldTts(seg.translatedText, voiceKey);
        tmpPaths.push(ttsPath);
        rawDubbedPaths.push(ttsPath);
      }
    } else if (ttsProvider === "smallest") {
      for (let i = 0; i < totalSegments; i++) {
        const seg = translatedSegments[i];
        const voiceKey = voiceMap[seg.speaker_id];
        if (!voiceKey) {
          throw new Error(`No voice selected for speaker: ${seg.speaker_id}`);
        }
        emit({
          stage: "generating",
          message: `Generating speech: segment ${i + 1}/${totalSegments}…`,
          progress: Math.round(((i + 1) / totalSegments) * 100),
        });
        const { audioPath: ttsPath } = await synthesizeSmallestTts(seg.translatedText, voiceKey);
        tmpPaths.push(ttsPath);
        rawDubbedPaths.push(ttsPath);
      }
    } else if (ttsProvider === "auto") {
      let autoDone = false;
      const iwPaths = [];

      if (isInworldConfigured()) {
        try {
          emit({ stage: "generating", message: "Trying Inworld TTS…" });
          emit({ stage: "generating", message: "Loading Inworld voice catalog…" });
          const inworldCatalog = await fetchInworldVoiceCatalog();
          voiceMap = {};
          updatedProfiles = [];
          for (const profile of speaker_profiles) {
            emit({
              stage: "generating",
              message: `Selecting Inworld voice for ${profile.speaker_id}…`,
            });
            const v = await selectBestInworldVoice(profile.voice_description, inworldCatalog);
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

          for (let i = 0; i < totalSegments; i++) {
            const seg = translatedSegments[i];
            emit({
              stage: "generating",
              message: `Generating speech: segment ${i + 1}/${totalSegments}…`,
              progress: Math.round(((i + 1) / totalSegments) * 100),
            });
            const { audioPath: ttsPath } = await synthesizeInworldTts(
              seg.translatedText,
              voiceMap[seg.speaker_id]
            );
            tmpPaths.push(ttsPath);
            rawDubbedPaths.push(ttsPath);
            iwPaths.push(ttsPath);
          }
          resolvedTtsProvider = "inworld";
          autoDone = true;
        } catch (iwErr) {
          console.warn("[dubbing] Inworld TTS failed:", iwErr.message);
          stripAndCleanupPaths(iwPaths);
          rawDubbedPaths.length = 0;
          emit({
            stage: "generating",
            message: `Inworld TTS failed; trying Smallest.ai. (${iwErr.message})`,
          });
        }
      }

      if (!autoDone && isSmallestConfigured()) {
        const smPaths = [];
        try {
          emit({ stage: "generating", message: "Trying Smallest.ai Waves TTS…" });
          const smallestCatalog = await fetchSmallestVoiceCatalog();
          voiceMap = {};
          updatedProfiles = [];
          for (const profile of speaker_profiles) {
            emit({
              stage: "generating",
              message: `Selecting Smallest voice for ${profile.speaker_id}…`,
            });
            const v = await selectBestSmallestVoice(profile.voice_description, smallestCatalog);
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

          for (let i = 0; i < totalSegments; i++) {
            const seg = translatedSegments[i];
            emit({
              stage: "generating",
              message: `Generating speech: segment ${i + 1}/${totalSegments}…`,
              progress: Math.round(((i + 1) / totalSegments) * 100),
            });
            const { audioPath: ttsPath } = await synthesizeSmallestTts(
              seg.translatedText,
              voiceMap[seg.speaker_id]
            );
            tmpPaths.push(ttsPath);
            rawDubbedPaths.push(ttsPath);
            smPaths.push(ttsPath);
          }
          resolvedTtsProvider = "smallest";
          autoDone = true;
        } catch (smErr) {
          console.warn("[dubbing] Smallest TTS failed:", smErr.message);
          stripAndCleanupPaths(smPaths);
          rawDubbedPaths.length = 0;
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
          for (const profile of speaker_profiles) {
            emit({
              stage: "generating",
              message: `Selecting voice for ${profile.speaker_id}…`,
            });
            const voiceId = await selectBestVoice(profile.voice_description, availableVoices);
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

          for (let i = 0; i < totalSegments; i++) {
            const seg = translatedSegments[i];
            emit({
              stage: "generating",
              message: `Generating speech: segment ${i + 1}/${totalSegments}…`,
              progress: Math.round(((i + 1) / totalSegments) * 100),
            });
            const { audioPath: ttsPath } = await generateSpeech(
              seg.translatedText,
              voiceMap[seg.speaker_id]
            );
            tmpPaths.push(ttsPath);
            rawDubbedPaths.push(ttsPath);
            elPaths.push(ttsPath);
          }
          resolvedTtsProvider = "elevenlabs";
          autoDone = true;
        } catch (elErr) {
          stripAndCleanupPaths(elPaths);
          rawDubbedPaths.length = 0;
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
        emit({ stage: "generating", message: "Selecting OpenAI TTS voices for speakers…" });
        voiceMap = {};
        updatedProfiles = [];
        for (const profile of speaker_profiles) {
          emit({
            stage: "generating",
            message: `Selecting voice for ${profile.speaker_id}…`,
          });
          const v = await selectBestOpenAIVoice(profile.voice_description);
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

        for (let i = 0; i < totalSegments; i++) {
          const seg = translatedSegments[i];
          emit({
            stage: "generating",
            message: `Generating speech: segment ${i + 1}/${totalSegments}…`,
            progress: Math.round(((i + 1) / totalSegments) * 100),
          });
          const { audioPath: ttsPath } = await generateSpeechOpenAI(
            seg.translatedText,
            voiceMap[seg.speaker_id]
          );
          tmpPaths.push(ttsPath);
          rawDubbedPaths.push(ttsPath);
        }
      }
    } else {
      for (let i = 0; i < totalSegments; i++) {
        const seg = translatedSegments[i];
        const voiceId = voiceMap[seg.speaker_id];
        if (!voiceId) {
          throw new Error(`No voice selected for speaker: ${seg.speaker_id}`);
        }
        emit({
          stage: "generating",
          message: `Generating speech: segment ${i + 1}/${totalSegments}…`,
          progress: Math.round(((i + 1) / totalSegments) * 100),
        });
        const { audioPath: ttsPath } = await generateSpeech(seg.translatedText, voiceId);
        tmpPaths.push(ttsPath);
        rawDubbedPaths.push(ttsPath);
      }
    }

    rawDubbedPaths.forEach((p, idx) => {
      saveArtifact(
        jobIdStr,
        `tts_raw/segment_${String(idx + 1).padStart(3, "0")}.mp3`,
        p
      );
    });

    // ── Step 7: Timing sync ───────────────────────────────────────────────────
    emit({ stage: "syncing", message: "Synchronising segment timing…" });
    await DubbingJob.findByIdAndUpdate(job._id, { status: "syncing" });

    const syncedBuffers = [];
    for (let i = 0; i < translatedSegments.length; i++) {
      const seg = translatedSegments[i];
      const originalDuration = seg.end - seg.start;

      const synced = await syncSegmentTiming(rawDubbedPaths[i], originalDuration);
      tmpPaths.push(synced.adjustedPath);
      syncedBuffers.push(synced);
    }

    const timeline = buildTimeline(translatedSegments, syncedBuffers);

    syncedBuffers.forEach((synced, idx) => {
      saveArtifact(
        jobIdStr,
        `tts_synced/segment_${String(idx + 1).padStart(3, "0")}.mp3`,
        synced.adjustedPath
      );
    });

    emit({ stage: "syncing", message: "Timing sync complete." });

    // ── Step 8: Merge speech over background + mux with video ─────────────────
    emit({ stage: "merging", message: "Mixing dubbed speech with background audio…" });
    await DubbingJob.findByIdAndUpdate(job._id, { status: "merging" });

    const mixedAudioPath = path.join(os.tmpdir(), `dub_mixed_${uuidv4()}.mp3`);
    tmpPaths.push(mixedAudioPath);

    await layerSpeechOverBackground(timeline, backgroundPath, mixedAudioPath, duration);

    saveArtifact(jobIdStr, "dubbed_mix.mp3", mixedAudioPath);

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
          inputAudioPath: mixedAudioPath,
          outputVideoPath: finalOutputPath,
        });
      } catch (lipErr) {
        const strict = String(process.env.LIPSYNC_STRICT || "0").trim() === "1";
        console.warn("Lip-sync failed:", lipErr && lipErr.message ? lipErr.message : lipErr);
        if (strict) throw lipErr;
      }

      if (lipsyncedPath) {
        saveArtifact(jobIdStr, "final_dubbed_lipsynced.mp4", finalOutputPath);
      } else {
        emit({ stage: "merging", message: "Muxing dubbed audio into video…" });
        await muxWithVideo(tmpInput, mixedAudioPath, finalOutputPath);
        saveArtifact(jobIdStr, "final_dubbed.mp4", finalOutputPath);
      }
    } else {
      finalOutputPath = mixedAudioPath;
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
      await storage.saveFile(fs.readFileSync(mixedAudioPath), dubbedAudioKey, "audio/mpeg");
      dubbedAudioUrl = await storage.getPublicUrl(dubbedAudioKey);
    } catch (mixUploadErr) {
      console.warn("Dubbed audio (mix) upload failed:", mixUploadErr.message);
    }

    const finalKey = `dubbing/${req.userId}/${uuidv4()}_dubbed${finalExt}`;
    await storage.saveFile(fs.readFileSync(finalOutputPath), finalKey, finalMimeType);
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
      }
    );

    // Persist final state to DB
    const segmentsForDb = timeline.map((seg, i) => ({
      start: seg.start,
      end: seg.end,
      speaker_id: seg.speaker_id,
      originalText: translatedSegments[i].originalText,
      translatedText: seg.translatedText,
      timingStrategy: seg.strategy,
    }));

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
      { new: true }
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

    res.json({ job });
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

    res.json({
      jobs,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
};
