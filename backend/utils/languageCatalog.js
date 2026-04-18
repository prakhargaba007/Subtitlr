/**
 * Single source of truth for supported languages across subtitles (Whisper ASR),
 * dubbing TTS (Sarvam for Indic targets, Inworld catalog for others when using those pipelines),
 * and provider-specific code mapping.
 *
 * Subtitles: any entry in LANGUAGE_MAP with a resolvable ISO code is eligible for Whisper
 * (plus Hinglish handled in resolveLanguage). The frontend list is LANGUAGE_LIST.
 *
 * Dubbing: target languages we expose in the upload picker are the union of
 * - SARVAM_BCP47_MAP keys (Indic; dubbingController forces TTS to Sarvam when target matches), and
 * - INWORLD_LANG_CODE_MAP primary names (Inworld voice catalog; used when default TTS stack is Inworld).
 * Other TTS backends (ElevenLabs, OpenAI, Smallest) are selected via env and may support additional
 * targets; the picker stays aligned with explicit SARVAM + Inworld routing in code.
 */

// ─── Whisper / shared label → ISO 639-1 (same schema as legacy subtitleUtils) ─────

const LANGUAGE_MAP = {
  // A
  afrikaans: "af",
  af: "af",
  albanian: "sq",
  sq: "sq",
  amharic: "am",
  am: "am",
  arabic: "ar",
  ar: "ar",
  armenian: "hy",
  hy: "hy",
  azerbaijani: "az",
  az: "az",
  // B
  bashkir: "ba",
  ba: "ba",
  basque: "eu",
  eu: "eu",
  belarusian: "be",
  be: "be",
  bengali: "bn",
  bangla: "bn",
  bn: "bn",
  bosnian: "bs",
  bs: "bs",
  breton: "br",
  br: "br",
  bulgarian: "bg",
  bg: "bg",
  burmese: "my",
  myanmar: "my",
  my: "my",
  // C
  catalan: "ca",
  ca: "ca",
  chinese: "zh",
  mandarin: "zh",
  zh: "zh",
  croatian: "hr",
  hr: "hr",
  czech: "cs",
  cs: "cs",
  // D
  danish: "da",
  da: "da",
  dutch: "nl",
  nl: "nl",
  // E
  english: "en",
  en: "en",
  estonian: "et",
  et: "et",
  // F
  faroese: "fo",
  fo: "fo",
  finnish: "fi",
  fi: "fi",
  french: "fr",
  français: "fr",
  francais: "fr",
  fr: "fr",
  // G
  galician: "gl",
  gl: "gl",
  georgian: "ka",
  ka: "ka",
  german: "de",
  deutsch: "de",
  de: "de",
  greek: "el",
  el: "el",
  gujarati: "gu",
  gu: "gu",
  // H
  haitian: "ht",
  ht: "ht",
  hausa: "ha",
  ha: "ha",
  hawaiian: "haw",
  haw: "haw",
  hebrew: "he",
  he: "he",
  hindi: "hi",
  hi: "hi",
  hinglish: null,
  hungarian: "hu",
  hu: "hu",
  // I
  icelandic: "is",
  is: "is",
  indonesian: "id",
  id: "id",
  italian: "it",
  italiano: "it",
  it: "it",
  // J
  japanese: "ja",
  ja: "ja",
  javanese: "jw",
  jw: "jw",
  // K
  kannada: "kn",
  kn: "kn",
  kazakh: "kk",
  kk: "kk",
  khmer: "km",
  km: "km",
  korean: "ko",
  ko: "ko",
  // L
  lao: "lo",
  lo: "lo",
  latin: "la",
  la: "la",
  latvian: "lv",
  lv: "lv",
  lingala: "ln",
  ln: "ln",
  lithuanian: "lt",
  lt: "lt",
  luxembourgish: "lb",
  lb: "lb",
  // M
  macedonian: "mk",
  mk: "mk",
  malagasy: "mg",
  mg: "mg",
  malay: "ms",
  ms: "ms",
  malayalam: "ml",
  ml: "ml",
  maltese: "mt",
  mt: "mt",
  maori: "mi",
  mi: "mi",
  marathi: "mr",
  mr: "mr",
  mongolian: "mn",
  mn: "mn",
  // N
  nepali: "ne",
  ne: "ne",
  norwegian: "no",
  no: "no",
  // O
  occitan: "oc",
  oc: "oc",
  odia: "or",
  oriya: "or",
  or: "or",
  // P
  pashto: "ps",
  ps: "ps",
  persian: "fa",
  farsi: "fa",
  fa: "fa",
  polish: "pl",
  pl: "pl",
  portuguese: "pt",
  português: "pt",
  portugues: "pt",
  pt: "pt",
  punjabi: "pa",
  pa: "pa",
  // R
  romanian: "ro",
  ro: "ro",
  russian: "ru",
  ru: "ru",
  // S
  sanskrit: "sa",
  sa: "sa",
  serbian: "sr",
  sr: "sr",
  shona: "sn",
  sn: "sn",
  sindhi: "sd",
  sd: "sd",
  sinhala: "si",
  si: "si",
  slovak: "sk",
  sk: "sk",
  slovenian: "sl",
  sl: "sl",
  somali: "so",
  so: "so",
  spanish: "es",
  español: "es",
  espanol: "es",
  es: "es",
  sundanese: "su",
  su: "su",
  swahili: "sw",
  sw: "sw",
  swedish: "sv",
  sv: "sv",
  // T
  tagalog: "tl",
  filipino: "tl",
  tl: "tl",
  tajik: "tg",
  tg: "tg",
  tamil: "ta",
  ta: "ta",
  tatar: "tt",
  tt: "tt",
  telugu: "te",
  te: "te",
  thai: "th",
  th: "th",
  tibetan: "bo",
  bo: "bo",
  turkish: "tr",
  tr: "tr",
  turkmen: "tk",
  tk: "tk",
  // U
  ukrainian: "uk",
  uk: "uk",
  urdu: "ur",
  ur: "ur",
  uzbek: "uz",
  uz: "uz",
  // V
  vietnamese: "vi",
  vi: "vi",
  // W
  welsh: "cy",
  cy: "cy",
  // Y
  yiddish: "yi",
  yi: "yi",
  yoruba: "yo",
  yo: "yo",
  // Z
  zulu: "zu",
  zu: "zu",
};

/** Target language → Inworld `langCode` (voice catalog). Aliases for resolveInworldLangCode. */
const INWORLD_LANG_CODE_MAP = {
  hindi: "HI_IN",
  hi: "HI_IN",
  "hi-in": "HI_IN",

  english: "EN_US",
  en: "EN_US",
  "en-us": "EN_US",
  "en-gb": "EN_US",

  german: "DE_DE",
  deutsch: "DE_DE",
  de: "DE_DE",
  "de-de": "DE_DE",

  spanish: "ES_ES",
  español: "ES_ES",
  espanol: "ES_ES",
  es: "ES_ES",
  "es-es": "ES_ES",
  "es-mx": "ES_ES",

  french: "FR_FR",
  français: "FR_FR",
  francais: "FR_FR",
  fr: "FR_FR",
  "fr-fr": "FR_FR",

  italian: "IT_IT",
  italiano: "IT_IT",
  it: "IT_IT",
  "it-it": "IT_IT",

  japanese: "JA_JP",
  ja: "JA_JP",
  "ja-jp": "JA_JP",

  korean: "KO_KR",
  ko: "KO_KR",
  "ko-kr": "KO_KR",

  portuguese: "PT_BR",
  português: "PT_BR",
  portugues: "PT_BR",
  pt: "PT_BR",
  "pt-br": "PT_BR",

  russian: "RU_RU",
  ru: "RU_RU",
  "ru-ru": "RU_RU",

  chinese: "ZH_CN",
  mandarin: "ZH_CN",
  zh: "ZH_CN",
  "zh-cn": "ZH_CN",

  arabic: "AR_SA",
  ar: "AR_SA",
  "ar-sa": "AR_SA",

  dutch: "NL_NL",
  nl: "NL_NL",
  "nl-nl": "NL_NL",

  polish: "PL_PL",
  pl: "PL_PL",
  "pl-pl": "PL_PL",

  hebrew: "HE_IL",
  he: "HE_IL",
  "he-il": "HE_IL",
};

/** Sarvam TTS: English name → BCP-47 `target_language_code`. Dubbing uses Sarvam when target matches these keys. */
const SARVAM_BCP47_MAP = {
  hindi: "hi-IN",
  bengali: "bn-IN",
  gujarati: "gu-IN",
  kannada: "kn-IN",
  malayalam: "ml-IN",
  marathi: "mr-IN",
  odia: "or-IN",
  punjabi: "pa-IN",
  tamil: "ta-IN",
  telugu: "te-IN",
};

/** Canonical labels (LANGUAGE_MAP keys) that route to Inworld in the voice catalog. */
const INWORLD_CANONICAL_LANG_KEYS = [
  "hindi",
  "english",
  "german",
  "spanish",
  "french",
  "italian",
  "japanese",
  "korean",
  "portuguese",
  "russian",
  "chinese",
  "arabic",
  "dutch",
  "polish",
  "hebrew",
];

const capitalizeLabel = (key) => key.charAt(0).toUpperCase() + key.slice(1);

/**
 * Same algorithm as legacy LANGUAGE_LIST: one row per language for the subtitle picker.
 * @returns {Array<{ value: string, label: string, isoCode: string | null, subtitleAsr: 'whisper' }>}
 */
const buildSubtitleLanguageList = () => {
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
      label: capitalizeLabel(key),
      isoCode,
      subtitleAsr: "whisper",
    });
  }

  list.sort((a, b) => a.label.localeCompare(b.label));
  return list;
};

const LANGUAGE_LIST = buildSubtitleLanguageList();

/**
 * Dubbing upload picker: Sarvam targets + Inworld-catalog targets (minus Hindi from Inworld list; Hindi is Sarvam-only here).
 * @returns {Array<{ value: string, label: string, isoCode: string | null, dubbingTts: 'sarvam' | 'inworld' }>}
 */
const buildDubbingLanguageList = () => {
  const byValue = new Map();

  for (const key of Object.keys(SARVAM_BCP47_MAP)) {
    byValue.set(key, {
      value: key,
      label: capitalizeLabel(key),
      isoCode: LANGUAGE_MAP[key] ?? null,
      dubbingTts: "sarvam",
    });
  }

  for (const key of INWORLD_CANONICAL_LANG_KEYS) {
    if (key === "hindi") continue;
    if (byValue.has(key)) continue;
    byValue.set(key, {
      value: key,
      label: capitalizeLabel(key),
      isoCode: LANGUAGE_MAP[key] ?? null,
      dubbingTts: "inworld",
    });
  }

  const list = Array.from(byValue.values());
  list.sort((a, b) => a.label.localeCompare(b.label));
  return list;
};

const DUBBING_LANGUAGE_LIST = buildDubbingLanguageList();

module.exports = {
  LANGUAGE_MAP,
  LANGUAGE_LIST,
  INWORLD_LANG_CODE_MAP,
  SARVAM_BCP47_MAP,
  INWORLD_CANONICAL_LANG_KEYS,
  buildSubtitleLanguageList,
  buildDubbingLanguageList,
  DUBBING_LANGUAGE_LIST,
};
