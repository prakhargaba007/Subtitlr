const fs = require("fs");
const { v4: uuidv4 } = require("uuid");

const DubbingJob = require("../../models/DubbingJob");
const { recordProjectUsage } = require("../../utils/usageTracker");
const { syncSegmentTiming } = require("../../utils/timingSyncUtils");
const { saveArtifact } = require("../../utils/dubbingOutputUtils");
const {
  textForInworldTts,
  textForNonInworldTts,
  textForGeminiTts,
} = require("../../utils/dubbingTextUtils");
const {
  generateSpeech,
  generateSpeechOpenAI,
} = require("../../utils/ttsUtils");
const { synthesizeInworldTts } = require("../../utils/inworldTtsUtils");
const { synthesizeSarvamTts } = require("../../utils/sarvamTtsUtils");
const { synthesizeSmallestTts } = require("../../utils/smallestTtsUtils");
const { synthesizeGeminiTts } = require("../../utils/geminiTtsUtils");
const { saveLocalFileToStorage } = require("../../utils/storageFileUtils");

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
    return {
      audioPath: o.audioPath,
      wordTimestamps: [],
      usage: { model: "tts-1", outputCharacters: o.characterCount },
    };
  }
  if (ttsProviderResolved === "sarvam") {
    const o = await synthesizeSarvamTts(plain, voiceKey, targetLanguage);
    return {
      audioPath: o.audioPath,
      wordTimestamps: [],
      usage: { model: "bulbul:v3", outputCharacters: plain.length },
    };
  }
  if (ttsProviderResolved === "inworld") {
    const o = await synthesizeInworldTts(iwText, voiceKey);
    return {
      audioPath: o.audioPath,
      wordTimestamps: o.wordTimestamps || [],
      usage: { model: "inworld-tts-1.5-max", outputCharacters: iwText.length },
    };
  }
  if (ttsProviderResolved === "smallest") {
    const o = await synthesizeSmallestTts(plain, voiceKey);
    return {
      audioPath: o.audioPath,
      wordTimestamps: [],
      usage: { model: "lightning", seconds: o.durationSeconds },
    };
  }
  if (ttsProviderResolved === "gemini") {
    const o = await synthesizeGeminiTts(textForGeminiTts(text), voiceKey);
    return {
      audioPath: o.audioPath,
      wordTimestamps: [],
      usage: {
        model: "gemini-3.1-flash-tts-preview",
        inputTokens: o.usage?.promptTokenCount,
        outputTokens: o.usage?.candidatesTokenCount,
      },
    };
  }
  const o = await generateSpeech(plain, voiceKey);
  return {
    audioPath: o.audioPath,
    wordTimestamps: [],
    usage: { model: "eleven_flash_v2_5", outputCharacters: o.characterCount },
  };
}

function getDubbingSegmentPipelineConcurrency() {
  const raw = String(
    process.env.DUBBING_SEGMENT_PIPELINE_CONCURRENCY || "3",
  ).trim();
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return 3;
  return Math.min(8, n);
}

async function synthesizeSyncAndUploadSegment({
  provider,
  text,
  voiceKey,
  targetLanguage,
  start,
  end,
  syncOpts,
  tmpPaths,
  userId,
  jobMongoId,
  segmentId,
  revision = 0,
  projectId,
}) {
  const {
    audioPath,
    wordTimestamps,
    usage: ttsUsage,
  } = await synthesizeDubbingTts(provider, text, voiceKey, targetLanguage);
  if (ttsUsage && projectId) {
    await recordProjectUsage(projectId, ttsUsage);
  }
  if (Array.isArray(tmpPaths)) tmpPaths.push(audioPath);

  const originalDuration = Math.max(0.05, end - start);
  const synced = await syncSegmentTiming(audioPath, originalDuration, syncOpts);
  if (Array.isArray(tmpPaths)) tmpPaths.push(synced.adjustedPath);

  const key = `dubbing/${userId}/${jobMongoId.toString()}/segments/${segmentId}_r${revision}.mp3`;
  await saveLocalFileToStorage(synced.adjustedPath, key, "audio/mpeg");

  return {
    audioKey: key,
    audioPath,
    adjustedPath: synced.adjustedPath,
    adjustedDuration: synced.adjustedDuration,
    timingStrategy: synced.strategy,
    wordTimestamps,
    ttsUsage,
    synced,
  };
}

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

    const {
      audioPath,
      wordTimestamps,
      usage: ttsUsage,
    } = await synthesizeDubbingTts(
      synthesizeProvider,
      row.text,
      voiceKey,
      targetLanguage,
    );
    if (ttsUsage && projectId) {
      await recordProjectUsage(projectId, ttsUsage);
    }
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
        await saveLocalFileToStorage(synced.adjustedPath, segKey, "audio/mpeg");
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

function buildSegmentsForDb({
  translatedSegments,
  segmentIds,
  parentSubSegments,
  parentSolo,
  segmentAudioKeys,
}) {
  return translatedSegments.map((ts, i) => {
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
}

async function rebuildSegmentAudioFromStoredKey({
  storageKey,
  downloadToTemp,
  start,
  end,
  syncOpts,
  tmpPaths,
}) {
  const localMp3Path = await downloadToTemp(storageKey);
  const originalDuration = Math.max(0.05, (end ?? 0) - (start ?? 0));
  const synced = await syncSegmentTiming(localMp3Path, originalDuration, syncOpts);
  tmpPaths.push(synced.adjustedPath);
  return {
    start,
    adjustedPath: synced.adjustedPath,
    adjustedDuration: synced.adjustedDuration,
  };
}

module.exports = {
  buildSegmentsForDb,
  getDubbingSegmentPipelineConcurrency,
  pipelineTtsSyncUploadForDubbing,
  rebuildSegmentAudioFromStoredKey,
  synthesizeDubbingTts,
  synthesizeSyncAndUploadSegment,
};
