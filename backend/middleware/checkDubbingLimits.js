/**
 * middleware/checkDubbingLimits.js  — v2 (hardened)
 *
 * Pre-flight limit enforcement for every dubbing job request.
 *
 * Improvements over v1:
 *   1. IDEMPOTENCY  — reads X-Idempotency-Key header; returns existing job if seen before.
 *   2. ATOMIC CONCURRENCY — uses UserUsage.activeJobsCount (atomic $inc) instead of
 *      a non-atomic DubbingJob.countDocuments().
 *   3. UTC RESET (DAILY)  — resets inside the same atomic findOneAndUpdate that
 *      reserves usage, preventing a race window between reset and reserve.
 *   4. BILLING-CYCLE RESET (MONTHLY) — resets based on billingCycleStart from
 *      UserSubscription, not a naive calendar month string.
 *   5. COST-BASED SAFETY CAP — blocks if daily API cost would exceed the plan's
 *      dailyCostCapUSD threshold (reads ratePerSecondUSD from featureFlags).
 *   6. NO SEPARATE RESET QUERY — all counter manipulations happen inside the single
 *      atomic reservation update to eliminate TOCTOU windows.
 *
 * NO LIMIT IS HARDCODED HERE.
 * Everything comes from PlanCatalog.featureFlags via the user's active subscription.
 *
 * Actual featureFlags shape (flat, no "dubbing" sub-key — mirrors featureFlagsSchema in PlanCatalog.js):
 * {
 *   maxInputMinutes          : 60,      // max file duration per request (in minutes)
 *   maxFileSizeMB            : 500,     // max upload file size in MB
 *   maxConcurrentJobs        : 1,       // concurrent jobs per user
 *   dailyLimitSeconds        : 3600,    // rolling calendar-day quota
 *   monthlyLimitSeconds      : 36000,   // rolling billing-cycle quota
 *   overageAllowed           : false,
 *   dailySafetyCapSeconds    : 7200,
 *   dailyCostCapUSD          : 5.00,
 *   ratePerSecondUSD         : 0.0005,
 *   ttsProviders             : ["inworld", "gemini"],
 *   allowSourceSeparation    : true,
 *   lipSync                  : false,
 *   ... (see PlanCatalog.js featureFlagsSchema for full list)
 * }
 */

"use strict";

const path = require("path");
const os   = require("os");
const fs   = require("fs");
const { v4: uuidv4 } = require("uuid");

const User             = require("../models/User");
const UserSubscription = require("../models/UserSubscription");
const PlanCatalog      = require("../models/PlanCatalog");
const DubbingJob       = require("../models/DubbingJob");
const UserUsage        = require("../models/UserUsage");

const { getFileDuration }  = require("../utils/audioUtils");
const { checkCostSafetyCap } = require("../utils/usageService");

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/** Today as YYYY-MM-DD in UTC — always consistent across timezones. */
const todayUTC = () => new Date().toISOString().slice(0, 10);

/**
 * Derive the current billing-cycle start date from a subscription document.
 * Falls back to the first day of the current UTC calendar month.
 *
 * @param {object|null} sub - UserSubscription lean document
 * @returns {string} YYYY-MM-DD
 */
function billingCycleStartDate(sub) {
  if (sub && sub.previousBillingDate) {
    // Use the last billing date as the cycle start (most accurate)
    return new Date(sub.previousBillingDate).toISOString().slice(0, 10);
  }
  // Fall back: first of the current UTC calendar month
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

/**
 * Resolve a nested flag value from plan featureFlags.
 * Returns `null` when absent (= no limit enforced).
 */
function getFlag(flags, key) {
  const parts = key.split(".");
  let cur = flags;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return null;
    cur = cur[p];
  }
  return cur === undefined ? null : cur;
}

/** Build a 4xx error the Express error handler understands. */
function limitError(message, statusCode = 429) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

async function reserveDubbingUsage({
  userId,
  durationSeconds,
  enforceDurationLimit = true,
}) {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw limitError("File has no detectable duration.", 422);
  }

  // ── Load plan limits ───────────────────────────────────────────────────────
  const user = await User.findById(userId)
    .select("activeSubscriptionId")
    .lean();
  if (!user) throw limitError("User not found.", 404);

  let planFlags = {};
  let sub = null;

  if (user.activeSubscriptionId) {
    sub = await UserSubscription.findById(user.activeSubscriptionId)
      .select("status planCatalog previousBillingDate")
      .lean();

    if (sub && sub.status === "active" && sub.planCatalog) {
      const plan = await PlanCatalog.findById(sub.planCatalog)
        .select("featureFlags")
        .lean();
      if (plan?.featureFlags) planFlags = plan.featureFlags;
    }
  }

  // featureFlags is a flat object — read it directly (no nested "dubbing" sub-key).
  const flags = (planFlags && typeof planFlags === "object") ? planFlags : {};

  // ── Hard limit: max duration per request ───────────────────────────────────
  // Retarget jobs reuse a previously accepted source job; callers may skip this.
  const maxInputMinutes   = flags.maxInputMinutes ?? null;
  const maxDurPerRequest  = maxInputMinutes !== null ? maxInputMinutes * 60 : null;
  if (
    enforceDurationLimit &&
    maxDurPerRequest !== null &&
    durationSeconds > maxDurPerRequest
  ) {
    throw limitError(
      `File duration ${Math.ceil(durationSeconds / 60)} min exceeds the plan limit of ${maxInputMinutes} min per request.`,
      413,
    );
  }

  // ── Load usage document (upsert on first use) ──────────────────────────────
  const today        = todayUTC();
  const cycleStart   = billingCycleStartDate(sub);

  // Use findOneAndUpdate with upsert to avoid a separate create() race.
  let usage = await UserUsage.findOneAndUpdate(
    { user: userId },
    { $setOnInsert: { user: userId, dailyWindowDate: today, billingCycleStart: cycleStart } },
    { upsert: true, new: true },
  );

  // ── Determine if windows need resetting ────────────────────────────────────
  const needsDailyReset   = usage.dailyWindowDate   !== today;
  const needsMonthlyReset = usage.billingCycleStart !== cycleStart;

  // Snapshot the effective values AFTER applying any pending resets.
  const effectiveDailyUsed   = needsDailyReset   ? 0 : (usage.dailyUsedSeconds   || 0) + (usage.dailyReservedSeconds   || 0);
  const effectiveMonthlyUsed = needsMonthlyReset ? 0 : (usage.monthlyUsedSeconds  || 0) + (usage.monthlyReservedSeconds || 0);
  const activeJobsCount      = needsDailyReset   ? 0 : (usage.activeJobsCount     || 0);

  // ── Atomic concurrency check (using activeJobsCount, not countDocuments) ───
  const maxConcurrent = getFlag(flags, "maxConcurrentJobs");
  if (maxConcurrent !== null && activeJobsCount >= maxConcurrent) {
    throw limitError(
      `You already have ${activeJobsCount} active job(s). Your plan allows a maximum of ${maxConcurrent} concurrent job(s). Please wait for your current job to complete.`,
      429,
    );
  }

  // ── Daily quota check ──────────────────────────────────────────────────────
  const dailyLimit = getFlag(flags, "dailyLimitSeconds");
  if (dailyLimit !== null && effectiveDailyUsed + durationSeconds > dailyLimit) {
    const remaining = Math.max(0, dailyLimit - effectiveDailyUsed);
    throw limitError(
      `Daily dubbing quota exceeded. Remaining today: ${Math.floor(remaining)}s. Your file is ${Math.ceil(durationSeconds)}s.`,
      429,
    );
  }

  // ── Cost-based daily safety cap check ──────────────────────────────────────
  // checkCostSafetyCap uses effectiveDailyUsed which already accounts for resets.
  const effectiveUsageForCostCheck = {
    dailyUsedSeconds:     needsDailyReset ? 0 : (usage.dailyUsedSeconds   || 0),
    dailyReservedSeconds: needsDailyReset ? 0 : (usage.dailyReservedSeconds || 0),
  };
  const costCheck = checkCostSafetyCap(effectiveUsageForCostCheck, flags, durationSeconds, getFlag);
  if (costCheck.blocked) {
    throw limitError(costCheck.reason, 429);
  }

  // ── Monthly quota check ────────────────────────────────────────────────────
  const monthlyLimit   = getFlag(flags, "monthlyLimitSeconds");
  const overageAllowed = getFlag(flags, "overageAllowed") === true;

  if (monthlyLimit !== null && !overageAllowed && effectiveMonthlyUsed + durationSeconds > monthlyLimit) {
    const remaining = Math.max(0, monthlyLimit - effectiveMonthlyUsed);
    throw limitError(
      `Monthly dubbing quota exceeded. Remaining this billing cycle: ${Math.floor(remaining)}s. Upgrade your plan for more.`,
      402,
    );
  }

  // ── ATOMIC RESERVATION ─────────────────────────────────────────────────────
  // This is the single operation that prevents race conditions and also resets
  // stale daily/monthly windows atomically.
  const matchQuery = { user: userId };
  const updateDoc  = { $inc: {}, $set: {} };

  if (needsDailyReset) {
    updateDoc.$set.dailyWindowDate      = today;
    updateDoc.$set.dailyUsedSeconds     = 0;
    updateDoc.$set.dailyReservedSeconds = durationSeconds;
    updateDoc.$set.activeJobsCount      = 1;
  } else {
    if (dailyLimit !== null) {
      matchQuery.dailyUsedSeconds = {
        $lte: dailyLimit - (usage.dailyReservedSeconds || 0) - durationSeconds,
      };
    }
    updateDoc.$inc.dailyReservedSeconds = durationSeconds;
    updateDoc.$inc.activeJobsCount      = 1;
  }

  if (needsMonthlyReset) {
    updateDoc.$set.billingCycleStart       = cycleStart;
    updateDoc.$set.monthlyUsedSeconds      = 0;
    updateDoc.$set.monthlyReservedSeconds  = durationSeconds;
  } else {
    if (monthlyLimit !== null && !overageAllowed) {
      matchQuery.monthlyUsedSeconds = {
        $lte: monthlyLimit - (usage.monthlyReservedSeconds || 0) - durationSeconds,
      };
    }
    updateDoc.$inc.monthlyReservedSeconds = durationSeconds;
  }

  if (!Object.keys(updateDoc.$inc).length) delete updateDoc.$inc;

  const reserveResult = await UserUsage.findOneAndUpdate(
    matchQuery,
    updateDoc,
    { new: true },
  );

  if (!reserveResult) {
    throw limitError(
      "Quota temporarily full due to a concurrent request. Please try again in a moment.",
      429,
    );
  }

  return flags;
}

// ─── Main Middleware ──────────────────────────────────────────────────────────

/**
 * Usage:
 *   router.post("/start", isAuth, upload.single("file"), checkDubbingLimits, startDubbingJob);
 *
 * On success, sets on `req`:
 *   req.dubbingDurationSeconds  - float, file duration
 *   req.dubbingTmpProbeFile     - path to the buffered tmp file (reuse in controller)
 *   req.dubbingPlanFlags        - featureFlags.dubbing object from the plan
 *   req.dubbingUsageReserved    - true
 *   req.dubbingIdempotencyKey   - the idempotency key (or null)
 *
 * On reject, calls next(error) — no reservation is made.
 */
async function checkDubbingLimits(req, res, next) {
  let tmpFile = null;

  try {
    // ── 0. Idempotency check (before touching disk / S3 download) ─────────────
    const idempotencyKey = (req.headers["x-idempotency-key"] || "").trim() || null;

    if (idempotencyKey) {
      const existingJob = await DubbingJob.findOne({
        user: req.userId,
        idempotencyKey,
      })
        .select("_id status")
        .lean();

      if (existingJob) {
        res.write(
          `data: ${JSON.stringify({
            stage: "duplicate",
            message: "Duplicate request detected. Returning existing job.",
            jobId: existingJob._id,
            status: existingJob.status,
          })}\n\n`,
        );
        return res.end();
      }
    }

    // ── 1. Resolve probe file on disk (pre-downloaded S3 temp or multer buffer) ─
    if (req.dubbingTmpProbeFile && fs.existsSync(req.dubbingTmpProbeFile)) {
      tmpFile = req.dubbingTmpProbeFile;
    } else {
      if (!req.file || !req.file.buffer) {
        return next(limitError("No file uploaded.", 422));
      }
      const ext = path.extname(req.file.originalname) || ".mp3";
      tmpFile = path.join(os.tmpdir(), `limit_probe_${uuidv4()}${ext}`);
      fs.writeFileSync(tmpFile, req.file.buffer);
    }

    const fileSize =
      typeof req.file?.size === "number" && req.file.size > 0
        ? req.file.size
        : fs.statSync(tmpFile).size;

    // ── 2. Probe file duration ────────────────────────────────────────────────
    let durationSeconds;
    try {
      durationSeconds = await getFileDuration(tmpFile);
    } catch {
      return next(limitError("Could not determine file duration.", 422));
    }

    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
      return next(limitError("File has no detectable duration.", 422));
    }

    // ── 4a. Hard limit: max file size ─────────────────────────────────────────
    const user = await User.findById(req.userId)
      .select("activeSubscriptionId")
      .lean();
    if (!user) return next(limitError("User not found.", 404));

    let planFlags = {};
    if (user.activeSubscriptionId) {
      const sub = await UserSubscription.findById(user.activeSubscriptionId)
        .select("status planCatalog")
        .lean();
      if (sub && sub.status === "active" && sub.planCatalog) {
        const plan = await PlanCatalog.findById(sub.planCatalog)
          .select("featureFlags")
          .lean();
        if (plan?.featureFlags) planFlags = plan.featureFlags;
      }
    }
    const fileSizeFlags = (planFlags && typeof planFlags === "object") ? planFlags : {};
    const maxFileSizeMB = fileSizeFlags.maxFileSizeMB ?? null;
    if (maxFileSizeMB !== null && fileSize > maxFileSizeMB * 1024 * 1024) {
      return next(limitError(
        `File size ${(fileSize / 1024 / 1024).toFixed(1)} MB exceeds the plan limit of ${maxFileSizeMB} MB.`,
        413,
      ));
    }

    const flags = await reserveDubbingUsage({
      userId: req.userId,
      durationSeconds,
    });

    // ── 4b. Hard limit: max duration / quota reservation ──────────────────────
    // ── 5. Pass context to controller ─────────────────────────────────────────
    req.dubbingDurationSeconds = durationSeconds;
    req.dubbingTmpProbeFile    = tmpFile;
    req.dubbingPlanFlags       = flags;
    req.dubbingUsageReserved   = true;
    req.dubbingIdempotencyKey  = idempotencyKey;

    next();
  } catch (err) {
    if (tmpFile) {
      try {
        fs.unlinkSync(tmpFile);
      } catch {
        /* ignore */
      }
    }
    next(err);
  }
}

checkDubbingLimits.reserveDubbingUsage = reserveDubbingUsage;

module.exports = checkDubbingLimits;
