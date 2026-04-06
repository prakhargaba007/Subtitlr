const fs = require("fs");
const path = require("path");

const defaultBaseDir = () => path.join(__dirname, "..", "dubbing-output");

/**
 * Root directory for per-job dubbing artifacts (override with DUBBING_LOCAL_OUTPUT_DIR).
 * Each job gets a subfolder named by Mongo job id.
 */
const getDubbingOutputBaseDir = () => {
  const fromEnv = String(process.env.DUBBING_LOCAL_OUTPUT_DIR || "").trim();
  return fromEnv ? path.resolve(fromEnv) : defaultBaseDir();
};

/**
 * Absolute path to the folder where all artifacts for this job are copied.
 * @param {string} jobId - DubbingJob _id string
 */
const getJobOutputDir = (jobId) => path.join(getDubbingOutputBaseDir(), String(jobId));

/**
 * Copy a file into the job output tree. Creates parent directories as needed.
 * @param {string} jobId
 * @param {string} relativePath - e.g. "tts_raw/segment_001.mp3"
 * @param {string} srcPath - existing file on disk
 * @returns {string|null} absolute destination path, or null if skipped
 */
const saveArtifact = (jobId, relativePath, srcPath) => {
  if (!srcPath || typeof srcPath !== "string") return null;
  if (!fs.existsSync(srcPath)) return null;
  const stat = fs.statSync(srcPath);
  if (!stat.isFile()) return null;

  const dest = path.join(getJobOutputDir(jobId), relativePath);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(srcPath, dest);
  return dest;
};

module.exports = {
  getDubbingOutputBaseDir,
  getJobOutputDir,
  saveArtifact,
};
