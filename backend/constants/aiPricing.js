/**
 * AI API Pricing Constants (USD)
 * Prices are per 1,000,000 (1M) tokens/characters unless specified otherwise.
 */

const AI_API_PRICING = [
  {
    provider: "Google",
    model: "gemini-3.1-pro-preview",
    type: "transcription",
    inputPricePer1M: { under200k: 2.0, over200k: 4.0 },
    outputPricePer1M: { under200k: 12.0, over200k: 18.0 },
  },
  {
    provider: "OpenAI",
    model: "whisper-1",
    type: "transcription",
    pricePerMinute: 0.006,
  },
  {
    provider: "OpenAI",
    model: "gpt-4o-mini",
    type: "translation_reasoning",
    inputPricePer1M: 0.15,
    outputPricePer1M: 0.6,
  },
  {
    provider: "Google",
    model: "gemini-2.0-flash",
    type: "translation_reasoning",
    inputPricePer1M: 0.1,
    outputPricePer1M: 0.4,
  },
  {
    provider: "Google",
    model: "gemini-3.1-flash-lite-preview",
    type: "translation_reasoning",
    inputPricePer1M: { text: 0.25, audio: 0.5 },
    outputPricePer1M: 1.5,
  },
  {
    provider: "Replicate",
    model: "ryan5453/demucs",
    type: "source_separation",
    pricePerSecond: 0.0001,
    notes: "Demucs htdemucs for 2-stem separation.",
  },
  {
    provider: "ElevenLabs",
    model: "audio-isolation",
    type: "source_separation",
    pricePerMinuteInCredits: 1000,
  },
  {
    provider: "Google",
    model: "gemini-3.1-flash-tts-preview",
    type: "tts",
    inputPricePer1M: { text: 1.0 },
    outputPricePer1M: { audio: 20.0 },
    notes: "25 tokens per second of audio.",
  },
  {
    provider: "ElevenLabs",
    model: "eleven_flash_v2_5",
    type: "tts",
    pricePerCharInCredits: 0.5,
  },
  {
    provider: "OpenAI",
    model: "tts-1",
    type: "tts",
    pricePer1MChars: 15.0,
  },
  {
    provider: "Inworld",
    model: "inworld-tts-1.5-max",
    type: "tts",
    pricePer1MChars: 10.0,
  },
  {
    provider: "Smallest.ai",
    model: "lightning",
    type: "tts",
    approxPricePerMinute: 0.01,
  },
  {
    provider: "Sarvam.ai",
    model: "bulbul:v3",
    type: "tts",
    pricePer10KCharsInINR: 30,
    approxPricePer1MCharsUSD: 36.0,
  },
];

module.exports = {
  AI_API_PRICING,
};
