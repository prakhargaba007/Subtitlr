const OpenAI = require("openai");
const { isHindiLikeTarget } = require("./dubbingConfig");

let _openai = null;
const getOpenAI = () => {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
};

const norm = (s) => String(s || "").toLowerCase().trim();

/**
 * Infer dubbing translation mode from source/target language labels.
 * @returns {'default'|'hindi_devanagari'|'hinglish_concise'|'split_for_timing'}
 */
const inferTranslationMode = (sourceLanguage, targetLanguage) => {
  const src = norm(sourceLanguage);
  const tgt = norm(targetLanguage);

  const englishSource = src === "english" || src === "en" || src === "" || src === "auto";
  const hindiSource = src === "hindi" || src === "hi" || src.includes("hindi");
  const englishTarget = tgt === "english" || tgt === "en";

  // Proper Hindi (Devanagari) — distinct from Hinglish
  const properHindiTarget = tgt === "hindi" || tgt === "hi";
  // Hinglish = Roman-script mixed Hindi (kept separate)
  const hinglishTarget = tgt === "hinglish";

  if (properHindiTarget && englishSource) return "hindi_devanagari";
  if (hinglishTarget && englishSource) return "hinglish_concise";
  if (englishTarget && hindiSource) return "split_for_timing";
  return "default";
};

/**
 * @param {Array<{start:number, end:number, speaker_id:string, text:string, voice_profile_hint?: string}>} segments
 * @param {string} targetLanguage
 * @param {Array<{speaker_id:string, voice_description:string}>} speakerProfiles
 * @param {object} [options]
 * @param {string} [options.sourceLanguage]
 * @param {'default'|'hinglish_concise'|'split_for_timing'|'auto'} [options.translationMode]
 * @returns {Promise<Array<{start, end, speaker_id, originalText, translatedText, subSegments?: Array<{relStart, relEnd, translatedText}>}>>}
 */
const translateToSpeechReady = async (segments, targetLanguage, speakerProfiles = [], options = {}) => {
  if (!segments.length) return [];

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
    duration_seconds: parseFloat((s.end - s.start).toFixed(2)),
    voice_profile_hint: s.voice_profile_hint || "",
  }));

  let modeRules = "";
  let jsonShape = "";

  if (mode === "hindi_devanagari") {
    modeRules = `
Translation mode: ENGLISH → HINDI (proper Devanagari script)
- Output MUST be written entirely in Devanagari script (हिन्दी). Do NOT use Roman/Latin letters for Hindi words.
- Use natural, conversational spoken Hindi — not overly formal or Sanskritized unless the original register is formal.
- English loanwords that Indians universally say in English (e.g. "mobile", "video", "OK", "doctor") may remain in Latin; everything else must be Devanagari.
- **TIMING RULE:** Your goal is to EXACTLY MATCH the spoken length of the translation to the provided \`duration_seconds\`. If the duration is long, write a longer, more detailed sentence to fill the time. If the duration is short, make it concise.
- **PUNCTUATION RULE:** If a sentence ends in Hindi or a regional language, use '।' (purna viram) instead of '.'. If it ends in English, use '.'. To create hesitation or breathing pauses, use '…' (ellipsis) or line breaks.
- Preserve speaker register and tone as described in Speaker profiles.
- Use *single asterisks* around words for emphasis where helpful for TTS.`;
    jsonShape = `Return ONLY valid JSON: { "results": [ { "index": 0, "translated_text": "..." }, ... ] }`;
  } else if (mode === "hinglish_concise") {
    modeRules = `
Translation mode: ENGLISH → HINGLISH / SPOKEN HINDI (concise dubbing)
- **TIMING RULE:** Your goal is to EXACTLY MATCH the spoken length of the translation to the provided \`duration_seconds\`. If the duration is long, write a longer, more detailed sentence to fill the time. If the duration is short, make it concise.
- Prefer natural Hinglish: common English words where Indian speakers would mix them; Roman script for Hindi parts unless Devanagari is clearly better for TTS.
- **PUNCTUATION RULE:** To create hesitation or breathing pauses, use '…' (ellipsis). Use '।' at the end of Devanagari sentences.
- Avoid long formal Sanskritized Hindi if a shorter mixed or colloquial line carries the same meaning.
- Use *single asterisks* around words for emphasis where helpful for TTS.
- Do NOT use Inworld bracket tags like [laugh] unless voice_profile_hint explicitly supports a non-verbal — for non-English output prefer "ha ha" or plain text.`;
    jsonShape = `Return ONLY valid JSON: { "results": [ { "index": 0, "translated_text": "..." }, ... ] }`;
  } else if (mode === "split_for_timing") {
    modeRules = `
Translation mode: HINDI (or similar) → ENGLISH with SUB-SEGMENTS for timing
- Spoken English is often **shorter in wall-clock time** than Hindi for the same ideas — dubbing then leaves dead air unless you **fill** the slot.
- Split into 2–5 spoken clauses that partition the window [0,1] via rel_start/rel_end (non-overlapping, in order).
- Prefer **fuller** natural English: add brief connective phrases, light redundancy, or a short clarifying clause so each sub-segment’s text, when read aloud at a normal pace, **uses most of** its time slice (avoid ultra-terse subtitles-style lines).
- Do not invent facts; stay faithful to the Hindi meaning and names.
- Use *single asterisks* for emphasis where helpful.
- If one continuous English line fits naturally, return a single sub-segment 0→1 matching translated_text.`;
    jsonShape = `Return ONLY valid JSON: { "results": [ { "index": 0, "translated_text": "full line for fallback", "sub_segments": [ { "rel_start": 0, "rel_end": 0.5, "text": "First clause." }, { "rel_start": 0.5, "rel_end": 1, "text": "Second clause." } ] }, ... ] }
If sub_segments is omitted or empty, translated_text alone will be used as a single segment.`;
  } else {
    modeRules = `
Translation mode: DEFAULT
- Translate for SPOKEN delivery. Match speaker register from profiles.
- **TIMING RULE:** Your goal is to EXACTLY MATCH the spoken length of the translation to the provided \`duration_seconds\`. If the duration is long, write a correspondingly longer sentence (elaborate text). If short, make it concise.
- Use '…' (ellipsis) to create a hesitation or trailing-off effect where natural.
- Use *single asterisks* for emphasis where helpful for TTS.
- For English target with voice_profile_hint suggesting laughing/whispering, you may prefix experimental Inworld bracket tags at the start of the line ONLY if hint mentions them (e.g. [laughing], [happy]) — keep minimal.`;
    jsonShape = `Return ONLY valid JSON: { "results": [ { "index": 0, "translated_text": "..." }, ... ] }`;
  }

  const systemPrompt = `You are a professional dubbing translator specialising in natural, speech-ready translations.

Target language: ${targetLanguage}

Speaker profiles for register/tone matching:
${
  Object.entries(speakerRegisterMap)
    .map(([id, desc]) => `- ${id}: ${desc}`)
    .join("\n") || "Not available — match the general spoken register of each segment."
}

${modeRules}

General rules:
1. Keep proper nouns, brand names, and technical terms in their common target-language form.
2. Preserve intentional pauses with commas and ellipses.
3. When voice_profile_hint is non-empty, use it only as a light cue for delivery (emotion, laugh, whisper) — do not contradict the words in "text".

${jsonShape}`;

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: JSON.stringify({ segments_to_translate: inputItems, translation_mode: mode }),
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

  return segments.map((seg, i) => {
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
};

module.exports = { translateToSpeechReady, inferTranslationMode };
