const OpenAI = require("openai");
const { isHindiLikeTarget } = require("./dubbingConfig");

let _openai = null;
const getOpenAI = () => {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
};

const norm = (s) => String(s || "").toLowerCase().trim();

/** Gemini Native Audio / controllable TTS transcript style (audio tags in English). */
const GEMINI_TTS_TRANSCRIPT_BLOCK = `
### Gemini-style TTS transcript (required — not optional)
Every \`translated_text\` and every \`sub_segments\`.\`text\` must be a **Gemini controllable-TTS script**: **target-language spoken words** plus **inline English-only** square-bracket **audio tags** (Google Gemini speech-generation style). **Do not return plain dialogue with zero bracket tags** — at minimum open with a stance tag such as [conversational], [neutral], or [excited] when appropriate, and use **[pause]** / **[short pause]** wherever a beat, breath gap, or comma-level pause in the source warrants it.
- Tags may include: [whispers], [pause], [sarcastically], [laughs], [chuckle], [loud, exaggerated], [normal, fast, slightly mocking], [conversational, sarcastic], [gasps], [sighs], [shouting], [tired], etc.; combine related cues in one bracket when they belong together.
- **Non-English spoken words:** dialogue stays in the **target** language/script; **all bracket tags stay in English** (Google’s multilingual TTS guidance).
- When \`source_tts_performance_hint\` is non-empty, **mirror its delivery intent and pause rhythm** in your tags while translating the words from \`text\` (do not copy source-language words from the hint unless they belong in the target line).
- Match \`duration_seconds\` with wording length **and** tags (pauses slow delivery).
- Tags are inline only — do not spell tag names as spoken dialogue. Prefer tags over *asterisks*.
- When \`voice_profile_hint\` suggests emotion or non-verbals, reflect that with tags; never contradict the meaning of \`text\`.`;

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
 * @param {Array<{start:number, end:number, speaker_id:string, text:string, voice_profile_hint?: string, voice_description?: string, tts_performance_hint?: string}>} segments
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
    source_tts_performance_hint: String(s.tts_performance_hint || "").trim(),
    duration_seconds: parseFloat((s.end - s.start).toFixed(2)),
    voice_profile_hint: [s.voice_profile_hint, s.voice_description]
      .map((x) => String(x || "").trim())
      .filter(Boolean)
      .join(" | "),
  }));

  let modeRules = "";
  let jsonShape = "";

  if (mode === "hindi_devanagari") {
    modeRules = `
Translation mode: ENGLISH → HINDI (proper Devanagari script)
- **Spoken words** MUST be in Devanagari script (हिन्दी). Do NOT use Roman/Latin letters for Hindi words. **Exception:** inline Gemini TTS **audio tags** are English-only inside square brackets (e.g. [pause], [chuckle]) — those brackets are required and are not "Hindi words".
- Use natural, conversational spoken Hindi — not overly formal or Sanskritized unless the original register is formal.
- English loanwords that Indians universally say in English (e.g. "mobile", "video", "OK", "doctor") may remain in Latin; everything else must be Devanagari.
- **TIMING RULE:** Your goal is to EXACTLY MATCH the spoken length of the translation to the provided \`duration_seconds\`. If the duration is long, write a longer, more detailed sentence to fill the time. If the duration is short, make it concise.
- **PUNCTUATION RULE:** If a sentence ends in Hindi or a regional language, use '।' (purna viram) instead of '.'. If it ends in English, use '.'. You may use '…' (ellipsis) for trailing tone; prefer **[pause]** / **[short pause]** tags (in English) for clear TTS beats per Gemini TTS style.
- Preserve speaker register and tone as described in Speaker profiles.`;
    jsonShape = `Return ONLY valid JSON: { "results": [ { "index": 0, "translated_text": "..." }, ... ] }`;
  } else if (mode === "hinglish_concise") {
    modeRules = `
Translation mode: ENGLISH → HINGLISH / SPOKEN HINDI (concise dubbing)
- **Gemini tags:** use English-only [audio tags] inline; spoken Hinglish/Hindi stays Roman and/or Devanagari as below — tags are exempt from script choice.
- **TIMING RULE:** Your goal is to EXACTLY MATCH the spoken length of the translation to the provided \`duration_seconds\`. If the duration is long, write a longer, more detailed sentence to fill the time. If the duration is short, make it concise.
- Prefer natural Hinglish: common English words where Indian speakers would mix them; Roman script for Hindi parts unless Devanagari is clearly better for TTS.
- **PUNCTUATION RULE:** Use '।' at the end of Devanagari sentences. Use **[pause]** / **[short pause]** (English tags) plus ellipses where natural.
- Avoid long formal Sanskritized Hindi if a shorter mixed or colloquial line carries the same meaning.
- For laughs/reactions you may use plain "ha ha" in the script and/or English tags like [chuckle] / [laughs] per the Gemini-style block below.`;
    jsonShape = `Return ONLY valid JSON: { "results": [ { "index": 0, "translated_text": "..." }, ... ] }`;
  } else if (mode === "split_for_timing") {
    modeRules = `
Translation mode: HINDI (or similar) → ENGLISH with SUB-SEGMENTS for timing
- Spoken English is often **shorter in wall-clock time** than Hindi for the same ideas — dubbing then leaves dead air unless you **fill** the slot.
- Split into 2–5 spoken clauses that partition the window [0,1] via rel_start/rel_end (non-overlapping, in order).
- Prefer **fuller** natural English: add brief connective phrases, light redundancy, or a short clarifying clause so each sub-segment’s text, when read aloud at a normal pace, **uses most of** its time slice (avoid ultra-terse subtitles-style lines).
- Do not invent facts; stay faithful to the Hindi meaning and names.
- Each sub-segment \`text\` must follow the Gemini-style TTS transcript rules below (English dialogue + English [audio tags]).
- If one continuous English line fits naturally, return a single sub-segment 0→1 matching translated_text.`;
    jsonShape = `Return ONLY valid JSON: { "results": [ { "index": 0, "translated_text": "full line for fallback", "sub_segments": [ { "rel_start": 0, "rel_end": 0.5, "text": "First clause." }, { "rel_start": 0.5, "rel_end": 1, "text": "Second clause." } ] }, ... ] }
If sub_segments is omitted or empty, translated_text alone will be used as a single segment.`;
  } else {
    modeRules = `
Translation mode: DEFAULT
- Translate for SPOKEN delivery. Match speaker register from profiles.
- **TIMING RULE:** Your goal is to EXACTLY MATCH the spoken length of the translation to the provided \`duration_seconds\`. If the duration is long, write a correspondingly longer sentence (elaborate text). If short, make it concise.
- Use Gemini-style English [audio tags] for pauses and delivery; ellipses are optional for trailing tone.`;
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

${GEMINI_TTS_TRANSCRIPT_BLOCK}

General rules:
1. Keep proper nouns, brand names, and technical terms in their common target-language form.
2. Preserve intentional pauses with commas plus **[pause]** / **[short pause]** tags (English); ellipses optional.
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
