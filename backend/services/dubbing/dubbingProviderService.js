const DubbingJob = require("../../models/DubbingJob");
const {
  getTtsProvider,
  fetchAvailableVoices,
  selectBestVoice,
  selectBestOpenAIVoice,
} = require("../../utils/ttsUtils");
const {
  isInworldConfigured,
  fetchInworldVoiceCatalog,
  selectBestInworldVoice,
} = require("../../utils/inworldTtsUtils");
const {
  isSarvamConfigured,
  selectBestSarvamVoice,
  BCP_47_MAP,
} = require("../../utils/sarvamTtsUtils");
const {
  isSmallestConfigured,
  fetchSmallestVoiceCatalog,
  selectBestSmallestVoice,
} = require("../../utils/smallestTtsUtils");
const {
  isGeminiTtsConfigured,
  selectBestGeminiVoice,
} = require("../../utils/geminiTtsUtils");

const catalogCache = new Map();

function configError(message) {
  const err = new Error(message);
  err.statusCode = 422;
  return err;
}

function getCatalogCacheTtlMs() {
  const raw = Number(process.env.DUBBING_VOICE_CATALOG_CACHE_TTL_MS);
  if (!Number.isFinite(raw) || raw < 0) return 5 * 60 * 1000;
  return raw;
}

async function getCachedCatalog(cacheKey, loader) {
  const ttlMs = getCatalogCacheTtlMs();
  const now = Date.now();
  const cached = catalogCache.get(cacheKey);
  if (cached && cached.expiresAt > now) return cached.value;
  const value = await loader();
  if (ttlMs > 0) {
    catalogCache.set(cacheKey, { value, expiresAt: now + ttlMs });
  }
  return value;
}

function normalizeRequestedProvider(req, targetLanguage) {
  let ttsProvider = (req.body?.ttsProvider || getTtsProvider()).toLowerCase();
  const sarvamSupportedLanguages = Object.keys(BCP_47_MAP);
  if (
    sarvamSupportedLanguages.includes((targetLanguage || "").toLowerCase()) &&
    ttsProvider !== "gemini"
  ) {
    ttsProvider = "sarvam";
  }
  return ttsProvider;
}

function validateDubbingProviderConfig(ttsProvider, { requireTranscription = false } = {}) {
  if (
    ttsProvider === "elevenlabs" &&
    !String(process.env.ELEVENLABS_API_KEY || "").trim()
  ) {
    throw configError(
      "ELEVENLABS_API_KEY is required when DUBBING_TTS_PROVIDER=elevenlabs.",
    );
  }
  if (
    requireTranscription &&
    !String(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "").trim()
  ) {
    throw configError(
      "GOOGLE_API_KEY (or GEMINI_API_KEY) is required for dubbing transcription.",
    );
  }
  if (!String(process.env.OPENAI_API_KEY || "").trim()) {
    throw configError(
      requireTranscription
        ? "OPENAI_API_KEY is required for dubbing (translation and voice selection)."
        : "OPENAI_API_KEY is required for dubbing translation and voice selection.",
    );
  }
  if (ttsProvider === "inworld" && !isInworldConfigured()) {
    throw configError(
      "INWORLD_API_KEY is required when DUBBING_TTS_PROVIDER=inworld.",
    );
  }
  if (ttsProvider === "sarvam" && !isSarvamConfigured()) {
    throw configError(
      "SARVAM_API_KEY is required when DUBBING_TTS_PROVIDER=sarvam or for Indic languages.",
    );
  }
  if (ttsProvider === "smallest" && !isSmallestConfigured()) {
    throw configError(
      "SMALLEST_API_KEY is required when DUBBING_TTS_PROVIDER=smallest.",
    );
  }
  if (ttsProvider === "gemini" && !isGeminiTtsConfigured()) {
    throw configError(
      "GOOGLE_API_KEY or GEMINI_API_KEY is required when DUBBING_TTS_PROVIDER=gemini.",
    );
  }
}

function resolveDubbingTtsProvider(req, targetLanguage, opts = {}) {
  const ttsProvider = normalizeRequestedProvider(req, targetLanguage);
  validateDubbingProviderConfig(ttsProvider, opts);
  return ttsProvider;
}

function makeProfile(profile, voice) {
  return {
    speaker_id: profile.speaker_id,
    voice_description: profile.voice_description,
    elevenlabs_voice_id: voice,
  };
}

async function selectProviderVoices({
  ttsProvider,
  speakerProfiles,
  targetLanguage,
  emit = () => {},
}) {
  const speakerCount = speakerProfiles.length;
  let voiceMap = {};
  let updatedProfiles = [];

  const selectSequential = async ({ assigned, selectVoice }) => {
    for (const profile of speakerProfiles) {
      const voice = await selectVoice(profile, assigned);
      assigned.push(voice);
      voiceMap[profile.speaker_id] = voice;
      updatedProfiles.push(makeProfile(profile, voice));
    }
  };

  if (ttsProvider === "openai") {
    emit({ stage: "generating", message: "Selecting OpenAI TTS voices for speakers…" });
    await selectSequential({
      assigned: [],
      selectVoice: (profile, assigned) =>
        selectBestOpenAIVoice(profile.voice_description, {
          excludeVoiceIds: assigned,
          speakerCount,
        }),
    });
    return { resolvedProvider: "openai", voiceMap, updatedProfiles };
  }

  if (ttsProvider === "inworld") {
    emit({ stage: "generating", message: "Loading Inworld voice catalog…" });
    const catalog = await getCachedCatalog(
      `inworld:${targetLanguage || ""}`,
      () => fetchInworldVoiceCatalog(targetLanguage),
    );
    emit({ stage: "generating", message: "Selecting Inworld TTS voices for speakers…" });
    await selectSequential({
      assigned: [],
      selectVoice: (profile, assigned) =>
        selectBestInworldVoice(profile.voice_description, catalog, {
          excludeVoiceIds: assigned,
          speakerCount,
        }),
    });
    return { resolvedProvider: "inworld", voiceMap, updatedProfiles };
  }

  if (ttsProvider === "smallest") {
    emit({ stage: "generating", message: "Loading Smallest.ai Waves voice catalog…" });
    const catalog = await getCachedCatalog("smallest", fetchSmallestVoiceCatalog);
    emit({ stage: "generating", message: "Selecting Smallest TTS voices for speakers…" });
    await selectSequential({
      assigned: [],
      selectVoice: (profile, assigned) =>
        selectBestSmallestVoice(profile.voice_description, catalog, {
          excludeVoiceIds: assigned,
          speakerCount,
        }),
    });
    return { resolvedProvider: "smallest", voiceMap, updatedProfiles };
  }

  if (ttsProvider === "sarvam") {
    emit({ stage: "generating", message: "Selecting Sarvam TTS voices for speakers…" });
    await selectSequential({
      assigned: [],
      selectVoice: (profile, assigned) =>
        selectBestSarvamVoice(profile.voice_description, {
          excludeVoiceIds: assigned,
          speakerCount,
          targetLanguage,
        }),
    });
    return { resolvedProvider: "sarvam", voiceMap, updatedProfiles };
  }

  if (ttsProvider === "gemini") {
    emit({ stage: "generating", message: "Selecting Gemini TTS voices for speakers…" });
    await selectSequential({
      assigned: [],
      selectVoice: (profile, assigned) =>
        selectBestGeminiVoice(profile.voice_description, {
          excludeVoiceIds: assigned,
          speakerCount,
        }),
    });
    return { resolvedProvider: "gemini", voiceMap, updatedProfiles };
  }

  if (ttsProvider === "elevenlabs") {
    emit({ stage: "generating", message: "Selecting ElevenLabs TTS voices for speakers…" });
    const availableVoices = await getCachedCatalog("elevenlabs", fetchAvailableVoices);
    await selectSequential({
      assigned: [],
      selectVoice: (profile, assigned) =>
        selectBestVoice(profile.voice_description, availableVoices, {
          excludeVoiceIds: assigned,
        }),
    });
    return { resolvedProvider: "elevenlabs", voiceMap, updatedProfiles };
  }

  return selectProviderVoices({
    ttsProvider: "openai",
    speakerProfiles,
    targetLanguage,
    emit,
  });
}

async function selectAndPersistVoices({
  job,
  ttsProvider,
  speakerProfiles,
  targetLanguage,
  emit,
}) {
  const selected = await selectProviderVoices({
    ttsProvider,
    speakerProfiles,
    targetLanguage,
    emit,
  });
  await DubbingJob.findByIdAndUpdate(job._id, {
    speakerProfiles: selected.updatedProfiles,
    ttsProvider: selected.resolvedProvider,
  });
  return selected;
}

module.exports = {
  getCachedCatalog,
  resolveDubbingTtsProvider,
  selectAndPersistVoices,
  selectProviderVoices,
  validateDubbingProviderConfig,
};
