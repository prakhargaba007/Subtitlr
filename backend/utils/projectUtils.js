const Project = require("../models/Project");

/**
 * Create a Project row after a SubtitleJob is persisted. Idempotent on duplicate key.
 * @param {string} userId
 * @param {import("mongoose").Types.ObjectId|string} subtitleJobId
 * @param {{ displayName?: string | null }} [options]
 */
async function createProjectForSubtitleJob(userId, subtitleJobId, options = {}) {
  try {
    const doc = {
      user: userId,
      kind: "subtitle",
      subtitleJob: subtitleJobId,
    };
    if (options.displayName && String(options.displayName).trim()) {
      doc.displayName = String(options.displayName).trim();
    }
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
    await Project.create({
      user: userId,
      kind: "dubbing",
      dubbingJob: dubbingJobId,
    });
  } catch (e) {
    if (e && e.code === 11000) return;
    throw e;
  }
}

module.exports = {
  createProjectForSubtitleJob,
  createProjectForDubbingJob,
};
