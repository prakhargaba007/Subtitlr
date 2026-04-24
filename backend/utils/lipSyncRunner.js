const path = require("path");
const { spawn } = require("child_process");

function parseOptionalInt(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

function parseBox(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const parts = s
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => Number.parseInt(p, 10));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  return parts;
}

function parsePads(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const parts = s
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => Number.parseInt(p, 10));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  return parts;
}

function envFlag(name, defaultValue = "0") {
  return String(process.env[name] ?? defaultValue).trim() === "1";
}

function envStr(name, fallback = "") {
  return String(process.env[name] ?? fallback).trim();
}

function runProcess(cmd, args, { cwd, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    const killTimer =
      timeoutMs && Number.isFinite(timeoutMs) && timeoutMs > 0
        ? setTimeout(() => {
            try {
              child.kill("SIGKILL");
            } catch {}
          }, timeoutMs)
        : null;

    child.stdout.on("data", (d) => {
      stdout += d.toString();
    });
    child.stderr.on("data", (d) => {
      stderr += d.toString();
    });

    child.on("error", (err) => {
      if (killTimer) clearTimeout(killTimer);
      err.stdout = stdout;
      err.stderr = stderr;
      reject(err);
    });

    child.on("close", (code) => {
      if (killTimer) clearTimeout(killTimer);
      if (code === 0) return resolve({ stdout, stderr });
      const err = new Error(`Lip-sync process failed (exit ${code}).`);
      err.code = code;
      err.stdout = stdout;
      err.stderr = stderr;
      reject(err);
    });
  });
}

/**
 * Runs lip-sync if enabled. Returns output path string, or null when disabled.
 *
 * V1 multi-face: Wav2Lip will naturally pick a dominant face in the frame. We expose
 * env knobs for future improvements (face selection/tracking), but keep behavior simple.
 */
exports.lipSyncVideo = async ({
  inputVideoPath,
  inputAudioPath,
  outputVideoPath,
}) => {
  const enabled = envFlag("LIPSYNC_ENABLED", "0");
  if (!enabled) return null;

  const provider = envStr("LIPSYNC_PROVIDER", "local");
  if (provider !== "local" && provider !== "cloud") {
    const err = new Error(`Invalid LIPSYNC_PROVIDER: ${provider}`);
    err.statusCode = 500;
    throw err;
  }

  if (provider === "cloud") {
    const err = new Error("LIPSYNC_PROVIDER=cloud is not implemented yet.");
    err.statusCode = 501;
    throw err;
  }

  const pythonBin = envStr("PYTHON_BIN", "python3");
  const wav2lipDir = envStr("WAV2LIP_DIR", "");
  const checkpoint = envStr("WAV2LIP_CHECKPOINT", "");

  if (!wav2lipDir || !checkpoint) {
    const err = new Error(
      "Lip-sync is enabled but WAV2LIP_DIR / WAV2LIP_CHECKPOINT are not set.",
    );
    err.statusCode = 500;
    throw err;
  }

  const inferencePy = path.join(wav2lipDir, "inference.py");
  const args = [
    inferencePy,
    "--checkpoint_path",
    checkpoint,
    "--face",
    inputVideoPath,
    "--audio",
    inputAudioPath,
    "--outfile",
    outputVideoPath,
  ];

  const faceDetBatch = parseOptionalInt(process.env.WAV2LIP_FACE_DET_BATCH);
  if (faceDetBatch != null) {
    args.push("--face_det_batch_size", String(faceDetBatch));
  }

  const pads = parsePads(process.env.WAV2LIP_PADS);
  if (pads) {
    args.push("--pads", pads.join(" "));
  }

  const box = parseBox(process.env.WAV2LIP_BOX);
  if (box) {
    args.push("--box", box.join(" "));
  }

  // Keep v1 behavior simple; env is reserved for later upgrades.
  const targetFace = envStr("LIPSYNC_TARGET_FACE", "auto_largest");
  const multiFaceBehavior = envStr(
    "LIPSYNC_MULTI_FACE_BEHAVIOR",
    "single_target",
  );
  void targetFace;
  void multiFaceBehavior;

  const timeoutMs =
    parseOptionalInt(process.env.LIPSYNC_TIMEOUT_MS) ?? 30 * 60 * 1000;

  await runProcess(pythonBin, args, { cwd: wav2lipDir, timeoutMs });
  return outputVideoPath;
};
