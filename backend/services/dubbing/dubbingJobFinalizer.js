const DubbingJob = require("../../models/DubbingJob");
const User = require("../../models/User");
const { deductCredits } = require("../../utils/creditUtils");
const {
  confirmDubbingUsage,
  refundDubbingUsage,
} = require("../../utils/usageService");
const {
  refreshProjectFilterFieldsForDubbingJob,
} = require("../../utils/projectUtils");
const {
  sendDubbingCompletedEmail,
} = require("../../utils/dubbingCompletionEmail");

async function confirmUsageIfReserved({
  userId,
  jobId,
  reservedSeconds,
  processedSeconds,
  usageReserved,
}) {
  if (!usageReserved) return;
  await confirmDubbingUsage(
    userId,
    jobId,
    reservedSeconds,
    processedSeconds,
  ).catch((e) =>
    console.warn("[dubbing] Usage confirm failed (non-fatal):", e.message),
  );
}

async function deductDubbingCredits({
  userId,
  creditsNeeded,
  fileName,
  fileType,
  sourceLanguage,
  targetLanguage,
  duration,
  jobId,
  sourceJobId,
}) {
  await deductCredits(
    userId,
    creditsNeeded,
    "dubbing_job",
    `Dubbed ${fileName} → ${targetLanguage} (${creditsNeeded} credits)`,
    {
      fileName,
      fileType,
      sourceLanguage: sourceLanguage || "auto",
      targetLanguage,
      duration,
      jobId,
      ...(sourceJobId ? { sourceJobId } : {}),
    },
  );
}

async function sendCompletionEmailIfNeeded(userId, finalJob) {
  try {
    const alreadySent = Boolean(finalJob?.completionEmailSentAt);
    if (alreadySent) return;

    const user = await User.findById(userId)
      .select("email preferences.emailNotifications")
      .lean();
    const emailOk =
      Boolean(user?.email) &&
      user?.preferences?.emailNotifications !== false;
    if (!emailOk) return;

    await sendDubbingCompletedEmail({
      email: user.email,
      jobId: finalJob._id.toString(),
      fileName: finalJob.originalFileName,
      targetLanguage: finalJob.targetLanguage,
    });
    await DubbingJob.findByIdAndUpdate(finalJob._id, {
      completionEmailSentAt: new Date(),
    }).catch(() => {});
  } catch (e) {
    console.warn("[dubbing] completion email failed (non-fatal):", e.message);
  }
}

async function markJobFailed({ job, error }) {
  if (!job) return;
  await DubbingJob.findByIdAndUpdate(job._id, {
    status: "failed",
    error: error.message || "Unknown error",
  }).catch(() => {});
  await refreshProjectFilterFieldsForDubbingJob(job._id, {
    status: "failed",
    fileType: job.fileType,
  }).catch(() => {});
}

async function refundReservedUsageOnFailure({
  userId,
  job,
  reservedSeconds,
  usageReserved,
}) {
  if (!usageReserved || !reservedSeconds) return;
  const processedSec =
    job && job.processedSeconds != null ? job.processedSeconds : 0;
  await refundDubbingUsage(
    userId,
    job?._id ?? "unknown",
    reservedSeconds,
    processedSec,
  ).catch((e) =>
    console.warn("[dubbing] Usage refund failed (non-fatal):", e.message),
  );
}

async function refreshCompletedJob(finalJob) {
  if (!finalJob?._id) return;
  await refreshProjectFilterFieldsForDubbingJob(finalJob._id, finalJob).catch(
    () => {},
  );
}

module.exports = {
  confirmUsageIfReserved,
  deductDubbingCredits,
  markJobFailed,
  refreshCompletedJob,
  refundReservedUsageOnFailure,
  sendCompletionEmailIfNeeded,
};
