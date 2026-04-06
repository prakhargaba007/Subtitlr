const fs = require("fs");
const OpenAI = require("openai");

let _openai = null;
const getOpenAI = () => {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
};

// ─── Language Map ─────────────────────────────────────────────────────────────

const LANGUAGE_MAP = {
  // A
  afrikaans: "af", af: "af",
  albanian: "sq", sq: "sq",
  amharic: "am", am: "am",
  arabic: "ar", ar: "ar",
  armenian: "hy", hy: "hy",
  azerbaijani: "az", az: "az",
  // B
  bashkir: "ba", ba: "ba",
  basque: "eu", eu: "eu",
  belarusian: "be", be: "be",
  bengali: "bn", bangla: "bn", bn: "bn",
  bosnian: "bs", bs: "bs",
  breton: "br", br: "br",
  bulgarian: "bg", bg: "bg",
  burmese: "my", myanmar: "my", my: "my",
  // C
  catalan: "ca", ca: "ca",
  chinese: "zh", mandarin: "zh", zh: "zh",
  croatian: "hr", hr: "hr",
  czech: "cs", cs: "cs",
  // D
  danish: "da", da: "da",
  dutch: "nl", nl: "nl",
  // E
  english: "en", en: "en",
  estonian: "et", et: "et",
  // F
  faroese: "fo", fo: "fo",
  finnish: "fi", fi: "fi",
  french: "fr", français: "fr", francais: "fr", fr: "fr",
  // G
  galician: "gl", gl: "gl",
  georgian: "ka", ka: "ka",
  german: "de", deutsch: "de", de: "de",
  greek: "el", el: "el",
  gujarati: "gu", gu: "gu",
  // H
  haitian: "ht", ht: "ht",
  hausa: "ha", ha: "ha",
  hawaiian: "haw", haw: "haw",
  hebrew: "he", he: "he",
  hindi: "hi", hi: "hi",
  hinglish: null,
  hungarian: "hu", hu: "hu",
  // I
  icelandic: "is", is: "is",
  indonesian: "id", id: "id",
  italian: "it", italiano: "it", it: "it",
  // J
  japanese: "ja", ja: "ja",
  javanese: "jw", jw: "jw",
  // K
  kannada: "kn", kn: "kn",
  kazakh: "kk", kk: "kk",
  khmer: "km", km: "km",
  korean: "ko", ko: "ko",
  // L
  lao: "lo", lo: "lo",
  latin: "la", la: "la",
  latvian: "lv", lv: "lv",
  lingala: "ln", ln: "ln",
  lithuanian: "lt", lt: "lt",
  luxembourgish: "lb", lb: "lb",
  // M
  macedonian: "mk", mk: "mk",
  malagasy: "mg", mg: "mg",
  malay: "ms", ms: "ms",
  malayalam: "ml", ml: "ml",
  maltese: "mt", mt: "mt",
  maori: "mi", mi: "mi",
  marathi: "mr", mr: "mr",
  mongolian: "mn", mn: "mn",
  // N
  nepali: "ne", ne: "ne",
  norwegian: "no", no: "no",
  // O
  occitan: "oc", oc: "oc",
  odia: "or", oriya: "or", or: "or",
  // P
  pashto: "ps", ps: "ps",
  persian: "fa", farsi: "fa", fa: "fa",
  polish: "pl", pl: "pl",
  portuguese: "pt", português: "pt", portugues: "pt", pt: "pt",
  punjabi: "pa", pa: "pa",
  // R
  romanian: "ro", ro: "ro",
  russian: "ru", ru: "ru",
  // S
  sanskrit: "sa", sa: "sa",
  serbian: "sr", sr: "sr",
  shona: "sn", sn: "sn",
  sindhi: "sd", sd: "sd",
  sinhala: "si", si: "si",
  slovak: "sk", sk: "sk",
  slovenian: "sl", sl: "sl",
  somali: "so", so: "so",
  spanish: "es", español: "es", espanol: "es", es: "es",
  sundanese: "su", su: "su",
  swahili: "sw", sw: "sw",
  swedish: "sv", sv: "sv",
  // T
  tagalog: "tl", filipino: "tl", tl: "tl",
  tajik: "tg", tg: "tg",
  tamil: "ta", ta: "ta",
  tatar: "tt", tt: "tt",
  telugu: "te", te: "te",
  thai: "th", th: "th",
  tibetan: "bo", bo: "bo",
  turkish: "tr", tr: "tr",
  turkmen: "tk", tk: "tk",
  // U
  ukrainian: "uk", uk: "uk",
  urdu: "ur", ur: "ur",
  uzbek: "uz", uz: "uz",
  // V
  vietnamese: "vi", vi: "vi",
  // W
  welsh: "cy", cy: "cy",
  // Y
  yiddish: "yi", yi: "yi",
  yoruba: "yo", yo: "yo",
  // Z
  zulu: "zu", zu: "zu",
};

// ─── Language List (deduplicated, frontend-ready) ─────────────────────────────

const LANGUAGE_LIST = (() => {
  const SHORT_FULL_NAMES = new Set(["lao"]);
  const seenIsoCodes = new Set();
  const list = [];

  for (const [key, isoCode] of Object.entries(LANGUAGE_MAP)) {
    const isIsoAlias =
      (key.length <= 3 && !SHORT_FULL_NAMES.has(key)) ||
      key === "français" ||
      key === "español" ||
      key === "português" ||
      key === "deutsch" ||
      key === "italiano" ||
      key === "bangla" ||
      key === "myanmar" ||
      key === "mandarin" ||
      key === "farsi" ||
      key === "filipino" ||
      key === "oriya" ||
      key === "portugues" ||
      key === "francais" ||
      key === "espanol";

    if (isIsoAlias) continue;

    const dedupeKey = isoCode ?? key;
    if (seenIsoCodes.has(dedupeKey)) continue;
    seenIsoCodes.add(dedupeKey);

    list.push({
      value: key,
      label: key.charAt(0).toUpperCase() + key.slice(1),
      isoCode,
    });
  }

  list.sort((a, b) => a.label.localeCompare(b.label));
  return list;
})();

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
const transliterateToHinglish = async (segments) => {
  if (!segments.length) return segments;

  const texts = segments.map((s) => s.text);

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are a Devanagari-to-Hinglish transliterator. " +
          "Convert each Hindi text from Devanagari script to Roman script (how it sounds phonetically). " +
          "Rules: " +
          "1. Transliterate pronunciation — do NOT translate the meaning. " +
          "2. Keep English words exactly as-is. " +
          "3. Keep brand names, proper nouns, and URLs as-is (e.g. 'AI' stays 'AI', 'gharwale.AI' stays 'gharwale.AI'). " +
          "4. Return ONLY a JSON object: { \"results\": [\"...\", \"...\"] } with one entry per input.",
      },
      {
        role: "user",
        content: JSON.stringify({ texts }),
      },
    ],
  });

  const parsed = JSON.parse(response.choices[0].message.content);
  const results = parsed.results || [];

  return segments.map((s, i) => ({
    ...s,
    text: results[i] ?? s.text,
  }));
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
        `${i + 1}\n${formatSRTTime(seg.start)} --> ${formatSRTTime(seg.end)}\n${seg.text.trim()}`
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
        `Dialogue: 0,${formatASSTime(seg.start)},${formatASSTime(seg.end)},Default,,0,0,0,,${seg.text.trim()}`
    )
    .join("\n");

  return `${header}\n${dialogues}`;
};

module.exports = {
  LANGUAGE_MAP,
  LANGUAGE_LIST,
  resolveLanguage,
  transcribeFileWithWhisper,
  shiftSegments,
  transliterateToHinglish,
  generateSRT,
  generateVTT,
  generateASS,
};
