const READY_STATUSES = new Set(["completed", "done"]);

function normalizeJobStatus(status) {
  const value = String(status || "").toLowerCase();
  if (READY_STATUSES.has(value)) return "ready";
  if (value === "failed") return "failed";
  return "processing";
}

function buildProjectFilterFields(job) {
  return {
    jobStatus: normalizeJobStatus(job?.status),
    jobFileType: job?.fileType || null,
  };
}

module.exports = {
  buildProjectFilterFields,
  normalizeJobStatus,
};
