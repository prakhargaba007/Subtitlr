const OpenAI = require("openai");

let _openai = null;
const getOpenAI = () => {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
};

/**
 * Translate transcribed segments into speech-ready target-language text using GPT-4o-mini.
 *
 * "Speech-ready" means:
 *  - Natural contractions and colloquialisms (not literal/formal translation)
 *  - Punctuation that reflects spoken rhythm (commas for breath pauses, etc.)
 *  - Maintains the speaker's register (casual, formal, authoritative, etc.)
 *  - Preserves filler words where they add character (um → erm, etc.)
 *  - Keeps proper nouns, brand names, and technical terms in their common target-language form
 *
 * @param {Array<{start:number, end:number, speaker_id:string, text:string}>} segments
 * @param {string} targetLanguage - e.g. "french", "spanish", "hindi"
 * @param {Array<{speaker_id:string, voice_description:string}>} speakerProfiles
 * @returns {Promise<Array<{start:number, end:number, speaker_id:string, originalText:string, translatedText:string}>>}
 */
const translateToSpeechReady = async (segments, targetLanguage, speakerProfiles = []) => {
  if (!segments.length) return [];

  // Build a quick speaker register map so GPT knows each speaker's style
  const speakerRegisterMap = {};
  for (const profile of speakerProfiles) {
    speakerRegisterMap[profile.speaker_id] = profile.voice_description;
  }

  // Batch all texts in a single API call for efficiency
  const inputItems = segments.map((s, i) => ({
    index: i,
    speaker_id: s.speaker_id,
    text: s.text,
    duration_seconds: parseFloat((s.end - s.start).toFixed(2)),
  }));

  const systemPrompt = `You are a professional dubbing translator specialising in natural, speech-ready translations.

Target language: ${targetLanguage}

Speaker profiles for register/tone matching:
${
  Object.entries(speakerRegisterMap)
    .map(([id, desc]) => `- ${id}: ${desc}`)
    .join("\n") || "Not available — match the general spoken register of each segment."
}

Translation rules:
1. Translate for SPOKEN delivery, not written reading. Use contractions, natural rhythms.
2. Match the speaker's register: casual speakers get casual translations; formal speakers stay formal.
3. Preserve pauses implied by commas and ellipses — these are timing cues for the voice actor.
4. Keep proper nouns, brand names, and technical terms as widely recognised in ${targetLanguage}.
5. The translated text should take approximately the SAME TIME to speak as the original (respect duration_seconds). Avoid long paraphrases that would bust the timing budget.
6. Do NOT add or remove sentences — translate what is there.
7. Return ONLY valid JSON: { "results": [ { "index": 0, "translated_text": "..." }, ... ] }`;

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: JSON.stringify({ segments_to_translate: inputItems }),
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
    resultMap[r.index] = r.translated_text || "";
  }

  return segments.map((seg, i) => ({
    start: seg.start,
    end: seg.end,
    speaker_id: seg.speaker_id,
    originalText: seg.text,
    translatedText: resultMap[i] ?? seg.text,
  }));
};

module.exports = { translateToSpeechReady };
