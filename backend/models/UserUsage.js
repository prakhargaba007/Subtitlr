const mongoose = require("mongoose");
const Schema = mongoose.Schema;

/**
 * Tracks usage per user for rate-limiting and quota enforcement.
 * One document per user — created on first use and atomically updated.
 *
 * Two-Phase Reservation Lifecycle:
 *   RESERVE  → dailyReservedSeconds  += dur, activeJobsCount += 1
 *   CONFIRM  → dailyUsedSeconds      += actualDur, dailyReservedSeconds -= reservedDur, activeJobsCount -= 1
 *   REFUND   → dailyReservedSeconds  -= unusedDur, activeJobsCount -= 1
 *
 * Guards:
 *   - lastRefundedJobId  prevents double-refunding the same job
 *   - lastConfirmedJobId prevents double-confirming the same job
 */
const userUsageSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    // ── Active concurrency (incremented at reservation, decremented at confirm/refund) ──
    /** Number of jobs currently reserved / in-flight. Atomic counter for concurrency checks. */
    activeJobsCount: { type: Number, default: 0, min: 0 },

    // ── Daily window ─────────────────────────────────────────────────────────
    /** ISO date string of the day this counter covers (YYYY-MM-DD, UTC). */
    dailyWindowDate: { type: String, default: "" },
    /** Confirmed seconds consumed today (completed jobs only). */
    dailyUsedSeconds: { type: Number, default: 0, min: 0 },
    /** Seconds reserved by in-flight jobs today (not yet confirmed). */
    dailyReservedSeconds: { type: Number, default: 0, min: 0 },

    // ── Monthly window — billing-cycle aligned ────────────────────────────────
    /**
     * Start of the current billing cycle as ISO date string (YYYY-MM-DD, UTC).
     * Synced from PlanCatalog/UserSubscription on each check.
     * Falls back to calendar month if no subscription.
     */
    billingCycleStart: { type: String, default: "" },
    /** Confirmed seconds consumed this billing cycle (completed jobs only). */
    monthlyUsedSeconds: { type: Number, default: 0, min: 0 },
    /** Seconds reserved by in-flight jobs this cycle (not yet confirmed). */
    monthlyReservedSeconds: { type: Number, default: 0, min: 0 },

    // ── Idempotency guards ────────────────────────────────────────────────────
    /**
     * Stores the DubbingJob._id of the last successfully refunded job.
     * Prevents double-refunds if refundDubbingUsage is called twice for the same job.
     */
    lastRefundedJobId: { type: Schema.Types.ObjectId, default: null },
    /**
     * Stores the DubbingJob._id of the last successfully confirmed job.
     * Prevents double-confirms if confirmDubbingUsage is called twice for the same job.
     */
    lastConfirmedJobId: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: true },
);

module.exports = mongoose.model("UserUsage", userUsageSchema);
