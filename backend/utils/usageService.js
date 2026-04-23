/**
 * utils/usageService.js
 *
 * Atomic helpers called by the dubbing controller AFTER a job completes or fails.
 *
 * ── Two-Phase Reservation Lifecycle ─────────────────────────────────────────
 *
 *   Phase 1 — RESERVE  (checkDubbingLimits middleware):
 *     dailyReservedSeconds  += reservedDur
 *     monthlyReservedSeconds += reservedDur
 *     activeJobsCount       += 1
 *
 *   Phase 2a — CONFIRM (job completed successfully):
 *     dailyUsedSeconds      += actualDur          ← what actually ran
 *     dailyReservedSeconds  -= reservedDur         ← release full reservation
 *     monthlyUsedSeconds    += actualDur
 *     monthlyReservedSeconds -= reservedDur
 *     activeJobsCount       -= 1
 *     lastConfirmedJobId     = jobId              ← idempotency guard
 *
 *   Phase 2b — REFUND (job failed, partial or full):
 *     dailyUsedSeconds      += processedDur        ← bill what actually ran (0 on early failure)
 *     dailyReservedSeconds  -= reservedDur
 *     monthlyUsedSeconds    += processedDur
 *     monthlyReservedSeconds -= reservedDur
 *     activeJobsCount       -= 1
 *     lastRefundedJobId      = jobId              ← idempotency guard
 *
 * All operations are single atomic $inc / findOneAndUpdate calls.
 *
 * ── Anti-Double-Operation Guards ─────────────────────────────────────────────
 * Before every confirm/refund, we check that the jobId does NOT match the last
 * refunded/confirmed jobId respectively. This prevents double-decrement bugs
 * if the controller's finally block calls refund after a prior confirm, or if
 * a retry calls confirm twice.
 */

const UserUsage = require("../models/UserUsage");

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Clamp a $inc delta to avoid pushing a counter below 0 in a multi-server race. */
const safeNeg = (n) => -Math.abs(n);

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Call this when a dubbing job completes successfully.
 *
 * Moves `actualDur` seconds into confirmed usage and releases the full reservation.
 * Idempotent: if `jobId` matches `lastConfirmedJobId`, the operation is skipped.
 *
 * @param {string}        userId
 * @param {string|object} jobId         - DubbingJob._id (used as idempotency key)
 * @param {number}        reservedDur   - seconds originally reserved
 * @param {number}        [actualDur]   - seconds actually processed (defaults to reservedDur)
 */
async function confirmDubbingUsage(userId, jobId, reservedDur, actualDur) {
  const reserved = Math.max(0, Number(reservedDur) || 0);
  const actual   = Math.max(0, Number(actualDur   ?? reservedDur) || 0);
  if (!reserved) return;

  // Guard: skip if this job was already confirmed (double-confirm protection).
  await UserUsage.updateOne(
    {
      user: userId,
      lastConfirmedJobId: { $ne: jobId },  // only update if NOT already confirmed
    },
    {
      $inc: {
        dailyUsedSeconds:       actual,
        monthlyUsedSeconds:     actual,
        dailyReservedSeconds:   safeNeg(reserved),
        monthlyReservedSeconds: safeNeg(reserved),
        activeJobsCount:        -1,
      },
      $set: {
        lastConfirmedJobId: jobId,
      },
    },
    { upsert: false },
  );
}

/**
 * Call this when a dubbing job fails (fully or partially).
 *
 * Only the portion that was actually processed (`processedDur`) is billed.
 * The unprocessed portion (`reservedDur - processedDur`) is returned to quota.
 * Idempotent: if `jobId` matches `lastRefundedJobId`, the operation is skipped.
 *
 * @param {string}        userId
 * @param {string|object} jobId          - DubbingJob._id (used as idempotency key)
 * @param {number}        reservedDur    - seconds originally reserved
 * @param {number}        [processedDur] - seconds actually processed before failure (default 0)
 */
async function refundDubbingUsage(userId, jobId, reservedDur, processedDur = 0) {
  const reserved  = Math.max(0, Number(reservedDur)  || 0);
  const processed = Math.max(0, Math.min(Number(processedDur) || 0, reserved));
  if (!reserved) return;

  // Guard: skip if this job was already refunded (double-refund protection).
  await UserUsage.updateOne(
    {
      user: userId,
      lastRefundedJobId: { $ne: jobId },  // only update if NOT already refunded
    },
    {
      $inc: {
        // Bill what was actually processed (may be 0 for early-stage failures)
        dailyUsedSeconds:       processed,
        monthlyUsedSeconds:     processed,
        // Release the full reservation (the unprocessed portion goes back to quota)
        dailyReservedSeconds:   safeNeg(reserved),
        monthlyReservedSeconds: safeNeg(reserved),
        activeJobsCount:        -1,
      },
      $set: {
        lastRefundedJobId: jobId,
      },
    },
    { upsert: false },
  );
}

/**
 * Check whether the user's daily cost would exceed the plan's cost-based safety cap.
 *
 * Called inside checkDubbingLimits BEFORE the atomic reservation.
 *
 * @param {object} usage        - current UserUsage document
 * @param {object} flags        - featureFlags.dubbing from plan
 * @param {number} newDurSec    - duration of the incoming request in seconds
 * @param {function} getFlag    - flag resolver from the middleware
 * @returns {{ blocked: boolean, reason?: string }}
 */
function checkCostSafetyCap(usage, flags, newDurSec, getFlag) {
  // Cost-based cap: dailyCostCapUSD and ratePerSecondUSD must both be set on the plan.
  const dailyCostCap   = getFlag(flags, "dailyCostCapUSD");
  const ratePerSecond  = getFlag(flags, "ratePerSecondUSD");

  if (dailyCostCap === null || ratePerSecond === null) {
    // Cap not configured — not blocked.
    return { blocked: false };
  }

  const effectiveDailySec = (usage.dailyUsedSeconds || 0) + (usage.dailyReservedSeconds || 0);
  const currentDailyCost  = effectiveDailySec * ratePerSecond;
  const addedCost         = newDurSec         * ratePerSecond;

  if (currentDailyCost + addedCost > dailyCostCap) {
    return {
      blocked: true,
      reason: `Daily cost cap of $${dailyCostCap.toFixed(2)} would be exceeded. ` +
              `Current daily cost: $${currentDailyCost.toFixed(4)}. ` +
              `This request would add: $${addedCost.toFixed(4)}.`,
    };
  }

  return { blocked: false };
}

/**
 * Returns current usage stats for a user (useful for dashboard / admin debug).
 *
 * @param {string} userId
 * @returns {Promise<object|null>}
 */
async function getUserUsageStats(userId) {
  return UserUsage.findOne({ user: userId }).lean();
}

module.exports = {
  confirmDubbingUsage,
  refundDubbingUsage,
  checkCostSafetyCap,
  getUserUsageStats,
};
