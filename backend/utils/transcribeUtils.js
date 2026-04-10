const fs = require("fs");
const path = require("path");
const os = require("os");
const { v4: uuidv4 } = require("uuid");
const OpenAI = require("openai");
const {
  getFileDuration,
  splitAudioIntoChunks,
  cleanupPath,
  extractAudioWindow,
  detectLeadingSpeechOnsetSec,
} = require("./audioUtils");
const {
  isTriStemTranscribeEnabled,
  isDubbingTimelineCalibrateEnabled,
  getDubbingTimelineSilenceNoiseDb,
  getDubbingTimelineSilenceMinSec,
  isDubbingSileroVadEnabled,
  getDubbingVadMinSpeechOverlap,
} = require("./dubbingConfig");
const { detectSileroVadTimeline, refineSegmentsWithVadTimeline } = require("./sileroVadUtils");

let _openai = null;
const getOpenAI = () => {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
};

const TRANSCRIPTION_MODEL = "gpt-4o-audio-preview";
const GPT_AUDIO_MAX_BYTES = 19 * 1024 * 1024;
const CHUNK_OVERLAP_SECONDS = 30;

const buildVocalsOnlyMessages = (audioBase64, sourceLanguage, isFirstChunk, chunkIndex) => {
  const langHint = sourceLanguage
    ? `The audio is in ${sourceLanguage}.`
    : "Detect the language automatically.";

  const speakerNote = isFirstChunk
    ? "Identify and label each speaker as Speaker_1, Speaker_2, etc., starting from Speaker_1."
    : `Continue speaker labels from previous chunks (Speaker_1, Speaker_2, etc., chunk index ${chunkIndex}).`;

  return [
    {
      role: "system",
      content: `You are a professional transcription and speaker diarization assistant. ${langHint}

Your tasks:
1. Transcribe every spoken word accurately.
2. ${speakerNote}
3. Provide start/end timestamps in seconds (as decimals) for every segment. **0.0s is the very first instant of this audio file** — count silence, intro music, and non-speech exactly as they occur. If the first spoken words begin after a gap, the first segment's "start" must be that real time (e.g. 4.8), not 0.0.
4. For EACH unique speaker, write a detailed voice profile (only once, in "speaker_profiles").

Voice profile must include: gender, estimated age range, tone (warm/cold/neutral), pace (slow/fast/moderate), accent or regional variety, emotional quality (energetic/calm/authoritative/friendly), and any distinctive vocal characteristics (deep, breathy, nasal, etc.).

Return ONLY valid JSON with this exact structure — no markdown, no extra text:
{
  "segments": [
    { "start": 2.1, "end": 5.6, "speaker_id": "Speaker_1", "text": "Hello, welcome to the show.", "delivery_notes": "" }
  ],
  "speaker_profiles": [
    {
      "speaker_id": "Speaker_1",
      "voice_description": "Male, late 30s, warm baritone, moderate pace, American accent with slight Southern drawl, authoritative yet friendly tone."
    }
  ]
}

Rules:
- Output ONLY the JSON object. Do NOT wrap it in markdown code fences.
- Timestamps must be accurate to within 0.5 seconds.
- If speech overlaps, split at the natural boundary and assign to the dominant speaker.
- Preserve filler words (um, uh, like) as they affect voice authenticity.
- delivery_notes: optional short phrase for non-verbal delivery (laugh, whisper, sigh) inferred from audio — empty string if none.`,
    },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: "Please transcribe this audio with speaker diarization and voice profiles:",
        },
        {
          type: "input_audio",
          input_audio: {
            data: audioBase64,
            format: "mp3",
          },
        },
      ],
    },
  ];
};

const buildTriStemMessages = (b64Full, b64Vocals, b64Bg, sourceLanguage, isFirstChunk, chunkIndex) => {
  const langHint = sourceLanguage
    ? `The audio is in ${sourceLanguage}.`
    : "Detect the language automatically.";

  const speakerNote = isFirstChunk
    ? "Identify and label each speaker as Speaker_1, Speaker_2, etc., starting from Speaker_1."
    : `Continue speaker labels from previous chunks (Speaker_1, Speaker_2, etc., chunk index ${chunkIndex}).`;

  return [
    {
      role: "system",
      content: `You are a professional transcription and speaker diarization assistant. ${langHint}

You will receive THREE audio clips of the SAME time range in order:
(1) FULL MIX — dialogue plus music and sound effects as the listener hears it.
(2) ISOLATED VOCALS — speech stem with background reduced.
(3) BACKGROUND STEM — music/SFX and residual; use this to avoid tagging crowd noise or music hits as spoken dialogue.

Tasks:
1. Transcribe spoken words primarily from ISOLATED VOCALS (clip 2). Use FULL MIX (clip 1) to judge laughs, breaths, emotion, and non-verbals. Use BACKGROUND (clip 3) only to disambiguate: do NOT invent dialogue from music alone.
2. ${speakerNote}
3. Timestamps in seconds from the **start of these clips** (0 = first sample of this chunk). Include leading silence or music-only time: if speech begins later in the chunk, first segment "start" must match that moment, not 0.
4. speaker_profiles once per speaker as before.

Return ONLY valid JSON — no markdown:
{
  "segments": [
    { "start": 1.2, "end": 3.8, "speaker_id": "Speaker_1", "text": "Hello.", "delivery_notes": "light chuckle after hello" }
  ],
  "speaker_profiles": [ { "speaker_id": "Speaker_1", "voice_description": "..." } ]
}

Rules:
- delivery_notes: optional; short hints for TTS (laugh, whisper, breath) when supported by comparing full mix vs vocals. Empty string if none.
- Timestamps within 0.5s. Preserve fillers. No markdown fences.`,
    },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: "Three aligned audio clips follow in order: (1) full mix (2) isolated vocals (3) background.",
        },
        { type: "input_audio", input_audio: { data: b64Full, format: "mp3" } },
        { type: "input_audio", input_audio: { data: b64Vocals, format: "mp3" } },
        { type: "input_audio", input_audio: { data: b64Bg, format: "mp3" } },
      ],
    },
  ];
};

const parseGptResponse = (content) => {
  let text = content.trim();
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  return JSON.parse(text);
};

const mergeSpeakerProfiles = (profileArrays) => {
  const seen = new Map();
  for (const profiles of profileArrays) {
    for (const p of profiles) {
      if (!seen.has(p.speaker_id)) {
        seen.set(p.speaker_id, p);
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
        existing.text.trim() === seg.text.trim()
    );
    if (!isDuplicate) result.push(seg);
  }
  return result.sort((a, b) => a.start - b.start);
};

const mapSegments = (parsed, timeOffset) =>
  (parsed.segments || []).map((s) => {
    const notes = String(s.delivery_notes || s.deliveryNotes || "").trim();
    const hint = notes ? `delivery:${notes}` : "";
    return {
      start: parseFloat((Number(s.start) + timeOffset).toFixed(3)),
      end: parseFloat((Number(s.end) + timeOffset).toFixed(3)),
      speaker_id: s.speaker_id || "Speaker_1",
      text: (s.text || "").trim(),
      voice_profile_hint: hint,
    };
  });

/**
 * GPT-audio often puts the first line at ~0s even when the file has intro silence/music.
 * If silencedetect on the vocals stem finds speech starting later, shift all segments.
 */
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
      `[transcribe] Timeline calibration skipped: vocalsOnset=${onset.toFixed(2)}s modelFirstStart=${firstStart.toFixed(2)}s drift=${drift.toFixed(2)}s (silence noise=${noiseDb}dB d=${minSilenceSec}s)`
    );
    return segments;
  }
  const shift = Math.min(drift, MAX_SHIFT);
  console.log(
    `[transcribe] Timeline calibration applied: shift +${shift.toFixed(2)}s for ${segments.length} segments (silencedetect onset ${onset.toFixed(2)}s vs model ${firstStart.toFixed(2)}s)`
  );
  return segments.map((s) => ({
    ...s,
    start: parseFloat((Number(s.start) + shift).toFixed(3)),
    end: parseFloat((Number(s.end) + shift).toFixed(3)),
  }));
};

const resolveDubbingVadIntervals = async (vocalsPath) => {
  if (!isDubbingSileroVadEnabled()) return null;
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
  const profiles = mergeSpeakerProfiles(profileArrays);
  let segs = deduplicateSegments(segmentList);
  if (segs.length) {
    const a = segs[0];
    console.log(
      `[transcribe] Segments after dedupe: count=${segs.length} first=${a.start}s–${a.end}s (${String(a.text).slice(0, 48)}…)`
    );
  }
  segs = calibrateSegmentTimestampsWithVocals(segs, vocalsPath);
  if (segs.length) {
    const b = segs[0];
    console.log(`[transcribe] First segment after calibration: ${b.start}s–${b.end}s`);
  }

  const { vadIntervals } = opts;
  if (vadIntervals != null && Array.isArray(vadIntervals)) {
    const before = segs.length;
    segs = refineSegmentsWithVadTimeline(segs, vadIntervals, {
      minOverlap: getDubbingVadMinSpeechOverlap(),
      preserveSegmentFields: true,
    });
    console.log(
      `[transcribe] Silero VAD refine: ${before} → ${segs.length} segments (dubbing overlap ≥ ${getDubbingVadMinSpeechOverlap()})`
    );
  }

  return { segments: segs, speaker_profiles: profiles };
};

const callTranscription = async (messages) => {
  const response = await getOpenAI().chat.completions.create({
    model: TRANSCRIPTION_MODEL,
    temperature: 0,
    modalities: ["text"],
    messages,
  });
  return parseGptResponse(response.choices[0].message.content);
};

const transcribeChunkVocalsOnly = async (chunkPath, sourceLanguage, isFirstChunk, chunkIndex, timeOffset) => {
  const audioBuffer = fs.readFileSync(chunkPath);
  const messages = buildVocalsOnlyMessages(
    audioBuffer.toString("base64"),
    sourceLanguage,
    isFirstChunk,
    chunkIndex
  );
  const parsed = await callTranscription(messages);
  return {
    segments: mapSegments(parsed, timeOffset),
    speaker_profiles: parsed.speaker_profiles || [],
  };
};

const transcribeChunkTriStem = async (
  fullSlicePath,
  vocalsSlicePath,
  bgSlicePath,
  sourceLanguage,
  isFirstChunk,
  chunkIndex,
  timeOffset
) => {
  const b64Full = fs.readFileSync(fullSlicePath).toString("base64");
  const b64Vocals = fs.readFileSync(vocalsSlicePath).toString("base64");
  const b64Bg = fs.readFileSync(bgSlicePath).toString("base64");
  const messages = buildTriStemMessages(
    b64Full,
    b64Vocals,
    b64Bg,
    sourceLanguage,
    isFirstChunk,
    chunkIndex
  );
  const parsed = await callTranscription(messages);
  return {
    segments: mapSegments(parsed, timeOffset),
    speaker_profiles: parsed.speaker_profiles || [],
  };
};

const fileSize = (p) => fs.statSync(p).size;

/**
 * @param {string} vocalsPath
 * @param {string} [sourceLanguage]
 * @param {{ fullMixPath?: string, backgroundPath?: string } | null} stemPaths - aligned timeline mp3s
 */
const transcribeWithSpeakers = async (vocalsPath, sourceLanguage, stemPaths = null) => {
  const vadIntervals = await resolveDubbingVadIntervals(vocalsPath);

  const useTriStem =
    stemPaths &&
    stemPaths.fullMixPath &&
    stemPaths.backgroundPath &&
    isTriStemTranscribeEnabled() &&
    fs.existsSync(stemPaths.fullMixPath) &&
    fs.existsSync(stemPaths.backgroundPath);

  const vocalsSize = fileSize(vocalsPath);
  const duration = await getFileDuration(vocalsPath);

  const runSingleShot = async () => {
    if (useTriStem) {
      const total =
        fileSize(stemPaths.fullMixPath) + vocalsSize + fileSize(stemPaths.backgroundPath);
      if (total <= GPT_AUDIO_MAX_BYTES) {
        try {
          return await transcribeChunkTriStem(
            stemPaths.fullMixPath,
            vocalsPath,
            stemPaths.backgroundPath,
            sourceLanguage,
            true,
            0,
            0
          );
        } catch (e) {
          console.warn(
            "[transcribe] Tri-stem single-shot failed, falling back to vocals:",
            e.message || e
          );
        }
      }
    }
    return transcribeChunkVocalsOnly(vocalsPath, sourceLanguage, true, 0, 0);
  };

  if (vocalsSize <= GPT_AUDIO_MAX_BYTES && !(useTriStem && fileSize(stemPaths.fullMixPath) + vocalsSize + fileSize(stemPaths.backgroundPath) > GPT_AUDIO_MAX_BYTES)) {
    const r = await runSingleShot();
    return finalizeTranscription(r.segments, [r.speaker_profiles], vocalsPath, { vadIntervals });
  }

  const bytesPerSecond = vocalsSize / duration;
  const targetChunkBytes = useTriStem ? Math.floor(GPT_AUDIO_MAX_BYTES / 3.2) : 15 * 1024 * 1024;
  const chunkSeconds = Math.max(30, Math.floor(targetChunkBytes / bytesPerSecond));

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
    let result;

    if (useTriStem) {
      const fullSlice = path.join(chunkDir, `full_${i}.mp3`);
      const bgSlice = path.join(chunkDir, `bg_${i}.mp3`);
      try {
        await extractAudioWindow(stemPaths.fullMixPath, fullSlice, timeOffset, chunkDuration);
        await extractAudioWindow(stemPaths.backgroundPath, bgSlice, timeOffset, chunkDuration);
        const triTotal = fileSize(fullSlice) + fileSize(chunkFiles[i]) + fileSize(bgSlice);
        if (triTotal <= GPT_AUDIO_MAX_BYTES) {
          result = await transcribeChunkTriStem(
            fullSlice,
            chunkFiles[i],
            bgSlice,
            sourceLanguage,
            i === 0,
            i,
            timeOffset
          );
        } else {
          result = await transcribeChunkVocalsOnly(
            chunkFiles[i],
            sourceLanguage,
            i === 0,
            i,
            timeOffset
          );
        }
        cleanupPath(fullSlice);
        cleanupPath(bgSlice);
      } catch (e) {
        console.warn("[transcribe] Tri-stem chunk failed, vocals only:", e.message);
        result = await transcribeChunkVocalsOnly(
          chunkFiles[i],
          sourceLanguage,
          i === 0,
          i,
          timeOffset
        );
      }
    } else {
      result = await transcribeChunkVocalsOnly(
        chunkFiles[i],
        sourceLanguage,
        i === 0,
        i,
        timeOffset
      );
    }

    allSegments.push(...result.segments);
    allProfiles.push(result.speaker_profiles);

    if (i < chunkFiles.length - 1) {
      timeOffset += Math.max(0, chunkDuration - CHUNK_OVERLAP_SECONDS);
    }
  }

  cleanupPath(chunkDir);

  return finalizeTranscription(allSegments, allProfiles, vocalsPath, { vadIntervals });
};

module.exports = { transcribeWithSpeakers };
