/**
 * workers/stuckJobReaper.js
 *
 * Crash recovery worker for dubbing jobs.
 *
 * Problem:
 *   If the server process dies while a job is "pending" or any active status,
 *   the job stays stuck forever and the user's quota reservation is never released.
 *
 * Solution:
 *   Periodically scan for jobs that have been in an active status past a
 *   configurable timeout. Mark them as "failed" and refund the reserved usage.
 *
 * Usage — start as a standalone cron or import and call startReaper():
 *
 *   // Option A: run as standalone node process (via cron / PM2 cron_restart)
 *   node workers/stuckJobReaper.js
 *
 *   // Option B: kick off inside app.js (runs every REAPER_INTERVAL_MS)
 *   require('./workers/stuckJobReaper').startReaper();
 *
 * Environment variables (all optional — defaults shown):
 *   REAPER_INTERVAL_MS=300000        Interval between sweeps (default: 5 minutes)
 *   REAPER_JOB_TIMEOUT_MS=1800000   Age after which an active job is declared stuck (default: 30 minutes)
 *   REAPER_MAX_JOBS_PER_SWEEP=50    Max jobs to reap in one sweep (prevents thundering herd)
 */

"use strict";

require("dotenv").config();

const mongoose = require("mongoose");
const DubbingJob = require("../models/DubbingJob");
const { refundDubbingUsage } = require("../utils/usageService");

// ─── Config ───────────────────────────────────────────────────────────────────

const REAPER_INTERVAL_MS    = Number(process.env.REAPER_INTERVAL_MS)    || 5  * 60 * 1000;
const REAPER_JOB_TIMEOUT_MS = Number(process.env.REAPER_JOB_TIMEOUT_MS) || 30 * 60 * 1000;
const REAPER_MAX_PER_SWEEP  = Number(process.env.REAPER_MAX_JOBS_PER_SWEEP) || 50;

const ACTIVE_STATUSES = [
  "pending", "extracting", "separating",
  "transcribing", "translating", "generating", "syncing", "merging",
];

// ─── Core sweep ───────────────────────────────────────────────────────────────

async function sweep() {
  const cutoff = new Date(Date.now() - REAPER_JOB_TIMEOUT_MS);

  // Find jobs that started processing (processingStartedAt is set) but never
  // reached a terminal state within the timeout window.
  // Also catches very old pending jobs that never received processingStartedAt
  // by using updatedAt as a fallback.
  const stuckJobs = await DubbingJob.find({
    status: { $in: ACTIVE_STATUSES },
    $or: [
      { processingStartedAt: { $lt: cutoff } },
      { processingStartedAt: null, updatedAt: { $lt: cutoff } },
    ],
  })
    .select("_id user status reservedSeconds processedSeconds processingStartedAt updatedAt")
    .limit(REAPER_MAX_PER_SWEEP)
    .lean();

  if (!stuckJobs.length) return;

  console.log(`[reaper] Found ${stuckJobs.length} stuck job(s) — sweeping.`);

  for (const job of stuckJobs) {
    try {
      // ── 1. Mark as failed (atomic: only update if still in an active status) ─
      const updated = await DubbingJob.findOneAndUpdate(
        { _id: job._id, status: { $in: ACTIVE_STATUSES } },
        {
          $set: {
            status: "failed",
            error: `Job timed out after ${REAPER_JOB_TIMEOUT_MS / 60000} minutes without completing.`,
          },
        },
        { new: true },
      );

      // If updated is null, another reaper instance already handled it (multi-server safe).
      if (!updated) {
        console.log(`[reaper] Job ${job._id} already handled by another reaper — skipping.`);
        continue;
      }

      // ── 2. Refund unused reservation ─────────────────────────────────────────
      const reservedDur  = Number(job.reservedSeconds)   || 0;
      const processedDur = Number(job.processedSeconds)  || 0;

      if (reservedDur > 0) {
        await refundDubbingUsage(
          job.user.toString(),
          job._id,
          reservedDur,
          processedDur, // partial refund: only unused portion returned to quota
        );
      }

      console.log(
        `[reaper] Reaped job ${job._id} (user=${job.user}) ` +
        `reserved=${reservedDur}s processed=${processedDur}s ` +
        `refunded=${(reservedDur - processedDur).toFixed(1)}s`,
      );
    } catch (err) {
      console.error(`[reaper] Error processing stuck job ${job._id}:`, err.message);
    }
  }
}

// ─── Exports / entry point ────────────────────────────────────────────────────

/**
 * Start the reaper as a recurring in-process timer.
 * Call this once from app.js after mongoose connects.
 */
function startReaper() {
  console.log(
    `[reaper] Starting. Interval=${REAPER_INTERVAL_MS / 1000}s ` +
    `Timeout=${REAPER_JOB_TIMEOUT_MS / 60000}min`,
  );

  // Run immediately on startup to catch jobs from a previous crash
  sweep().catch((e) => console.error("[reaper] Initial sweep error:", e.message));

  // Then run on the configured interval
  setInterval(() => {
    sweep().catch((e) => console.error("[reaper] Sweep error:", e.message));
  }, REAPER_INTERVAL_MS);
}

module.exports = { startReaper, sweep };

// ─── Standalone mode ─────────────────────────────────────────────────────────
// If run directly (`node workers/stuckJobReaper.js`), connect and do a single sweep.
if (require.main === module) {
  mongoose
    .connect(process.env.MONGODB_URI)
    .then(async () => {
      console.log("[reaper] Connected to MongoDB.");
      await sweep();
      await mongoose.disconnect();
      console.log("[reaper] Done.");
    })
    .catch((err) => {
      console.error("[reaper] Fatal:", err.message);
      process.exit(1);
    });
}
