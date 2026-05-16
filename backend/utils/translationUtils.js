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

const SARVAM_TARGET_STYLE_GUIDES = {
  english: {
    nativeName: "Indian English",
    script: "English",
    punctuation: "Use normal English punctuation.",
    guardrail: "Write natural Indian English. Do not translate proper nouns or common media terms unnecessarily.",
    examples: [
      {
        source: "The app team shared a quick update about the new feature.",
        better:
          "The app team shared a quick update about the new feature.",
      },
    ],
  },
  hindi: {
    nativeName: "Hindi",
    script: "Devanagari",
    punctuation: "Use Hindi danda (।) when the sentence ends in Hindi.",
    guardrail:
      "Use Devanagari for Hindi words. Do not romanize Hindi, but keep natural English words in English script.",
    examples: [
      {
        source: "The app team shared a quick update about the new feature.",
        better:
          "App team ने new feature के बारे में एक quick update share किया।",
      },
    ],
  },
  bengali: {
    nativeName: "Bengali",
    script: "Bengali",
    punctuation: "Use Bengali/Indic sentence punctuation naturally when the sentence ends in Bengali.",
    guardrail:
      "Use Bengali script for Bengali words. Do not write Hindi or Devanagari for Bengali targets.",
    examples: [
      {
        source: "The app team shared a quick update about the new feature.",
        better:
          "App team নতুন feature নিয়ে একটা quick update share করেছে।",
      },
      {
        source: "The creator posted a short video for the launch.",
        better: "Creator launch এর জন্য একটা short video post করেছেন।",
      },
    ],
  },
  gujarati: {
    nativeName: "Gujarati",
    script: "Gujarati",
    punctuation: "Use Gujarati sentence flow; use danda only if it sounds natural for the line.",
    guardrail:
      "Use Gujarati script for Gujarati words. Do not write Hindi or Devanagari for Gujarati targets.",
    examples: [
      {
        source: "The app team shared a quick update about the new feature.",
        better:
          "App team એ new feature વિશે એક quick update share કર્યો.",
      },
      {
        source: "The creator posted a short video for the launch.",
        better: "Creator એ launch માટે એક short video post કર્યો.",
      },
    ],
  },
  kannada: {
    nativeName: "Kannada",
    script: "Kannada",
    punctuation: "Use Kannada sentence flow with clear spoken pauses.",
    guardrail:
      "Use Kannada script for Kannada words. Do not write Hindi or Devanagari for Kannada targets.",
    examples: [
      {
        source: "The app team shared a quick update about the new feature.",
        better:
          "App team ಹೊಸ feature ಬಗ್ಗೆ ಒಂದು quick update share ಮಾಡಿದೆ.",
      },
      {
        source: "The creator posted a short video for the launch.",
        better: "Creator launch ಗಾಗಿ ಒಂದು short video post ಮಾಡಿದ್ದಾರೆ.",
      },
    ],
  },
  malayalam: {
    nativeName: "Malayalam",
    script: "Malayalam",
    punctuation: "Use Malayalam sentence flow with simple spoken punctuation.",
    guardrail:
      "Use Malayalam script for Malayalam words. Do not write Hindi or Devanagari for Malayalam targets.",
    examples: [
      {
        source: "The app team shared a quick update about the new feature.",
        better:
          "App team പുതിയ feature നെ കുറിച്ച് ഒരു quick update share ചെയ്തു.",
      },
      {
        source: "The creator posted a short video for the launch.",
        better: "Creator launch നായി ഒരു short video post ചെയ്തു.",
      },
    ],
  },
  marathi: {
    nativeName: "Marathi",
    script: "Devanagari",
    punctuation: "Use Marathi sentence flow; use danda when the sentence ends in Marathi.",
    guardrail:
      "Marathi uses Devanagari, but the vocabulary and grammar must be Marathi, not Hindi.",
    examples: [
      {
        source: "The app team shared a quick update about the new feature.",
        better:
          "App team ने new feature बद्दल एक quick update share केला.",
      },
      {
        source: "The creator posted a short video for the launch.",
        better: "Creator ने launch साठी एक short video post केला.",
      },
    ],
  },
  odia: {
    nativeName: "Odia",
    script: "Odia",
    punctuation: "Use Odia sentence flow with clear spoken pauses.",
    guardrail:
      "Use Odia script for Odia words. Do not write Hindi or Devanagari for Odia targets.",
    examples: [
      {
        source: "The app team shared a quick update about the new feature.",
        better:
          "App team ନୂଆ feature ବିଷୟରେ ଏକ quick update share କଲା.",
      },
      {
        source: "The creator posted a short video for the launch.",
        better: "Creator launch ପାଇଁ ଏକ short video post କଲେ.",
      },
    ],
  },
  punjabi: {
    nativeName: "Punjabi",
    script: "Gurmukhi",
    punctuation: "Use Punjabi sentence flow with natural spoken pauses.",
    guardrail:
      "Use Gurmukhi for Punjabi words. Do not write Hindi or Devanagari for Punjabi targets.",
    examples: [
      {
        source: "The app team shared a quick update about the new feature.",
        better:
          "App team ਨੇ new feature ਬਾਰੇ ਇੱਕ quick update share ਕੀਤਾ.",
      },
      {
        source: "The creator posted a short video for the launch.",
        better: "Creator ਨੇ launch ਲਈ ਇੱਕ short video post ਕੀਤਾ.",
      },
    ],
  },
  tamil: {
    nativeName: "Tamil",
    script: "Tamil",
    punctuation: "Use Tamil sentence flow with clear spoken pauses.",
    guardrail:
      "Use Tamil script for Tamil words. Do not write Hindi or Devanagari for Tamil targets.",
    examples: [
      {
        source: "The app team shared a quick update about the new feature.",
        better:
          "App team புதிய feature பற்றி ஒரு quick update share செய்தது.",
      },
      {
        source: "The creator posted a short video for the launch.",
        better: "Creator launch காக ஒரு short video post செய்தார்.",
      },
    ],
  },
  telugu: {
    nativeName: "Telugu",
    script: "Telugu",
    punctuation: "Use Telugu sentence flow with clear spoken pauses.",
    guardrail:
      "Use Telugu script for Telugu words. Do not write Hindi or Devanagari for Telugu targets.",
    examples: [
      {
        source: "The app team shared a quick update about the new feature.",
        better:
          "App team కొత్త feature గురించి ఒక quick update share చేసింది.",
      },
      {
        source: "The creator posted a short video for the launch.",
        better: "Creator launch కోసం ఒక short video post చేశారు.",
      },
    ],
  },
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
  const guide = key && SARVAM_TARGET_STYLE_GUIDES[key];
  const script = guide?.script || SARVAM_LANGUAGE_GUIDE[key]?.script || "native script";
  if (!code || key === "english") {
    return "- Write normal Indian English for Sarvam en-IN.";
  }
  return `- Target is ${guide?.nativeName || key} (${key}, ${code}). Write local-language words in ${script} script, and write common English words/entities in English script. Do NOT romanize ${key} words.`;
};

const SARVAM_TTS_TEXT_RULES = `
Sarvam Bulbul v3 text rules:
- Return clean text for TTS. Do not use SSML, XML, Markdown, asterisks, or square-bracket performance tags like [pause].
- Use punctuation for rhythm: comma for a short pause, sentence punctuation for a medium pause, and "…" only for a real hesitation or trailing thought.
- If a sentence ends in the target Indic language, use punctuation that is natural for that language and script. If it ends in English, use ".".
- Keep sentences breathable. Split very long thoughts into shorter spoken sentences.
- Use light fillers such as "um", "hmm", "actually…", "basically…", or "I mean…" only when the source tone is casual, hesitant, or the segment needs a tiny natural timing fill.
- Keep brand names, people names, language names, apps, websites, acronyms, URLs, and common tech/media/business words in English script.
- For numbers above four digits, use commas, e.g. "10,000".`;

const SHARED_CODE_MIXING_RULES = `
Code-mixing style:
- Use natural Indian speech, not textbook translation.
- Keep the target language's natural sentence structure, but keep common English words in English script where people normally say them.
- Bad examples: fully romanized Indic text, overly Sanskritized words, or translating common English/media terms when they sound more natural in English.
- Preserve wordplay and quoted English phrases when translating them would break the meaning, e.g. keep "jeans/genes", "good genes", "blue", "AI", "app", "download".`;

const buildSarvamTargetPrompt = (targetLanguage) => {
  const key = resolveSarvamLanguageKey(targetLanguage);
  const code = key && SARVAM_BCP47_MAP[key];
  const guide = (key && SARVAM_TARGET_STYLE_GUIDES[key]) || null;
  const targetLabel = guide
    ? `${guide.nativeName} (${key}, ${code}, ${guide.script} script)`
    : `${targetLanguage || "target language"}${code ? ` (${code})` : ""}`;
  const examples = guide?.examples?.length
    ? guide.examples
        .map(
          (example) =>
            `Source: ${example.source}\nBetter ${guide.nativeName}: ${example.better}`,
        )
        .join("\n\n")
    : "";

  return `
Translation mode: ANY SOURCE → Sarvam-supported Indian language
Target language: ${targetLabel}
Supported Sarvam targets: ${buildSarvamLanguageList()}
${buildSarvamScriptRule(targetLanguage)}
- Translate for natural spoken dubbing in the target language, not Hindi unless the target is Hindi.
- The source text may be English, auto-detected, or any other language. Use it only for meaning; the output language and script must follow the target above.
- Avoid pure textbook translation. Prefer the kind of code-mixed speech Indians naturally use with Sarvam Bulbul.
- Fit naturally within \`duration_seconds\`: short clips should be concise; longer clips may be slightly fuller, but do not add new facts.
- Preserve speaker register and tone from Speaker profiles.
${guide ? `- ${guide.punctuation}\n- ${guide.guardrail}` : ""}

${SARVAM_TTS_TEXT_RULES}

${SHARED_CODE_MIXING_RULES}

${examples ? `Target-specific examples:\n${examples}` : ""}`.trim();
};

/**
 * Infer dubbing translation mode from source/target language labels.
 * @returns {'default'|'sarvam_code_mixed'|'hinglish_concise'|'split_for_timing'}
 */
const inferTranslationMode = (sourceLanguage, targetLanguage) => {
  const src = norm(sourceLanguage);
  const tgt = norm(targetLanguage);
  const sarvamSource = resolveSarvamLanguageKey(sourceLanguage);
  const sarvamTarget = resolveSarvamLanguageKey(targetLanguage);

  const hindiSource = src === "hindi" || src === "hi" || src.includes("hindi");
  const englishTarget = tgt === "english" || tgt === "en";

  // Hinglish = Roman-script mixed Hindi (kept separate)
  const hinglishTarget = tgt === "hinglish";

  if (hinglishTarget) return "hinglish_concise";
  if (sarvamTarget && !englishTarget) return "sarvam_code_mixed";
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

  const targetLanguageKey = resolveSarvamLanguageKey(targetLanguage);
  const targetLanguageCode =
    targetLanguageKey && SARVAM_BCP47_MAP[targetLanguageKey];
  const targetLanguageGuide =
    (targetLanguageKey && SARVAM_TARGET_STYLE_GUIDES[targetLanguageKey]) ||
    null;

  if (mode === "sarvam_code_mixed" || mode === "hindi_devanagari") {
    modeRules = buildSarvamTargetPrompt(targetLanguage);
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
          source_language: options.sourceLanguage || "",
          target_language: targetLanguage,
          target_language_key: targetLanguageKey,
          target_bcp47: targetLanguageCode,
          target_script: targetLanguageGuide?.script || null,
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
