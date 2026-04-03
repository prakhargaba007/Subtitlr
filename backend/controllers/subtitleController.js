const fs = require("fs");
const path = require("path");
const os = require("os");
const { v4: uuidv4 } = require("uuid");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegStatic = require("ffmpeg-static");
const ffprobeInstaller = require("@ffprobe-installer/ffprobe");
const OpenAI = require("openai");
const mongoose = require("mongoose");

ffmpeg.setFfmpegPath(ffmpegStatic);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

const SubtitleJob = require("../models/Subtitle");
const User = require("../models/User");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Whisper hard limit is 25 MB — keep chunks safely below it
const WHISPER_MAX_BYTES = 24 * 1024 * 1024;

// ─── Language Map ─────────────────────────────────────────────────────────────
// Maps human-readable names (and ISO codes) → ISO 639-1 code for Whisper.
// null means "omit the language param" → Whisper auto-detects (best for
// code-switching languages like Hinglish).

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Resolve a user-supplied language string to an ISO 639-1 code.
 * Returns { isoCode: string|null, label: string }
 * isoCode === null  →  omit from Whisper call (auto-detect)
 */
/**
 * Resolve a user-supplied language string to an ISO 639-1 code.
 * Returns { isoCode: string|null, label: string }
 * isoCode === null  →  omit from Whisper call (auto-detect)
 */
const resolveLanguage = (input) => {
  if (!input || input.trim() === "") {
    return { isoCode: null, label: "auto" };
  }
  const key = input.toLowerCase().trim();

  if (key === "hinglish") {
    // Transcribe as Hindi (accurate Devanagari), then transliterate to Roman
    return { isoCode: "hi", label: "hinglish" };
  }

  if (key in LANGUAGE_MAP) {
    const isoCode = LANGUAGE_MAP[key];
    return { isoCode, label: isoCode ?? "auto" };
  }
  return { isoCode: key, label: key };
};

/**
 * Post-process: transliterate Devanagari segments to Roman Hinglish via GPT.
 * Sends all segment texts in one request for efficiency.
 */
const transliterateToHinglish = async (segments) => {
  if (!segments.length) return segments;

  const texts = segments.map((s) => s.text);

  const response = await openai.chat.completions.create({
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

const getFileDuration = (filePath) =>
  new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata.format.duration || 0);
    });
  });

const convertVideoToMp3 = (inputPath, outputPath) =>
  new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .noVideo()
      .audioCodec("libmp3lame")
      .audioBitrate(128)
      .output(outputPath)
      .on("end", resolve)
      .on("error", reject)
      .run();
  });

/**
 * Split an audio file into fixed-duration chunks.
 * Returns an array of absolute paths to the chunk files.
 */
const splitAudioIntoChunks = (inputPath, outputDir, segmentSeconds) =>
  new Promise((resolve, reject) => {
    const pattern = path.join(outputDir, "chunk_%03d.mp3");
    ffmpeg(inputPath)
      .audioCodec("libmp3lame")
      .audioBitrate(128)
      .outputOptions([
        "-f segment",
        `-segment_time ${segmentSeconds}`,
        "-reset_timestamps 1",
      ])
      .output(pattern)
      .on("end", () => {
        const files = fs
          .readdirSync(outputDir)
          .filter((f) => f.startsWith("chunk_"))
          .sort()
          .map((f) => path.join(outputDir, f));
        resolve(files);
      })
      .on("error", reject)
      .run();
  });

/** Call Whisper on a single local file. */
const transcribeFile = async (filePath, languageCode) => {
  const params = {
    file: fs.createReadStream(filePath),
    model: "whisper-1",
    response_format: "verbose_json",
    timestamp_granularities: ["segment"],
  };
  if (languageCode) params.language = languageCode;
  return openai.audio.transcriptions.create(params);
};

/** Shift all segment timestamps by offsetSeconds (for merging chunked results). */
const shiftSegments = (segments, offsetSeconds) =>
  segments.map((s) => ({
    start: s.start + offsetSeconds,
    end: s.end + offsetSeconds,
    text: s.text.trim(),
  }));

/** Safely delete a path (file or directory). Swallows errors. */
const cleanupPath = (p) => {
  try {
    if (!fs.existsSync(p)) return;
    const stat = fs.statSync(p);
    if (stat.isDirectory()) {
      fs.rmSync(p, { recursive: true, force: true });
    } else {
      fs.unlinkSync(p);
    }
  } catch (_) {}
};

// ─── Subtitle Generators ─────────────────────────────────────────────────────

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

// ─── Controllers ──────────────────────────────────────────────────────────────

exports.generateSubtitles = async (req, res, next) => {
  console.log("generateSubtitles endpoint called");

  // ── SSE setup ──────────────────────────────────────────────────────────────
  // We stream progress events back to the client over the same POST connection.
  // The client should read the response body as a stream and parse SSE frames.
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("X-Accel-Buffering", "no"); // disable nginx buffering if present
  res.flushHeaders();

  /** Emit one SSE event. `data` must be JSON-serialisable. */
  const emit = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const tmpPaths = [];

  try {
    if (!req.file) {
      emit({ stage: "error", message: "No file uploaded.", statusCode: 422 });
      return res.end();
    }

    emit({ stage: "validating", message: "Checking file and credits…" });

    const { isoCode, label: langLabel } = resolveLanguage(req.body.language);

    // Write uploaded buffer to a temp file so ffprobe / ffmpeg can read it
    const ext = path.extname(req.file.originalname) || ".tmp";
    const tmpInput = path.join(os.tmpdir(), `sub_input_${uuidv4()}${ext}`);
    fs.writeFileSync(tmpInput, req.file.buffer);
    tmpPaths.push(tmpInput);

    // Determine duration before anything else so we can credit-check early
    const duration = await getFileDuration(tmpInput);
    const creditsNeeded = Math.ceil(duration / 60);

    const user = await User.findById(req.userId);
    if (!user) {
      emit({ stage: "error", message: "User not found.", statusCode: 404 });
      return res.end();
    }

    const currentCredits = user.credits ?? 0;
    if (currentCredits < creditsNeeded) {
      emit({
        stage: "error",
        message: `Insufficient credits. You need ${creditsNeeded} credit(s) but have ${currentCredits}.`,
        statusCode: 402,
      });
      return res.end();
    }

    const isVideo = req.file.mimetype.startsWith("video/");
    let audioPath = tmpInput;

    if (isVideo) {
      emit({ stage: "extracting", message: "Extracting audio from video…" });
      const tmpMp3 = path.join(os.tmpdir(), `sub_audio_${uuidv4()}.mp3`);
      tmpPaths.push(tmpMp3);
      await convertVideoToMp3(tmpInput, tmpMp3);
      audioPath = tmpMp3;
    }

    // ── Transcribe (with chunking if file exceeds Whisper's 25 MB limit) ──
    const audioSize = fs.statSync(audioPath).size;
    let allSegments = [];

    if (audioSize > WHISPER_MAX_BYTES) {
      const bytesPerSecond = audioSize / duration;
      const chunkSeconds = Math.floor((20 * 1024 * 1024) / bytesPerSecond);

      const chunkDir = path.join(os.tmpdir(), `sub_chunks_${uuidv4()}`);
      fs.mkdirSync(chunkDir, { recursive: true });
      tmpPaths.push(chunkDir);

      emit({ stage: "transcribing", message: "Splitting audio into chunks…" });
      const chunkFiles = await splitAudioIntoChunks(audioPath, chunkDir, chunkSeconds);
      const totalChunks = chunkFiles.length;

      let timeOffset = 0;
      for (let i = 0; i < chunkFiles.length; i++) {
        emit({
          stage: "transcribing",
          message: `Transcribing part ${i + 1} of ${totalChunks}…`,
          progress: Math.round(((i) / totalChunks) * 100),
          chunk: i + 1,
          totalChunks,
        });
        const result = await transcribeFile(chunkFiles[i], isoCode);
        allSegments.push(...shiftSegments(result.segments || [], timeOffset));
        const chunkDur = await getFileDuration(chunkFiles[i]);
        timeOffset += chunkDur;
      }
    } else {
      emit({ stage: "transcribing", message: "Transcribing audio…", progress: 0 });
      const result = await transcribeFile(audioPath, isoCode);
      allSegments = (result.segments || []).map((s) => ({
        start: s.start,
        end: s.end,
        text: s.text.trim(),
      }));
    }

    // For Hinglish: transliterate Devanagari → Roman script via GPT
    if (langLabel === "hinglish") {
      emit({ stage: "transliterating", message: "Converting to Hinglish script…" });
      allSegments = await transliterateToHinglish(allSegments);
    }

    emit({ stage: "saving", message: "Saving results…" });

    const transcription = allSegments.map((s) => s.text).join(" ");

    // Deduct credits atomically
    await User.findByIdAndUpdate(req.userId, {
      $inc: { credits: -creditsNeeded },
    });

    const job = await SubtitleJob.create({
      user: req.userId,
      originalFileName: req.file.originalname,
      fileType: isVideo ? "video" : "audio",
      duration,
      creditsUsed: creditsNeeded,
      status: "completed",
      language: langLabel,
      transcription,
      segments: allSegments,
    });

    emit({
      stage: "done",
      message: "Subtitles generated successfully.",
      job,
      creditsRemaining: currentCredits - creditsNeeded,
    });

    res.end();
  } catch (err) {
    // Try to send the error over SSE; if headers were already sent we can't
    // call next(), so we emit and close instead.
    try {
      emit({
        stage: "error",
        message: err.message || "An unexpected error occurred.",
        statusCode: err.statusCode || 500,
      });
      res.end();
    } catch (_) {
      if (!err.statusCode) err.statusCode = 500;
      next(err);
    }
  } finally {
    tmpPaths.forEach(cleanupPath);
  }
};

exports.exportSubtitles = async (req, res, next) => {
  try {
    const format = (req.query.format || "srt").toLowerCase();

    if (!["srt", "vtt", "ass"].includes(format)) {
      const err = new Error('Invalid format. Supported values: srt, vtt, ass.');
      err.statusCode = 422;
      throw err;
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      const err = new Error("Subtitle job not found.");
      err.statusCode = 404;
      throw err;
    }

    const job = await SubtitleJob.findById(req.params.id);
    if (!job) {
      const err = new Error("Subtitle job not found.");
      err.statusCode = 404;
      throw err;
    }
    if (job.user.toString() !== req.userId) {
      const err = new Error("Access denied.");
      err.statusCode = 403;
      throw err;
    }
    if (job.status !== "completed" || job.segments.length === 0) {
      const err = new Error("No subtitle data available for this job.");
      err.statusCode = 409;
      throw err;
    }

    const baseName = path.basename(
      job.originalFileName,
      path.extname(job.originalFileName)
    );
    const fileName = `${baseName}.${format}`;

    let content;
    if (format === "srt") content = generateSRT(job.segments);
    else if (format === "vtt") content = generateVTT(job.segments);
    else content = generateASS(job.segments);

    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.send(content);
  } catch (err) {
    if (!err.statusCode) err.statusCode = 500;
    next(err);
  }
};

exports.getSubtitleJobs = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 10);
    const skip = (page - 1) * limit;

    const [jobs, total] = await Promise.all([
      SubtitleJob.find({ user: req.userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select("-segments"), // segments can be large; omit from list view
      SubtitleJob.countDocuments({ user: req.userId }),
    ]);

    res.json({
      jobs,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
};

exports.getSubtitleJob = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      const err = new Error("Subtitle job not found.");
      err.statusCode = 404;
      throw err;
    }

    const job = await SubtitleJob.findById(req.params.id);
    if (!job) {
      const err = new Error("Subtitle job not found.");
      err.statusCode = 404;
      throw err;
    }
    if (job.user.toString() !== req.userId) {
      const err = new Error("Access denied.");
      err.statusCode = 403;
      throw err;
    }
    res.json({ job });
  } catch (err) {
    if (!err.statusCode) err.statusCode = 500;
    next(err);
  }
};

exports.getUserCredits = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).select("credits name email");
    if (!user) {
      const err = new Error("User not found.");
      err.statusCode = 404;
      throw err;
    }
    res.json({ credits: user.credits ?? 0 });
  } catch (err) {
    next(err);
  }
};
