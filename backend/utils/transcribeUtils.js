const fs = require("fs");
const path = require("path");
const os = require("os");
const { v4: uuidv4 } = require("uuid");
const { GoogleGenerativeAI, SchemaType } = require("@google/generative-ai");
const { GoogleAIFileManager, FileState } = require("@google/generative-ai/server");
const {
  getFileDuration,
  splitAudioIntoChunks,
  cleanupPath,
  detectLeadingSpeechOnsetSec,
} = require("./audioUtils");
const {
  isDubbingTimelineCalibrateEnabled,
  getDubbingTimelineSilenceNoiseDb,
  getDubbingTimelineSilenceMinSec,
  isDubbingSileroRefineAfterGeminiEnabled,
  getDubbingVadMinSpeechOverlap,
} = require("./dubbingConfig");
const { detectSileroVadTimeline, refineSegmentsWithVadTimeline } = require("./sileroVadUtils");
const { LANGUAGE_MAP } = require("./languageCatalog");

/** Gemini inline audio limit is ~20 MB; stay under to avoid forced upload. */
const INLINE_AUDIO_MAX_BYTES = 18 * 1024 * 1024;
const CHUNK_OVERLAP_SECONDS = 30;
/** Target max bytes per vocals chunk when splitting long files (below inline cap). */
const CHUNK_TARGET_BYTES = 15 * 1024 * 1024;

const NATIVE_SCRIPT_LANGS = new Set([
  "ar",
  "am",
  "hy",
  "az",
  "be",
  "bn",
  "bg",
  "my",
  "zh",
  "ka",
  "el",
  "gu",
  "he",
  "hi",
  "ja",
  "kn",
  "kk",
  "km",
  "ko",
  "lo",
  "mk",
  "ml",
  "mn",
  "mr",
  "ne",
  "or",
  "pa",
  "fa",
  "ps",
  "ru",
  "sa",
  "sr",
  "sd",
  "si",
  "ta",
  "te",
  "th",
  "bo",
  "uk",
  "ur",
  "uz",
  "yi",
]);

const ARABIC_SCRIPT_LANGS = new Set(["ar", "fa", "ps", "ur", "sd"]);
const DEVANAGARI_LANGS = new Set(["hi", "mr", "ne", "sa"]);
const CYRILLIC_LANGS = new Set(["ru", "uk", "be", "bg", "mk", "sr", "kk", "mn"]);

function resolveDubbingTranscribeLanguage(raw) {
  if (raw == null || String(raw).trim() === "" || String(raw).trim().toLowerCase() === "auto") {
    return { langKey: "auto", isoCode: null, isAuto: true };
  }
  const key = String(raw).trim().toLowerCase();
  if (!(key in LANGUAGE_MAP)) {
    throw new Error(
      `Unknown source language "${raw}" for dubbing transcription. ` +
        `Use a supported language name, ISO code, or "auto".`,
    );
  }
  return { langKey: key, isoCode: LANGUAGE_MAP[key], isAuto: false };
}

/**
 * Shared segment rules — same wording as the standalone Gemini transcribe script.
 * (For chunked dubbing, chunkHint clarifies that times are relative to the current clip.)
 */
const segmentRulesReference = `Segments:
- Many SHORT lines (about 2–6 seconds of speech each). Split at natural pauses, breaths, or speaker turns — NOT one long block for the whole utterance.
- start_us / end_us: microseconds from the start of this audio file (numeric). Estimate as well as you can; they will be approximate.
- If there is silence at the start of the audio, do not include this as a segment; the first segment's start_us and end_us should reflect when someone actually starts speaking.
- Do NOT omit the opening dialogue: the first transcript row must start at the first spoken words (after any leading silence), with captions for that speech — not a later fragment and not an impossibly short clip.
- Each segment time span must be long enough to contain the captions (avoid start_us almost equal to end_us unless the line is a single short word).
- **captions** = verbatim words heard only — no bracket tags, no stage directions.
- **tts_performance_hint** = REQUIRED on every row: a **Gemini Native Audio / controllable-TTS style** line for this clip. Rules: (1) Use the **exact same spoken words as captions**, same order — do not add, drop, or substitute words. (2) You may **only** insert **inline English** square-bracket **audio tags** between words/phrases where the performance calls for it (Google Gemini TTS style), e.g. [conversational], [excited], [pause], [short pause], [chuckle], [laughs], [whispers], [loud], [sarcastic], [breathless], [gasps], [sighs], [tired], [shouting], or combined like [loud, exaggerated]. (3) If captions are not English, still write **tags in English**; spoken words stay in captions' script/language. (4) For a neutral straight read, prefix once with something like [conversational] or [neutral] then the line; still add [pause] only where you clearly hear a beat or breath gap.
- **voice_description** = timbre/register (gender, age range, tone, pitch, pace, accent, energy). Keep delivery nuance in **tts_performance_hint** tags; here stay concise and consistent per speaker.

JSON schema:
- transcript: array in time order
- each: start_us, end_us, speaker ("Speaker A" / "Speaker B" if multiple), captions (exact wording as spoken), tts_performance_hint (same words as captions plus English [audio tags] only — see rules above), speaker_gender ("male", "female", or "unknown" — infer from voice characteristics; be consistent for the same speaker), voice_description (1-2 sentences: this speaker's voice traits for this segment — timbre, pitch, pace, accent, energy; be consistent for the same speaker across segments unless the voice clearly changes.)`;

/**
 * Core prompt for a known language — matches standalone script categories:
 * 1) hinglish (isoCode === null)  2) native script  3) Latin default
 */
function buildPromptReferenceCore(langKey, isoCode) {
  if (isoCode === null) {
    return `Listen to this audio carefully. Transcribe all speech.

Script (mandatory):
- Write Hindi/Urdu in ROMAN / LATIN script only (Hinglish), how people type on phones: e.g. "arey main bol raha hoon", "kya hua yaar".
- Do NOT use Devanagari (नागरी) or any other non-Latin script.
- English words (CNG, EV, battery, etc.) stay in normal English spelling.
- Mixed sentences are fine: preserve the exact code-switching as spoken.

${segmentRulesReference}`;
  }

  if (NATIVE_SCRIPT_LANGS.has(isoCode)) {
    let scriptNote;
    if (ARABIC_SCRIPT_LANGS.has(isoCode)) {
      scriptNote = `- Use the correct Arabic script. Do NOT romanize or transliterate.
- Loanwords widely written in Latin (e.g. "WiFi", "OK") may remain in Latin.`;
    } else if (DEVANAGARI_LANGS.has(isoCode)) {
      scriptNote = `- Use Devanagari script. Do NOT romanize.
- English loanwords (mobile, OK, percent, etc.) may remain in Latin as commonly written.`;
    } else if (CYRILLIC_LANGS.has(isoCode)) {
      scriptNote = `- Use Cyrillic script. Do NOT romanize.
- English/international loanwords may remain in Latin as commonly written.`;
    } else {
      scriptNote = `- Use the language's native script. Do NOT romanize or transliterate.
- English/international loanwords may remain in Latin as commonly written.`;
    }
    return `Listen to this audio carefully. Transcribe all speech in ${langKey} (ISO 639-1: ${isoCode}).

Script (mandatory):
${scriptNote}
- Transcribe exactly as spoken; do not paraphrase or translate.

${segmentRulesReference}`;
  }

  return `Listen to this audio carefully. Transcribe all speech in ${langKey} (ISO 639-1: ${isoCode}).

Script (mandatory):
- Transcribe exactly as spoken in ${langKey} using standard orthography.
- Keep proper nouns, brand names, and foreign loanwords as normally written in this language.
- Do not translate, paraphrase, or switch to another language.

${segmentRulesReference}`;
}

/** Same text the standalone transcribe script sends to Gemini (no dubbing-only JSON extras). */
function buildDubbingPrompt(langKey, isoCode, isAuto, chunkHint) {
  let core;
  if (isAuto) {
    core = `Listen to this audio carefully. Transcribe all speech.
Detect the language automatically. Use the appropriate script and orthography for what is spoken.
Do not translate or paraphrase.
Transcribe exactly as spoken.

Script (mandatory):
- Use the correct writing system for the detected language(s).
- English/international loanwords may remain in Latin when commonly written that way.
- Mixed code-switching: preserve as spoken.

${segmentRulesReference}`;
  } else {
    core = buildPromptReferenceCore(langKey, isoCode);
  }

  let out = core;
  if (chunkHint) {
    out += `\n\n${chunkHint}`;
  }
  return out;
}

/** Matches standalone script: transcript only (no speaker_profiles — those are synthesized for dubbing). */
const transcriptItemSchema = {
  type: SchemaType.OBJECT,
  properties: {
    start_us: {
      type: SchemaType.NUMBER,
      description: "Segment start time in microseconds from the beginning of the audio",
    },
    end_us: {
      type: SchemaType.NUMBER,
      description: "Segment end time in microseconds from the beginning of the audio",
    },
    speaker: { type: SchemaType.STRING },
    captions: { type: SchemaType.STRING },
    speaker_gender: {
      type: SchemaType.STRING,
      description: "Perceived gender of the speaker: \"male\", \"female\", or \"unknown\"",
    },
    voice_description: {
      type: SchemaType.STRING,
      description:
        "Rich 1-2 sentence description of this speaker's voice: gender, approximate age range, tone, pitch, pace, accent, and emotional energy. Be consistent for the same speaker.",
    },
    tts_performance_hint: {
      type: SchemaType.STRING,
      description:
        "Gemini TTS-style line: identical spoken words as captions in the same order, with inline English-only square-bracket audio tags for pauses, tone, and non-verbals (e.g. [pause], [chuckle], [excited]). Do not change wording vs captions.",
    },
  },
  required: [
    "start_us",
    "end_us",
    "speaker",
    "captions",
    "tts_performance_hint",
    "speaker_gender",
    "voice_description",
  ],
};

const transcriptResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    transcript: {
      type: SchemaType.ARRAY,
      items: transcriptItemSchema,
    },
  },
  required: ["transcript"],
};

function getGeminiApiKey() {
  const k = String(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "").trim();
  return k || null;
}

async function waitForFileActive(fileManager, fileName) {
  let file = await fileManager.getFile(fileName);
  while (file.state === FileState.PROCESSING) {
    await new Promise((r) => setTimeout(r, 2000));
    file = await fileManager.getFile(fileName);
  }
  if (file.state !== FileState.ACTIVE) {
    throw new Error(`Uploaded file is not usable (state: ${file.state})`);
  }
  return file;
}

function parseJsonFromModelText(text) {
  const trimmed = text.trim();
  const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  const jsonStr = fence ? fence[1] : trimmed;
  return JSON.parse(jsonStr);
}

async function buildGeminiMediaPart(fileManager, audioPath, mimeType) {
  const stat = fs.statSync(audioPath);
  if (stat.size <= INLINE_AUDIO_MAX_BYTES) {
    const base64Audio = fs.readFileSync(audioPath).toString("base64");
    return {
      mediaPart: { inlineData: { mimeType, data: base64Audio } },
      uploadName: null,
    };
  }
  const upload = await fileManager.uploadFile(audioPath, {
    mimeType,
    displayName: path.basename(audioPath),
  });
  const uploadName = upload.file.name;
  const file = await waitForFileActive(fileManager, uploadName);
  return {
    mediaPart: {
      fileData: { mimeType: file.mimeType, fileUri: file.uri },
    },
    uploadName,
  };
}

async function deleteUploadedFile(fileManager, uploadName) {
  if (!uploadName) return;
  try {
    await fileManager.deleteFile(uploadName);
  } catch {
    /* ignore */
  }
}

function normalizeSpeakerId(raw) {
  const s = String(raw || "").trim();
  const undersc = s.match(/^Speaker_(\d+)$/i);
  if (undersc) return `Speaker_${undersc[1]}`;
  const letter = s.match(/^Speaker\s+([A-Za-z])\b/);
  if (letter) {
    const n = letter[1].toUpperCase().charCodeAt(0) - 64;
    if (n >= 1 && n <= 26) return `Speaker_${n}`;
  }
  const digit = s.match(/(\d+)/);
  if (digit) return `Speaker_${digit[1]}`;
  return "Speaker_1";
}

/**
 * Gemini sometimes returns start_us/end_us in seconds or milliseconds instead
 * of microseconds.  Detect the unit by looking at the largest end_us value and
 * scale everything to true microseconds before conversion.
 *
 * Heuristics (assumes audio is > ~0.5 s long and has at least one segment):
 *   max_end >= 1 000 000  → already microseconds  (no change)
 *   max_end >=     1 000  → milliseconds           (× 1 000)
 *   max_end <      1 000  → seconds                (× 1 000 000)
 */
function normalizeRawTimestamps(transcript) {
  if (!transcript.length) return transcript;

  const maxEnd = Math.max(...transcript.map((r) => Number(r.end_us) || 0));

  let scale = 1; // assume microseconds
  let detectedUnit = "microseconds";

  if (maxEnd < 1_000) {
    // values look like plain seconds (e.g. 3.75 → should be 3,750,000 µs)
    scale = 1_000_000;
    detectedUnit = "seconds";
  } else if (maxEnd < 1_000_000) {
    // values look like milliseconds (e.g. 3750 → should be 3,750,000 µs)
    scale = 1_000;
    detectedUnit = "milliseconds";
  }

  if (scale !== 1) {
    console.warn(
      `[transcribe] ⚠️  Gemini returned timestamps in ${detectedUnit} (max end_us=${maxEnd}). ` +
        `Auto-scaling ×${scale} to convert to microseconds.`,
    );
    return transcript.map((r) => ({
      ...r,
      start_us: (Number(r.start_us) || 0) * scale,
      end_us: (Number(r.end_us) || 0) * scale,
    }));
  }

  return transcript;
}

function mapGeminiTranscriptToSegments(transcript, timeOffsetSec) {
  if (!Array.isArray(transcript)) return [];
  const normalized = normalizeRawTimestamps(transcript);
  const off = Number(timeOffsetSec) || 0;
  return normalized.map((row) => {
    const start_us = Number(row.start_us);
    const end_us = Number(row.end_us);
    const start = parseFloat(
      ((Number.isFinite(start_us) ? start_us : 0) / 1e6 + off).toFixed(3),
    );
    const end = parseFloat(((Number.isFinite(end_us) ? end_us : 0) / 1e6 + off).toFixed(3));
    const text = String(row.captions ?? row.text ?? "").trim();
    const rawHint = String(row.tts_performance_hint ?? row.ttsPerformanceHint ?? "").trim();
    const tts_performance_hint =
      rawHint ||
      (text ? `[conversational] ${text}` : "");
    const rawGender = String(row.speaker_gender ?? "").trim().toLowerCase();
    const speaker_gender = ["male", "female"].includes(rawGender) ? rawGender : "unknown";
    const voice_description = String(row.voice_description ?? "").trim();
    return {
      start,
      end,
      speaker_id: normalizeSpeakerId(row.speaker ?? row.speaker_id),
      text,
      tts_performance_hint,
      speaker_gender,
      voice_description,
      voice_profile_hint: "",
    };
  });
}

/** Dubbing still needs speaker_profiles; Gemini returns transcript-only like the standalone script. */
function buildSyntheticSpeakerProfiles(segments) {
  // Collect per-speaker: use the first non-empty voice_description Gemini produced.
  const seen = new Map();
  for (const s of segments) {
    const id = s.speaker_id;
    if (!seen.has(id)) {
      seen.set(id, {
        speaker_id: id,
        speaker_gender: s.speaker_gender ?? "unknown",
        voice_description: "",
      });
    }
    // Fill in the first meaningful description we encounter for this speaker.
    const entry = seen.get(id);
    if (!entry.voice_description && s.voice_description) {
      entry.voice_description = s.voice_description;
    }
  }
  // Build final profiles; fall back gracefully if Gemini gave nothing.
  return Array.from(seen.values()).map((p) => ({
    ...p,
    voice_description:
      p.voice_description ||
      (p.speaker_gender === "male"
        ? "Male speaker; natural conversational delivery."
        : p.speaker_gender === "female"
          ? "Female speaker; natural conversational delivery."
          : "Speaker; neutral delivery."),
  }));
}

const mergeSpeakerProfiles = (profileArrays) => {
  const seen = new Map();
  for (const profiles of profileArrays) {
    for (const p of profiles) {
      const id = normalizeSpeakerId(p.speaker_id ?? p.speaker);
      if (!seen.has(id)) {
        seen.set(id, {
          speaker_id: id,
          speaker_gender: p.speaker_gender ?? "unknown",
          voice_description: String(p.voice_description || "").trim() || "Unknown speaker; neutral delivery.",
        });
      }
    }
  }
  return Array.from(seen.values());
};

const deduplicateSegments = (segments) => {
  const result = [];
  for (const seg of segments) {
    const isDuplicate = result.some(
      (existing) =>
        Math.abs(existing.start - seg.start) < 1.0 &&
        existing.speaker_id === seg.speaker_id &&
        existing.text.trim() === seg.text.trim(),
    );
    if (!isDuplicate) result.push(seg);
  }
  return result.sort((a, b) => a.start - b.start);
};

const calibrateSegmentTimestampsWithVocals = (segments, vocalsPath) => {
  if (!isDubbingTimelineCalibrateEnabled() || !segments.length || !fs.existsSync(vocalsPath)) {
    return segments;
  }
  const noiseDb = getDubbingTimelineSilenceNoiseDb();
  const minSilenceSec = getDubbingTimelineSilenceMinSec();
  let onset;
  try {
    onset = detectLeadingSpeechOnsetSec(vocalsPath, { noiseDb, minSilenceSec });
  } catch (e) {
    console.warn("[transcribe] Timeline calibration: silencedetect failed:", e.message);
    return segments;
  }
  const sorted = [...segments].sort((a, b) => a.start - b.start);
  const firstStart = Number(sorted[0].start) || 0;
  const drift = onset - firstStart;
  const MIN_ONSET = 0.75;
  const MIN_DRIFT = 1.0;
  const MAX_SHIFT = 45;
  if (!(onset >= MIN_ONSET && drift >= MIN_DRIFT)) {
    console.log(
      `[transcribe] Timeline calibration skipped: vocalsOnset=${onset.toFixed(2)}s modelFirstStart=${firstStart.toFixed(2)}s drift=${drift.toFixed(2)}s (silence noise=${noiseDb}dB d=${minSilenceSec}s)`,
    );
    return segments;
  }
  const shift = Math.min(drift, MAX_SHIFT);
  console.log(
    `[transcribe] Timeline calibration applied: shift +${shift.toFixed(2)}s for ${segments.length} segments (silencedetect onset ${onset.toFixed(2)}s vs model ${firstStart.toFixed(2)}s)`,
  );
  return segments.map((s) => ({
    ...s,
    start: parseFloat((Number(s.start) + shift).toFixed(3)),
    end: parseFloat((Number(s.end) + shift).toFixed(3)),
  }));
};

const resolveDubbingVadIntervals = async (vocalsPath) => {
  if (!isDubbingSileroRefineAfterGeminiEnabled()) return null;
  const tmp = path.join(os.tmpdir(), `dub_vad_${uuidv4()}`);
  fs.mkdirSync(tmp, { recursive: true });
  try {
    const { intervals } = await detectSileroVadTimeline(vocalsPath, tmp);
    return Array.isArray(intervals) ? intervals : null;
  } catch (e) {
    console.warn("[transcribe] Dubbing Silero VAD failed (skipping refine):", e.message);
    return null;
  } finally {
    cleanupPath(tmp);
  }
};

const finalizeTranscription = (segmentList, profileArrays, vocalsPath, opts = {}) => {
  console.log(`[transcribe] finalizeTranscription called with: segmentList.length=${segmentList.length}, profileArrays.length=${profileArrays.length}, vocalsPath=${vocalsPath}, opts=${JSON.stringify(opts)}`);
  const profiles = mergeSpeakerProfiles(profileArrays);
  let segs = deduplicateSegments(segmentList);

  if (segs.length) {
    const a = segs[0];
    console.log(
      `[transcribe] Segments after dedupe: count=${segs.length} first=${a.start}s–${a.end}s (${String(a.text).slice(0, 48)}…)`
    );
  } else {
    console.log('[transcribe] No segments found after deduplication.');
  }

  segs = calibrateSegmentTimestampsWithVocals(segs, vocalsPath);

  if (segs.length) {
    const b = segs[0];
    console.log(`[transcribe] First segment after calibration: ${b.start}s–${b.end}s`);
  } else {
    console.log('[transcribe] No segments remain after calibration.');
  }

  const { vadIntervals } = opts;
  if (vadIntervals != null && Array.isArray(vadIntervals)) {
    console.log(`[transcribe] VAD intervals provided: vadIntervals.length=${vadIntervals.length}`);
    const before = segs.length;
    segs = refineSegmentsWithVadTimeline(segs, vadIntervals, {
      minOverlap: getDubbingVadMinSpeechOverlap(),
      preserveSegmentFields: true,
    });
    console.log(
      `[transcribe] Silero VAD refine: ${before} → ${segs.length} segments (dubbing overlap ≥ ${getDubbingVadMinSpeechOverlap()})`
    );
  } else {
    console.log("[transcribe] No VAD intervals provided or vadIntervals is not an array.");
  }

  console.log(`[transcribe] Final segments count: ${segs.length}, speaker_profiles count: ${Object.keys(profiles).length}`);
  return { segments: segs, speaker_profiles: profiles };
};

async function transcribeGeminiChunk(audioPath, langKey, isoCode, isAuto, isFirstChunk, chunkIndex, timeOffsetSec) {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error("Set GOOGLE_API_KEY (or GEMINI_API_KEY) for dubbing transcription.");
  }

  const modelName = "gemini-3.1-pro-preview";
  console.log(`[transcribeGeminiChunk] Using model: ${modelName}`);
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: transcriptResponseSchema,
    },
  });

  const mimeType = "audio/mpeg";
  let chunkHint = "";
  if (!isFirstChunk) {
    chunkHint =
      `This is continuation chunk index ${chunkIndex} of a longer recording. ` +
      `start_us/end_us are relative to THIS clip only (0 = first sample of this file). ` +
      `Keep the same speaker labels (e.g. Speaker A / Speaker B, or Speaker_1 / Speaker_2) for the same people as in earlier chunks.`;
  }

  const prompt = buildDubbingPrompt(langKey, isoCode, isAuto, chunkHint);
  const fileManager = new GoogleAIFileManager(apiKey);
  let uploadName = null;

  try {
    const stat = fs.statSync(audioPath);
    console.log(`[transcribeGeminiChunk] Audio file: ${audioPath} (${(stat.size / 1e6).toFixed(2)} MB)`);
    if (stat.size <= INLINE_AUDIO_MAX_BYTES) {
      console.log(`[transcribeGeminiChunk] Sending audio inline to ${modelName}`);
    } else {
      console.log(`[transcribeGeminiChunk] Uploading audio for ${modelName}`);
    }

    const { mediaPart, uploadName: up } = await buildGeminiMediaPart(fileManager, audioPath, mimeType);
    uploadName = up;

    console.log(`[transcribeGeminiChunk] Media part prepared, uploadName=${uploadName}`);
    console.log(`[transcribeGeminiChunk] Prompt: ${prompt.length > 1200 ? prompt.slice(0, 1200) + '…' : prompt}`);

    console.log("[transcribeGeminiChunk] Gemini transcribing…");
    const result = await model.generateContent([mediaPart, { text: prompt }]);
    const text = result.response.text();
    console.log(`[transcribeGeminiChunk] Gemini response received, length=${text.length}`);
    const parsed = parseJsonFromModelText(text);
    if (!Array.isArray(parsed.transcript)) {
      console.error("[transcribeGeminiChunk] Gemini response missing transcript array:", parsed);
      throw new Error("Gemini response missing transcript array");
    }
    const segments = mapGeminiTranscriptToSegments(parsed.transcript, timeOffsetSec);
    console.log(`[transcribeGeminiChunk] Segments mapped: count=${segments.length}, timeOffsetSec=${timeOffsetSec}`);
    const speaker_profiles = buildSyntheticSpeakerProfiles(segments);
    console.log(`[transcribeGeminiChunk] Speaker profiles built: count=${Object.keys(speaker_profiles).length}`);
    return { segments, speaker_profiles };
  } catch (err) {
    console.error("[transcribeGeminiChunk] Error during Gemini chunk transcription:", err);
    throw err;
  } finally {
    try {
      await deleteUploadedFile(fileManager, uploadName);
      console.log(`[transcribeGeminiChunk] Uploaded file cleaned up: ${uploadName}`);
    } catch (cleanupErr) {
      if (uploadName) {
        console.warn(`[transcribeGeminiChunk] Could not clean up uploaded file: ${uploadName}`, cleanupErr);
      }
    }
  }
}

const fileSize = (p) => fs.statSync(p).size;

const writeTranscriptionOutputJson = (payload) => {
  const outputPath = path.resolve(process.cwd(), "output.json");
  try {
    fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    console.log(`[transcribe] Wrote ${outputPath}`);
  } catch (e) {
    console.warn("[transcribe] Could not write output.json:", e.message);
  }
};

/**
 * Transcribe separated vocals with Gemini (vocals-only ASR).
 * @param {string} vocalsPath
 * @param {string|null|undefined} sourceLanguage
 */
const transcribeWithSpeakers = async (vocalsPath, sourceLanguage) => {
  const vadIntervals = await resolveDubbingVadIntervals(vocalsPath);
  const { langKey, isoCode, isAuto } = resolveDubbingTranscribeLanguage(sourceLanguage);

  const vocalsSize = fileSize(vocalsPath);
  const duration = await getFileDuration(vocalsPath);

  const runSingleShot = async () =>
    transcribeGeminiChunk(vocalsPath, langKey, isoCode, isAuto, true, 0, 0);

  let finalized;
  if (vocalsSize <= INLINE_AUDIO_MAX_BYTES) {
    const r = await runSingleShot();
    finalized = finalizeTranscription(r.segments, [r.speaker_profiles], vocalsPath, { vadIntervals });
    console.log("finalized", finalized);
    
  } else {
    const bytesPerSecond = vocalsSize / duration;
    const chunkSeconds = Math.max(30, Math.floor(CHUNK_TARGET_BYTES / bytesPerSecond));

    const chunkDir = path.join(os.tmpdir(), `dub_transcribe_${uuidv4()}`);
    fs.mkdirSync(chunkDir, { recursive: true });

    let chunkFiles;
    try {
      chunkFiles = await splitAudioIntoChunks(vocalsPath, chunkDir, chunkSeconds);
    } catch (err) {
      cleanupPath(chunkDir);
      throw err;
    }

    const allSegments = [];
    const allProfiles = [];
    let timeOffset = 0;

    for (let i = 0; i < chunkFiles.length; i++) {
      const chunkDuration = await getFileDuration(chunkFiles[i]);
      const result = await transcribeGeminiChunk(
        chunkFiles[i],
        langKey,
        isoCode,
        isAuto,
        i === 0,
        i,
        timeOffset,
      );
      allSegments.push(...result.segments);
      allProfiles.push(result.speaker_profiles);

      if (i < chunkFiles.length - 1) {
        timeOffset += Math.max(0, chunkDuration - CHUNK_OVERLAP_SECONDS);
      }
    }
    console.log("allSegments", allSegments);
    console.log("allProfiles", allProfiles);
    console.log("chunkDir", chunkDir);
    

    cleanupPath(chunkDir);

    finalized = finalizeTranscription(allSegments, allProfiles, vocalsPath, { vadIntervals });
  }

  // writeTranscriptionOutputJson({
  //   segments: finalized.segments,
  //   speaker_profiles: finalized.speaker_profiles,
  // });

  return finalized;
};

module.exports = { transcribeWithSpeakers };
