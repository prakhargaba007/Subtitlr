const fs = require("fs");
const OpenAI = require("openai");
const { GoogleGenAI } = require("@google/genai");

let _openai = null;
const getOpenAI = () => {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
};

let _gemini = null;
const getGemini = () => {
  const key = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!key) return null;
  if (!_gemini) _gemini = new GoogleGenAI({ apiKey: key });
  return _gemini;
};

const parseGeminiJsonResponse = (response) => {
  let text = "";
  if (response.candidates?.[0]?.content?.parts?.[0]?.text) {
    text = response.candidates[0].content.parts[0].text;
  } else if (typeof response.text === "string") {
    text = response.text;
  } else {
    throw new Error("Unexpected Gemini response format");
  }
  const clean = text
    .replace(/^```(?:json)?\n?/i, "")
    .replace(/\n?```$/i, "")
    .trim();
  return JSON.parse(clean);
};

const {
  LANGUAGE_MAP,
  LANGUAGE_LIST,
  DUBBING_LANGUAGE_LIST,
} = require("./languageCatalog");

// ─── Language Resolution ──────────────────────────────────────────────────────

/**
 * Resolve a user-supplied language string to an ISO 639-1 code.
 * Returns { isoCode: string|null, label: string }
 * isoCode === null → omit from Whisper call (auto-detect)
 */
const resolveLanguage = (input) => {
  if (!input || input.trim() === "") {
    return { isoCode: null, label: "auto" };
  }
  const key = input.toLowerCase().trim();

  if (key === "hinglish") {
    return { isoCode: "hi", label: "hinglish" };
  }

  if (key in LANGUAGE_MAP) {
    const isoCode = LANGUAGE_MAP[key];
    return { isoCode, label: isoCode ?? "auto" };
  }
  return { isoCode: key, label: key };
};

// ─── Whisper Transcription ────────────────────────────────────────────────────

/** Call Whisper on a single local file. */
const transcribeFileWithWhisper = async (filePath, languageCode) => {
  const params = {
    file: fs.createReadStream(filePath),
    model: "whisper-1",
    response_format: "verbose_json",
    timestamp_granularities: ["segment"],
  };
  if (languageCode) params.language = languageCode;
  return getOpenAI().audio.transcriptions.create(params);
};

/** ASR for a single extracted clip (VAD pipeline). Extend when adding non-Whisper providers. */
const transcribeSpeechClip = async (filePath, languageCode) => {
  const p = (process.env.SUBTITLE_ASR_PROVIDER || "whisper")
    .toLowerCase()
    .trim();
  if (p === "whisper" || p === "") {
    return transcribeFileWithWhisper(filePath, languageCode);
  }
  throw new Error(
    `SUBTITLE_ASR_PROVIDER="${p}" is not supported yet. Use whisper or omit.`,
  );
};

/** Shift all segment timestamps by offsetSeconds (for merging chunked results). */
const shiftSegments = (segments, offsetSeconds) =>
  segments.map((s) => ({
    start: s.start + offsetSeconds,
    end: s.end + offsetSeconds,
    text: s.text.trim(),
  }));

/**
 * Post-process: transliterate Devanagari segments to Roman Hinglish via GPT.
 * Sends all segment texts in one request for efficiency.
 */
const HINGLISH_SYSTEM_PROMPT =
  "You are a Devanagari-to-Hinglish transliterator. " +
  "Convert each Hindi text from Devanagari script to Roman script (how it sounds phonetically). " +
  "Rules: " +
  "1. Transliterate pronunciation — do NOT translate the meaning. " +
  "2. Keep English words exactly as-is. " +
  "3. Keep brand names, proper nouns, and URLs as-is (e.g. 'AI' stays 'AI', 'Kili Labs' stays 'Kili Labs'). " +
  '4. Return ONLY a JSON object: { "results": ["...", "..."] } with one entry per input.';

const transliterateToHinglish = async (segments) => {
  if (!segments.length) return segments;

  const texts = segments.map((s) => s.text);
  const userPayload = JSON.stringify({ texts });

  let parsed;
  const gemini = getGemini();
  if (gemini) {
    const model =
      process.env.SUBTITLE_TRANSLITERATION_MODEL ||
      "gemini-3.1-flash-lite-preview";
    const response = await gemini.models.generateContent({
      model,
      contents: `${HINGLISH_SYSTEM_PROMPT}\n\n${userPayload}`,
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json",
      },
    });
    const usage = response.response.usageMetadata;
    parsed = parseGeminiJsonResponse(response);
    return { segments: segments.map((s, i) => ({ ...s, text: (parsed.results || [])[i] ?? s.text })), usage };
  } else {
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: HINGLISH_SYSTEM_PROMPT },
        { role: "user", content: userPayload },
      ],
    });
    parsed = JSON.parse(response.choices[0].message.content);
    return { segments: segments.map((s, i) => ({ ...s, text: (parsed.results || [])[i] ?? s.text })), usage: response.usage };
  }
};

// ─── Subtitle Format Generators ───────────────────────────────────────────────

const pad = (n, len = 2) => String(n).padStart(len, "0");

const formatSRTTime = (seconds) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
};

const formatVTTTime = (seconds) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ms, 3)}`;
};

const formatASSTime = (seconds) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.round((seconds % 1) * 100);
  return `${h}:${pad(m)}:${pad(s)}.${pad(cs)}`;
};

const generateSRT = (segments) =>
  segments
    .map(
      (seg, i) =>
        `${i + 1}\n${formatSRTTime(seg.start)} --> ${formatSRTTime(seg.end)}\n${seg.text.trim()}`,
    )
    .join("\n\n");

const generateVTT = (segments) => {
  const lines = ["WEBVTT", ""];
  segments.forEach((seg, i) => {
    lines.push(`${i + 1}`);
    lines.push(`${formatVTTTime(seg.start)} --> ${formatVTTTime(seg.end)}`);
    lines.push(seg.text.trim());
    lines.push("");
  });
  return lines.join("\n");
};

const generateASS = (segments) => {
  const header = [
    "[Script Info]",
    "ScriptType: v4.00+",
    "PlayResX: 1280",
    "PlayResY: 720",
    "ScaledBorderAndShadow: yes",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    "Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,2,2,2,20,20,30,1",
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ].join("\n");

  const dialogues = segments
    .map(
      (seg) =>
        `Dialogue: 0,${formatASSTime(seg.start)},${formatASSTime(seg.end)},Default,,0,0,0,,${seg.text.trim()}`,
    )
    .join("\n");

  return `${header}\n${dialogues}`;
};

module.exports = {
  LANGUAGE_MAP,
  LANGUAGE_LIST,
  DUBBING_LANGUAGE_LIST,
  resolveLanguage,
  transcribeFileWithWhisper,
  transcribeSpeechClip,
  shiftSegments,
  transliterateToHinglish,
  generateSRT,
  generateVTT,
  generateASS,
};
