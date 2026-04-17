const Project = require("../models/Project");

/**
 * Create a Project row after a SubtitleJob is persisted. Idempotent on duplicate key.
 */
async function createProjectForSubtitleJob(userId, subtitleJobId) {
  try {
    await Project.create({
      user: userId,
      kind: "subtitle",
      subtitleJob: subtitleJobId,
    });
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
