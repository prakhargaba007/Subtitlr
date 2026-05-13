const OpenAI = require("openai");
const { SARVAM_BCP47_MAP } = require("./languageCatalog");

let _openai = null;
const getOpenAI = () => {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
};

const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .trim();

const SARVAM_LANGUAGE_GUIDE = {
  english: { script: "English" },
  hindi: { script: "Devanagari" },
  bengali: { script: "Bengali" },
  tamil: { script: "Tamil" },
  telugu: { script: "Telugu" },
  kannada: { script: "Kannada" },
  malayalam: { script: "Malayalam" },
  marathi: { script: "Devanagari" },
  gujarati: { script: "Gujarati" },
  punjabi: { script: "Gurmukhi" },
  odia: { script: "Odia" },
};

const SARVAM_ALIASES = {
  en: "english",
  "en-in": "english",
  hi: "hindi",
  "hi-in": "hindi",
  bn: "bengali",
  "bn-in": "bengali",
  ta: "tamil",
  "ta-in": "tamil",
  te: "telugu",
  "te-in": "telugu",
  kn: "kannada",
  "kn-in": "kannada",
  ml: "malayalam",
  "ml-in": "malayalam",
  mr: "marathi",
  "mr-in": "marathi",
  gu: "gujarati",
  "gu-in": "gujarati",
  pa: "punjabi",
  "pa-in": "punjabi",
  od: "odia",
  or: "odia",
  "od-in": "odia",
  oriya: "odia",
};

const resolveSarvamLanguageKey = (language) => {
  const key = norm(language);
  if (SARVAM_BCP47_MAP[key]) return key;
  return SARVAM_ALIASES[key] || null;
};

const buildSarvamLanguageList = () =>
  Object.entries(SARVAM_BCP47_MAP)
    .map(([language, code]) => {
      const script = SARVAM_LANGUAGE_GUIDE[language]?.script || "native script";
      return `${language} (${code}, ${script})`;
    })
    .join(", ");

const buildSarvamScriptRule = (targetLanguage) => {
  const key = resolveSarvamLanguageKey(targetLanguage);
  const code = key && SARVAM_BCP47_MAP[key];
  const script = SARVAM_LANGUAGE_GUIDE[key]?.script || "native script";
  if (!code || key === "english") {
    return "- Write normal Indian English for Sarvam en-IN.";
  }
  return `- Target is ${key} (${code}). Write local-language words in ${script} script, and write common English words/entities in English script. Do NOT romanize ${key} words.`;
};

const SARVAM_TTS_TEXT_RULES = `
Sarvam Bulbul v3 text rules:
- Return clean text for TTS. Do not use SSML, XML, Markdown, asterisks, or square-bracket performance tags like [pause].
- Use punctuation for rhythm: comma for a short pause, sentence punctuation for a medium pause, and "…" only for a real hesitation or trailing thought.
- If a sentence ends in Hindi or another Indic language, use "।". If it ends in English, use ".".
- Keep sentences breathable. Split very long thoughts into shorter spoken sentences.
- Use light fillers such as "um", "hmm", "actually…", "basically…", or "I mean…" only when the source tone is casual, hesitant, or the segment needs a tiny natural timing fill.
- Keep brand names, people names, language names, apps, websites, acronyms, URLs, and common tech/media/business words in English script.
- For numbers above four digits, use commas, e.g. "10,000".`;

const CODE_MIXING_RULES = `
Code-mixing style:
- Use natural Indian speech, not textbook translation.
- Keep the target language's natural sentence structure, but keep common English words in English script where people normally say them.
- Good examples: "यह campaign denim को celebrate करता है।", "आज का weather actually बहुत pleasant है।", "हर Indian अपनी mother tongue में technology use कर सके।"
- Bad examples: fully romanized Indic text, overly Sanskritized words, or translating common English/media terms when they sound more natural in English.
- Preserve wordplay and quoted English phrases when translating them would break the meaning, e.g. keep "jeans/genes", "good genes", "blue", "AI", "app", "download".`;

/**
 * Infer dubbing translation mode from source/target language labels.
 * @returns {'default'|'sarvam_code_mixed'|'hinglish_concise'|'split_for_timing'}
 */
const inferTranslationMode = (sourceLanguage, targetLanguage) => {
  const src = norm(sourceLanguage);
  const tgt = norm(targetLanguage);
  const sarvamSource = resolveSarvamLanguageKey(sourceLanguage);
  const sarvamTarget = resolveSarvamLanguageKey(targetLanguage);

  const englishSource =
    src === "english" || src === "en" || src === "" || src === "auto";
  const hindiSource = src === "hindi" || src === "hi" || src.includes("hindi");
  const englishTarget = tgt === "english" || tgt === "en";

  // Hinglish = Roman-script mixed Hindi (kept separate)
  const hinglishTarget = tgt === "hinglish";

  if (hinglishTarget && englishSource) return "hinglish_concise";
  if (sarvamTarget && !englishTarget && englishSource) return "sarvam_code_mixed";
  if (
    englishTarget &&
    (hindiSource || (sarvamSource && sarvamSource !== "english"))
  ) {
    return "split_for_timing";
  }
  return "default";
};

/**
 * @param {Array<{start:number, end:number, speaker_id:string, text:string, voice_profile_hint?: string, voice_description?: string, tts_performance_hint?: string}>} segments
 * @param {string} targetLanguage
 * @param {Array<{speaker_id:string, voice_description:string}>} speakerProfiles
 * @param {object} [options]
 * @param {string} [options.sourceLanguage]
 * @param {'default'|'sarvam_code_mixed'|'hinglish_concise'|'split_for_timing'|'auto'} [options.translationMode]
 * @returns {Promise<Array<{start, end, speaker_id, originalText, translatedText, subSegments?: Array<{relStart, relEnd, translatedText}>}>>}
 */
const translateToSpeechReady = async (
  segments,
  targetLanguage,
  speakerProfiles = [],
  options = {},
) => {
  if (!segments.length) return { results: [], usage: null };

  const mode =
    options.translationMode === "auto" || !options.translationMode
      ? inferTranslationMode(options.sourceLanguage, targetLanguage)
      : options.translationMode;

  const speakerRegisterMap = {};
  for (const profile of speakerProfiles) {
    speakerRegisterMap[profile.speaker_id] = profile.voice_description;
  }

  const inputItems = segments.map((s, i) => ({
    index: i,
    speaker_id: s.speaker_id,
    text: s.text,
    source_tts_performance_hint: String(s.tts_performance_hint || "").trim(),
    duration_seconds: parseFloat((s.end - s.start).toFixed(2)),
    voice_profile_hint: [s.voice_profile_hint, s.voice_description]
      .map((x) => String(x || "").trim())
      .filter(Boolean)
      .join(" | "),
  }));

  let modeRules = "";
  let jsonShape = "";

  if (mode === "sarvam_code_mixed" || mode === "hindi_devanagari") {
    modeRules = `
Translation mode: ENGLISH → Sarvam-supported Indian language
Supported Sarvam targets: ${buildSarvamLanguageList()}
${buildSarvamScriptRule(targetLanguage)}
- Translate for natural spoken dubbing in the target language.
- Avoid pure textbook translation. Prefer the kind of code-mixed speech Indians naturally use with Sarvam Bulbul.
- Fit naturally within \`duration_seconds\`: short clips should be concise; longer clips may be slightly fuller, but do not add new facts.
- Preserve speaker register and tone from Speaker profiles.

${SARVAM_TTS_TEXT_RULES}

${CODE_MIXING_RULES}

Example style for Hindi:
Source: American Eagle faces backlash over a Sydney Sweeney ad accused of racism due to a jeans/genes pun.
Better: American Eagle को Sydney Sweeney वाले ad पर backlash झेलना पड़ा, क्योंकि jeans/genes pun को कुछ लोगों ने racist बताया।`;
    jsonShape = `Return ONLY valid JSON: { "results": [ { "index": 0, "translated_text": "..." }, ... ] }`;
  } else if (mode === "hinglish_concise") {
    modeRules = `
Translation mode: ENGLISH → HINGLISH / SPOKEN HINDI (concise dubbing)
- Return clean Sarvam TTS text. Do not use square-bracket performance tags.
- Prefer natural Hinglish: common English words where Indian speakers would mix them; Roman script is acceptable because Hinglish is explicitly requested.
- Fit naturally within \`duration_seconds\`: short clips should be concise; longer clips may be slightly fuller, but do not add new facts.
- Use commas, sentence punctuation, and occasional "…" for rhythm.
- Avoid long formal Sanskritized Hindi if a shorter mixed or colloquial line carries the same meaning.
- For laughs/reactions use spoken text such as "ha ha" only when it belongs in the source tone.`;
    jsonShape = `Return ONLY valid JSON: { "results": [ { "index": 0, "translated_text": "..." }, ... ] }`;
  } else if (mode === "split_for_timing") {
    modeRules = `
Translation mode: Indian language → ENGLISH with SUB-SEGMENTS for timing
- Write clean Sarvam en-IN TTS text. Do not use square-bracket performance tags.
- Spoken English is often shorter in wall-clock time than Indian languages for the same ideas, so avoid ultra-terse subtitle-style lines.
- Split into 2–5 spoken clauses that partition the window [0,1] via rel_start/rel_end (non-overlapping, in order).
- Prefer fuller natural English: add brief connective phrases or light redundancy so each sub-segment uses most of its time slice.
- Do not invent facts; stay faithful to the source meaning and names.
- Use commas, sentence punctuation, and occasional "…" for rhythm.
- If one continuous English line fits naturally, return a single sub-segment 0→1 matching translated_text.`;
    jsonShape = `Return ONLY valid JSON: { "results": [ { "index": 0, "translated_text": "full line for fallback", "sub_segments": [ { "rel_start": 0, "rel_end": 0.5, "text": "First clause." }, { "rel_start": 0.5, "rel_end": 1, "text": "Second clause." } ] }, ... ] }
If sub_segments is omitted or empty, translated_text alone will be used as a single segment.`;
  } else {
    modeRules = `
Translation mode: DEFAULT
- Translate for SPOKEN delivery. Match speaker register from profiles.
- Return clean TTS text. Do not use square-bracket performance tags.
- Fit naturally within \`duration_seconds\`: short clips should be concise; longer clips may be slightly fuller, but do not add new facts.
- Use punctuation for pauses and delivery; ellipses are optional for trailing tone.`;
    jsonShape = `Return ONLY valid JSON: { "results": [ { "index": 0, "translated_text": "..." }, ... ] }`;
  }

  const systemPrompt = `You are a professional dubbing translator specialising in natural, speech-ready translations.

Target language: ${targetLanguage}

Speaker profiles for register/tone matching:
${
  Object.entries(speakerRegisterMap)
    .map(([id, desc]) => `- ${id}: ${desc}`)
    .join("\n") ||
  "Not available — match the general spoken register of each segment."
}

${modeRules}

General rules:
1. Keep proper nouns, brand names, and technical terms in their common target-language form.
2. Preserve intentional pauses with punctuation only. Do not output bracket tags.
3. \`text\` is the verbatim source caption. \`source_tts_performance_hint\` is the same segment with English [audio tags] from transcription — use it for delivery/pause alignment. \`voice_profile_hint\` is extra register/emotion cue. None of these may change the factual meaning of \`text\`.

${jsonShape}`;

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: JSON.stringify({
          segments_to_translate: inputItems,
          translation_mode: mode,
        }),
      },
    ],
  });

  let parsed;
  try {
    let text = response.choices[0].message.content.trim();
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(`Translation response parse failed: ${err.message}`);
  }

  const resultMap = {};
  for (const r of parsed.results || []) {
    resultMap[r.index] = r;
  }

  const finalResults = segments.map((seg, i) => {
    const r = resultMap[i];
    const translatedText = (r && r.translated_text) || seg.text;
    const rawSubs = r && Array.isArray(r.sub_segments) ? r.sub_segments : [];

    let subSegments = [];
    if (mode === "split_for_timing" && rawSubs.length > 0) {
      subSegments = rawSubs
        .map((s) => ({
          relStart: Math.max(0, Math.min(1, Number(s.rel_start) || 0)),
          relEnd: Math.max(0, Math.min(1, Number(s.rel_end) || 1)),
          translatedText: String(s.text || "").trim(),
        }))
        .filter((s) => s.translatedText && s.relEnd > s.relStart);
      subSegments.sort((a, b) => a.relStart - b.relStart);
    }

    return {
      start: seg.start,
      end: seg.end,
      speaker_id: seg.speaker_id,
      originalText: seg.text,
      translatedText,
      subSegments,
      voiceProfile: seg.voiceProfile,
      translationMode: mode,
    };
  });

  return { results: finalResults, usage: response.usage };
};

module.exports = { translateToSpeechReady, inferTranslationMode };
