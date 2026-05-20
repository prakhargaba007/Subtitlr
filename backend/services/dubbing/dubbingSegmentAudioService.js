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

const ACTIVE_DUBBING_STATUSES = [
  "pending",
  "extracting",
  "separating",
  "transcribing",
  "translating",
  "generating",
  "syncing",
  "merging",
];

const MIN_PIPELINE_CONCURRENCY = 1;
const MAX_PIPELINE_CONCURRENCY = 8;

function clampInt(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function envInt(key, fallback, min = MIN_PIPELINE_CONCURRENCY, max = MAX_PIPELINE_CONCURRENCY) {
  const raw = String(process.env[key] || "").trim();
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return clampInt(n, min, max);
}

function envFlag(key, fallback = true) {
  const raw = String(process.env[key] || "").trim().toLowerCase();
  if (!raw) return fallback;
  if (["0", "false", "no", "off"].includes(raw)) return false;
  if (["1", "true", "yes", "on"].includes(raw)) return true;
  return fallback;
}

async function synthesizeDubbingTts(
  ttsProviderResolved,
  text,
  voiceKey,
  targetLanguage,
  options = {},
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
    const o = await synthesizeSarvamTts(plain, voiceKey, targetLanguage, {
      concurrencyLimit: options.sarvamConcurrencyLimit,
    });
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
  return envInt("DUBBING_SEGMENT_PIPELINE_CONCURRENCY", 3);
}

function getSarvamCapacityPolicy() {
  const maxConcurrency = envInt(
    "DUBBING_SEGMENT_PIPELINE_MAX_CONCURRENCY",
    MAX_PIPELINE_CONCURRENCY,
  );
  const clampedMax = clampInt(maxConcurrency, MIN_PIPELINE_CONCURRENCY, MAX_PIPELINE_CONCURRENCY);

  return {
    provider: "sarvam",
    rpmLimit: envInt("SARVAM_TTS_RPM_LIMIT", 60, 1, Number.MAX_SAFE_INTEGER),
    burstLimit: envInt("SARVAM_TTS_BURST_LIMIT", 6),
    maxInFlight: envInt("SARVAM_TTS_CONCURRENCY_LIMIT", 6),
    minConcurrency: MIN_PIPELINE_CONCURRENCY,
    maxConcurrency: clampedMax,
    tiers: [
      {
        name: "single_active_user",
        activeUsersMax: 1,
        segmentConcurrency: envInt("SARVAM_TTS_SINGLE_USER_SEGMENT_CONCURRENCY", 8),
        sarvamInFlight: envInt("SARVAM_TTS_SINGLE_USER_CONCURRENCY", 6),
      },
      {
        name: "multi_active_user",
        activeUsersMin: 2,
        segmentConcurrency: envInt("SARVAM_TTS_MULTI_USER_SEGMENT_CONCURRENCY", 3),
        sarvamInFlight: envInt("SARVAM_TTS_MULTI_USER_CONCURRENCY", 2),
      },
    ],
  };
}

async function countActiveDubbingUsers() {
  const users = await DubbingJob.distinct("user", {
    status: { $in: ACTIVE_DUBBING_STATUSES },
  });
  return users.length;
}

async function getAdaptiveDubbingSegmentPipelineConcurrency({
  jobMongoId,
  provider,
} = {}) {
  const baseline = getDubbingSegmentPipelineConcurrency();
  const maxConcurrency = envInt(
    "DUBBING_SEGMENT_PIPELINE_MAX_CONCURRENCY",
    MAX_PIPELINE_CONCURRENCY,
  );
  const adaptiveEnabled = envFlag("DUBBING_SEGMENT_PIPELINE_ADAPTIVE", true);
  const loadStrategy = String(
    process.env.DUBBING_SEGMENT_PIPELINE_LOAD_STRATEGY || "active_users",
  ).trim();

  if (!adaptiveEnabled || loadStrategy !== "active_users") {
    return {
      limit: clampInt(baseline, MIN_PIPELINE_CONCURRENCY, maxConcurrency),
      activeUsersCount: null,
      reason: adaptiveEnabled ? "unsupported_load_strategy" : "adaptive_disabled",
      sarvamConcurrencyLimit: null,
    };
  }

  let activeUsersCount;
  try {
    activeUsersCount = await countActiveDubbingUsers();
  } catch (err) {
    console.warn(
      "[dubbing] Active user lookup failed; using busy concurrency tier:",
      err.message,
    );
    activeUsersCount = 2;
  }

  const isSarvam = String(provider || "").toLowerCase() === "sarvam";
  if (isSarvam) {
    const policy = getSarvamCapacityPolicy();
    const tier =
      activeUsersCount <= 1 ? policy.tiers[0] : policy.tiers[1];
    const segmentConcurrency = clampInt(
      Math.min(tier.segmentConcurrency, policy.maxConcurrency),
      policy.minConcurrency,
      policy.maxConcurrency,
    );
    const sarvamConcurrencyLimit = clampInt(
      Math.min(tier.sarvamInFlight, policy.maxInFlight),
      policy.minConcurrency,
      policy.maxConcurrency,
    );

    return {
      limit: segmentConcurrency,
      activeUsersCount,
      reason: tier.name,
      sarvamConcurrencyLimit,
    };
  }

  const idle = envInt("DUBBING_SEGMENT_PIPELINE_IDLE_CONCURRENCY", 8);
  const busy = envInt("DUBBING_SEGMENT_PIPELINE_BUSY_CONCURRENCY", baseline);
  const reason = activeUsersCount <= 1 ? "single_active_user" : "multi_active_user";
  const selected = activeUsersCount <= 1 ? idle : busy;

  return {
    limit: clampInt(selected, MIN_PIPELINE_CONCURRENCY, maxConcurrency),
    activeUsersCount,
    reason,
    sarvamConcurrencyLimit: null,
  };
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
  sarvamConcurrencyLimit,
}) {
  const {
    audioPath,
    wordTimestamps,
    usage: ttsUsage,
  } = await synthesizeDubbingTts(provider, text, voiceKey, targetLanguage, {
    sarvamConcurrencyLimit,
  });
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
    audioStretch: synced.audioStretch,
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

  const concurrency = await getAdaptiveDubbingSegmentPipelineConcurrency({
    jobMongoId,
    provider: synthesizeProvider,
  });
  const limit = concurrency.limit;
  console.log("[dubbing] Segment pipeline concurrency", {
    provider: synthesizeProvider,
    segmentCount: n,
    activeUsersCount: concurrency.activeUsersCount,
    selectedConcurrency: limit,
    sarvamConcurrencyLimit: concurrency.sarvamConcurrencyLimit,
    reason: concurrency.reason,
  });
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
      {
        sarvamConcurrencyLimit: concurrency.sarvamConcurrencyLimit,
      },
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
      audioStretch: subs.length ? undefined : solo?.audioStretch,
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
    audioStretch: synced.audioStretch,
  };
}

module.exports = {
  buildSegmentsForDb,
  getAdaptiveDubbingSegmentPipelineConcurrency,
  getDubbingSegmentPipelineConcurrency,
  pipelineTtsSyncUploadForDubbing,
  rebuildSegmentAudioFromStoredKey,
  synthesizeDubbingTts,
  synthesizeSyncAndUploadSegment,
};
