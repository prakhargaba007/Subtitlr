const fs = require("fs");
const path = require("path");
const os = require("os");
const { v4: uuidv4 } = require("uuid");
const OpenAI = require("openai");
const { getFileDuration, splitAudioIntoChunks, cleanupPath } = require("./audioUtils");

let _openai = null;
const getOpenAI = () => {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
};

// gpt-4o-audio-preview is the only OpenAI model that accepts input_audio content blocks.
// gpt-4o-mini does NOT support audio input — it only accepts text and image_url.
const TRANSCRIPTION_MODEL = "gpt-4o-audio-preview";

// Audio input limit per message for the audio-preview model (~20 MB)
const GPT_AUDIO_MAX_BYTES = 19 * 1024 * 1024;

// Overlap between chunks in seconds to preserve speaker context across boundaries
const CHUNK_OVERLAP_SECONDS = 30;

/**
 * Build the gpt-4o-audio-preview prompt for speaker-aware transcription.
 *
 * Important format rules for gpt-4o-audio-preview:
 *  - system message content must be a plain string (NOT an array of content blocks)
 *  - user message content can mix text + input_audio blocks
 *  - response_format: json_object is NOT supported — rely on the prompt for JSON output
 */
const buildTranscriptionMessages = (audioBase64, sourceLanguage, isFirstChunk, chunkIndex) => {
  const langHint = sourceLanguage
    ? `The audio is in ${sourceLanguage}.`
    : "Detect the language automatically.";

  const speakerNote = isFirstChunk
    ? "Identify and label each speaker as Speaker_1, Speaker_2, etc., starting from Speaker_1."
    : `Continue speaker labels from previous chunks (Speaker_1, Speaker_2, etc., chunk index ${chunkIndex}).`;

  return [
    {
      role: "system",
      // Plain string — audio-preview model does not accept content-block arrays in system messages
      content: `You are a professional transcription and speaker diarization assistant. ${langHint}

Your tasks:
1. Transcribe every spoken word accurately.
2. ${speakerNote}
3. Provide start/end timestamps in seconds (as decimals) for every segment.
4. For EACH unique speaker, write a detailed voice profile (only once, in "speaker_profiles").

Voice profile must include: gender, estimated age range, tone (warm/cold/neutral), pace (slow/fast/moderate), accent or regional variety, emotional quality (energetic/calm/authoritative/friendly), and any distinctive vocal characteristics (deep, breathy, nasal, etc.).

Return ONLY valid JSON with this exact structure — no markdown, no extra text:
{
  "segments": [
    { "start": 0.0, "end": 3.5, "speaker_id": "Speaker_1", "text": "Hello, welcome to the show." }
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
- Preserve filler words (um, uh, like) as they affect voice authenticity.`,
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

/**
 * Parse GPT response JSON, with fallback for markdown-wrapped JSON.
 */
const parseGptResponse = (content) => {
  let text = content.trim();
  // Strip markdown code fences if present
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  return JSON.parse(text);
};

/**
 * Merge speaker profiles from multiple chunks, keeping the first description
 * seen for each speaker_id (most detailed, from the first occurrence).
 */
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

/**
 * Remove duplicate segments that appear in the overlap zone between chunks.
 * Keeps the segment from the earlier chunk if timestamps conflict.
 */
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

/**
 * Transcribe a single audio file chunk with gpt-4o-audio-preview.
 * Returns { segments, speaker_profiles }
 */
const transcribeChunk = async (chunkPath, sourceLanguage, isFirstChunk, chunkIndex, timeOffset) => {
  const audioBuffer = fs.readFileSync(chunkPath);
  const audioBase64 = audioBuffer.toString("base64");

  const messages = buildTranscriptionMessages(audioBase64, sourceLanguage, isFirstChunk, chunkIndex);

  const response = await getOpenAI().chat.completions.create({
    model: TRANSCRIPTION_MODEL,
    temperature: 0,
    // response_format is NOT supported by gpt-4o-audio-preview — prompt enforces JSON output
    modalities: ["text"],
    messages,
  });

  const parsed = parseGptResponse(response.choices[0].message.content);

  // Shift timestamps by the chunk's time offset in the full audio
  const segments = (parsed.segments || []).map((s) => ({
    start: parseFloat((s.start + timeOffset).toFixed(3)),
    end: parseFloat((s.end + timeOffset).toFixed(3)),
    speaker_id: s.speaker_id || "Speaker_1",
    text: (s.text || "").trim(),
  }));

  return {
    segments,
    speaker_profiles: parsed.speaker_profiles || [],
  };
};

/**
 * Main export: transcribe audio with speaker diarization using gpt-4o-audio-preview.
 * (gpt-4o-mini does not support audio input — only gpt-4o-audio-preview does.)
 *
 * @param {string} audioPath - Absolute path to an mp3 audio file
 * @param {string} [sourceLanguage] - Optional language hint (e.g. "english", "hindi")
 * @returns {Promise<{
 *   segments: Array<{start:number, end:number, speaker_id:string, text:string}>,
 *   speaker_profiles: Array<{speaker_id:string, voice_description:string}>
 * }>}
 */
const transcribeWithSpeakers = async (audioPath, sourceLanguage) => {
  const audioSize = fs.statSync(audioPath).size;
  const duration = await getFileDuration(audioPath);

  // Small file: send in one shot
  if (audioSize <= GPT_AUDIO_MAX_BYTES) {
    const result = await transcribeChunk(audioPath, sourceLanguage, true, 0, 0);
    return result;
  }

  // Large file: split into chunks with overlap
  const bytesPerSecond = audioSize / duration;
  // Target ~15 MB per chunk to stay comfortably under the limit
  const targetChunkBytes = 15 * 1024 * 1024;
  const chunkSeconds = Math.floor(targetChunkBytes / bytesPerSecond);

  const chunkDir = path.join(os.tmpdir(), `dub_transcribe_${uuidv4()}`);
  fs.mkdirSync(chunkDir, { recursive: true });

  let chunkFiles;
  try {
    chunkFiles = await splitAudioIntoChunks(audioPath, chunkDir, chunkSeconds);
  } catch (err) {
    cleanupPath(chunkDir);
    throw err;
  }

  const allSegments = [];
  const allProfiles = [];
  let timeOffset = 0;

  for (let i = 0; i < chunkFiles.length; i++) {
    const chunkDuration = await getFileDuration(chunkFiles[i]);

    // For non-first chunks, timeOffset already accounts for the overlap so
    // segment timestamps in the overlap zone are shifted correctly
    const result = await transcribeChunk(
      chunkFiles[i],
      sourceLanguage,
      i === 0,
      i,
      timeOffset
    );

    allSegments.push(...result.segments);
    allProfiles.push(result.speaker_profiles);

    // Advance offset, but subtract overlap so the next chunk re-covers the tail
    // of the current chunk (for context continuity), then we deduplicate later
    if (i < chunkFiles.length - 1) {
      timeOffset += Math.max(0, chunkDuration - CHUNK_OVERLAP_SECONDS);
    }
  }

  cleanupPath(chunkDir);

  return {
    segments: deduplicateSegments(allSegments),
    speaker_profiles: mergeSpeakerProfiles(allProfiles),
  };
};

module.exports = { transcribeWithSpeakers };
