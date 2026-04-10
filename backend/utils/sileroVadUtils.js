const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { v4: uuidv4 } = require("uuid");
const ffmpegStatic = require("ffmpeg-static");

const { extractAudioWindow, cleanupPath } = require("./audioUtils");
const { shiftSegments } = require("./subtitleUtils");

const DEFAULT_SCRIPT = path.join(__dirname, "../scripts/silero_vad_timeline.py");

const isSubtitleSileroVadEnabled = () => {
  const v = (process.env.SUBTITLE_USE_SILERO_VAD || "").toLowerCase();
  return v === "1" || v === "true" || v === "yes";
};

/** `full_audio` = Whisper on full file + VAD refines; `clips` = transcribe speech slices only */
const getSubtitleVadTranscribeMode = () => {
  const m = (process.env.SUBTITLE_VAD_TRANSCRIBE_MODE || "full_audio").toLowerCase().trim();
  return m === "clips" ? "clips" : "full_audio";
};

const getSileroPythonBin = () =>
  process.env.SILERO_PYTHON || process.env.PYTHON_BIN || "python3";

const getSileroVadScriptPath = () => process.env.SILERO_VAD_SCRIPT || DEFAULT_SCRIPT;

const numEnv = (key, fallback) => {
  const n = Number(process.env[key]);
  return Number.isFinite(n) ? n : fallback;
};

/**
 * @param {string} audioPath any format ffmpeg decodes
 * @param {string} workDir temp dir (caller-owned)
 * @returns {{ duration: number, intervals: { type: string, start: number, end: number }[] }}
 */
const runSileroVadScript = (audioPath, workDir) => {
  const py = getSileroPythonBin();
  const script = getSileroVadScriptPath();
  const args = [
    script,
    audioPath,
    "--work-dir",
    workDir,
    "--threshold",
    String(numEnv("SILERO_VAD_THRESHOLD", 0.45)),
    "--min-speech-ms",
    String(Math.round(numEnv("SILERO_VAD_MIN_SPEECH_MS", 300))),
    "--min-silence-ms",
    String(Math.round(numEnv("SILERO_VAD_MIN_SILENCE_MS", 200))),
    "--speech-pad-ms",
    String(Math.round(numEnv("SILERO_VAD_SPEECH_PAD_MS", 100))),
    "--min-output-speech-ms",
    String(Math.round(numEnv("SILERO_VAD_MIN_OUTPUT_SPEECH_MS", 200))),
    "--extra-pad-ms",
    String(Math.round(numEnv("SILERO_VAD_EXTRA_PAD_MS", 40))),
  ];
  const pyMergeMs = Number(process.env.SILERO_VAD_PYTHON_MERGE_GAP_MS);
  if (Number.isFinite(pyMergeMs)) {
    args.push("--merge-gap-ms", String(Math.round(pyMergeMs)));
  }
  const neg = process.env.SILERO_VAD_NEG_THRESHOLD;
  if (neg !== undefined && neg !== "" && Number.isFinite(Number(neg))) {
    args.push("--neg-threshold", String(Number(neg)));
  }
  const r = spawnSync(py, args, {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    windowsHide: true,
    env: { ...process.env, FFMPEG_BINARY: ffmpegStatic },
  });
  if (r.error) throw r.error;
  if (r.status !== 0) {
    const err = (r.stderr || "").trim() || `exit ${r.status}`;
    throw new Error(`Silero VAD failed: ${err}`);
  }
  const lines = (r.stdout || "").trim().split(/\r?\n/).filter(Boolean);
  const line = lines[lines.length - 1];
  if (!line) throw new Error("Silero VAD: empty stdout");
  const data = JSON.parse(line);
  if (data.error) throw new Error(data.error);
  if (!Array.isArray(data.intervals)) throw new Error("Silero VAD: invalid JSON (missing intervals)");
  return {
    duration: Number(data.duration) || 0,
    intervals: data.intervals,
  };
};

const mergeSpeechGaps = (speechIntervals, maxGapSec) => {
  if (!speechIntervals.length) return [];
  const sorted = [...speechIntervals].sort((a, b) => a.start - b.start);
  const out = [{ start: sorted[0].start, end: sorted[0].end }];
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i];
    const last = out[out.length - 1];
    if (cur.start - last.end <= maxGapSec) {
      last.end = Math.max(last.end, cur.end);
    } else {
      out.push({ start: cur.start, end: cur.end });
    }
  }
  return out;
};

const speechIntervalsFromTimeline = (intervals) =>
  intervals
    .filter((x) => x.type === "speech")
    .map(({ start, end }) => ({ start: Number(start), end: Number(end) }));

const overlapLen = (a0, a1, b0, b1) => {
  const lo = Math.max(a0, b0);
  const hi = Math.min(a1, b1);
  return hi > lo ? hi - lo : 0;
};

const segmentSpeechOverlap = (s, e, speechRanges) => {
  let o = 0;
  for (const r of speechRanges) {
    o += overlapLen(s, e, r.start, r.end);
  }
  return o;
};

/**
 * Drop Whisper cues that mostly fall in VAD silence (hallucination control).
 * If there are no speech intervals, returns segments unchanged.
 *
 * @param {{ start: number, end: number, text?: string }[]} segments
 * @param {{ type: string, start: number, end: number }[]} intervals
 * @param {{ minOverlap?: number, preserveSegmentFields?: boolean }} [opts]
 */
const refineSegmentsWithVadTimeline = (segments, intervals, opts = {}) => {
  const minOverlap = Number.isFinite(opts.minOverlap)
    ? opts.minOverlap
    : numEnv("SUBTITLE_VAD_MIN_SPEECH_OVERLAP", 0.35);
  const preserve = !!opts.preserveSegmentFields;
  const speech = speechIntervalsFromTimeline(intervals);
  const pack = (seg, s, e, text) => {
    const base = { start: s, end: e, text };
    return preserve ? { ...seg, ...base } : base;
  };

  if (!speech.length) {
    return segments.map((seg) =>
      pack(seg, Number(seg.start), Number(seg.end), (seg.text || "").trim())
    );
  }

  const out = [];
  for (const seg of segments) {
    const s = Number(seg.start);
    const e = Number(seg.end);
    const dur = e - s;
    if (dur <= 0) continue;
    const ratio = segmentSpeechOverlap(s, e, speech) / dur;
    if (ratio >= minOverlap) {
      out.push(pack(seg, s, e, (seg.text || "").trim()));
    }
  }
  return out;
};

const splitIntervalByMaxDuration = (start, end, maxDur) => {
  const span = end - start;
  if (maxDur <= 0 || span <= maxDur + 1e-6) return [{ start, end }];
  const parts = [];
  let t = start;
  while (t < end - 1e-6) {
    const e = Math.min(end, t + maxDur);
    parts.push({ start: t, end: e });
    t = e;
  }
  return parts;
};

/**
 * @param {string} audioPath
 * @param {string} tmpDir
 * @returns {Promise<{ duration: number, intervals: { type: string, start: number, end: number }[] }>}
 */
const detectSileroVadTimeline = async (audioPath, tmpDir) => {
  fs.mkdirSync(tmpDir, { recursive: true });
  return runSileroVadScript(audioPath, tmpDir);
};

/**
 * Speech-only transcription: VAD → extract clips → Whisper per clip → absolute timeline.
 *
 * @param {object} opts
 * @param {string} opts.audioPath
 * @param {number} opts.duration
 * @param {number} opts.audioSize
 * @param {(clipPath: string) => Promise<{ segments?: { start: number, end: number, text?: string }[] }>} opts.transcribeClip
 * @param {(p: string) => void} opts.registerTmp
 * @param {(index: number, total: number) => void} [opts.onClipProgress]
 * @returns {Promise<{ start: number, end: number, text: string }[]|null>} null → no speech detected (caller should fall back)
 */
const transcribeWithVadPipeline = async ({
  audioPath,
  duration,
  audioSize,
  transcribeClip,
  registerTmp,
  onClipProgress,
}) => {
  const tmpRoot = path.join(os.tmpdir(), `sub_vad_${uuidv4()}`);
  fs.mkdirSync(tmpRoot, { recursive: true });
  registerTmp(tmpRoot);

  try {
    const timeline = await detectSileroVadTimeline(audioPath, tmpRoot);
    const maxGapSec = numEnv("SILERO_VAD_MERGE_GAP_SEC", 0.05);
    const speechMerged = mergeSpeechGaps(speechIntervalsFromTimeline(timeline.intervals), maxGapSec);

    if (!speechMerged.length) {
      return null;
    }

    const bytesPerSecond = audioSize / Math.max(duration, 0.001);
    const targetBytes = 20 * 1024 * 1024;
    const maxClipDuration = Math.max(30, (targetBytes / bytesPerSecond) * 0.92);

    const clipJobs = [];
    for (const seg of speechMerged) {
      clipJobs.push(...splitIntervalByMaxDuration(seg.start, seg.end, maxClipDuration));
    }

    const allSegments = [];
    for (let i = 0; i < clipJobs.length; i++) {
      const job = clipJobs[i];
      if (onClipProgress) onClipProgress(i + 1, clipJobs.length);
      const slicePath = path.join(tmpRoot, `speech_${String(i + 1).padStart(4, "0")}.mp3`);
      await extractAudioWindow(audioPath, slicePath, job.start, job.end - job.start);
      const result = await transcribeClip(slicePath);
      const raw = (result.segments || []).map((s) => ({
        start: s.start,
        end: s.end,
        text: (s.text || "").trim(),
      }));
      allSegments.push(...shiftSegments(raw, job.start));
    }

    allSegments.sort((a, b) => a.start - b.start || a.end - b.end);
    return allSegments.filter((s) => s.text.length > 0);
  } finally {
    cleanupPath(tmpRoot);
  }
};

module.exports = {
  isSubtitleSileroVadEnabled,
  getSubtitleVadTranscribeMode,
  detectSileroVadTimeline,
  transcribeWithVadPipeline,
  refineSegmentsWithVadTimeline,
};
