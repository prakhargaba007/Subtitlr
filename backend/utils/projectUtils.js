const Project = require("../models/Project");
const SubtitleJob = require("../models/Subtitle");
const DubbingJob = require("../models/DubbingJob");
const { buildProjectSearchDocument } = require("./projectSearch");

/**
 * Create a Project row after a SubtitleJob is persisted. Idempotent on duplicate key.
 * @param {string} userId
 * @param {import("mongoose").Types.ObjectId|string} subtitleJobId
 * @param {{ displayName?: string | null }} [options]
 */
async function createProjectForSubtitleJob(userId, subtitleJobId, options = {}) {
  try {
    const job = await SubtitleJob.findById(subtitleJobId)
      .select("originalFileName fileType status language")
      .lean();
    const doc = {
      user: userId,
      kind: "subtitle",
      subtitleJob: subtitleJobId,
    };
    if (options.displayName && String(options.displayName).trim()) {
      doc.displayName = String(options.displayName).trim();
    }
    Object.assign(doc, buildProjectSearchDocument(doc, job));
    await Project.create(doc);
  } catch (e) {
    if (e && e.code === 11000) return;
    throw e;
  }
}

/**
 * Create a Project row after a DubbingJob is persisted. Idempotent on duplicate key.
 */
async function createProjectForDubbingJob(userId, dubbingJobId) {
  try {
    const job = await DubbingJob.findById(dubbingJobId)
      .select("originalFileName fileType status sourceLanguage targetLanguage")
      .lean();
    const doc = {
      user: userId,
      kind: "dubbing",
      dubbingJob: dubbingJobId,
    };
    Object.assign(doc, buildProjectSearchDocument(doc, job));
    await Project.create(doc);
  } catch (e) {
    if (e && e.code === 11000) return;
    throw e;
  }
}

module.exports = {
  createProjectForSubtitleJob,
  createProjectForDubbingJob,
};
