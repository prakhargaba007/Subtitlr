/**
 * scripts/seedPlanLimits.js
 *
 * Run once (or whenever limits change) to update PlanCatalog.featureFlags
 * for each plan in the database.
 *
 * Usage:
 *   node scripts/seedPlanLimits.js
 *
 * This script is ADDITIVE / MERGE — it only sets the `dubbing` key inside
 * featureFlags. Other feature flags are preserved.
 *
 * ─── featureFlags.dubbing shape ──────────────────────────────────────────────
 *
 *   maxDurationPerRequestSeconds : number | null  (null = no limit)
 *     Hard cap on a single upload. e.g. 900 = max 15-minute file.
 *
 *   maxConcurrentJobs            : number | null
 *     How many jobs can be in an active state at once per user.
 *
 *   dailyLimitSeconds            : number | null
 *     Rolling calendar-day quota (resets at 00:00 UTC).
 *
 *   monthlyLimitSeconds          : number | null
 *     Rolling calendar-month quota (resets on 1st of month UTC).
 *
 *   overageAllowed               : boolean
 *     If true, requests past monthlyLimitSeconds are still accepted
 *     (you can bill for overage separately). Defaults to false.
 *
 *   dailySafetyCapSeconds        : number | null
 *     Absolute daily ceiling that cannot be exceeded regardless of
 *     overageAllowed (anti-abuse / cost spike protection).
 *
 *   allowedTtsProviders          : string[] | null
 *     Which TTS providers are available on this plan.
 *     null = all providers allowed.
 */

require("dotenv").config();
const mongoose = require("mongoose");
const PlanCatalog = require("../models/PlanCatalog");

// ─── Limit Definitions ────────────────────────────────────────────────────────
// Change ONLY these objects when updating limits. Nothing else needs editing.

const PLAN_LIMITS = {
  // Free / trial tier (no paid subscription)
  free: {
    dubbing: {
      maxDurationPerRequestSeconds:  300,   // 5 min per file
      maxConcurrentJobs:             1,
      dailyLimitSeconds:             600,   // 10 min / day
      monthlyLimitSeconds:           1800,  // 30 min / month
      overageAllowed:                false,
      dailySafetyCapSeconds:         1200,  // hard ceiling
      allowedTtsProviders:           ["gemini"],
    },
  },

  // Starter paid plan
  starter: {
    dubbing: {
      maxDurationPerRequestSeconds:  1800,  // 30 min per file
      maxConcurrentJobs:             1,
      dailyLimitSeconds:             7200,  // 2 hours / day
      monthlyLimitSeconds:           36000, // 10 hours / month
      overageAllowed:                false,
      dailySafetyCapSeconds:         10800, // 3 hours hard ceiling
      allowedTtsProviders:           ["gemini", "inworld"],
    },
  },

  // Pro paid plan
  pro: {
    dubbing: {
      maxDurationPerRequestSeconds:  3600,  // 1 hour per file
      maxConcurrentJobs:             3,
      dailyLimitSeconds:             null,  // no daily limit
      monthlyLimitSeconds:           216000, // 60 hours / month
      overageAllowed:                true,
      dailySafetyCapSeconds:         72000, // 20 hours hard ceiling (anti-abuse)
      allowedTtsProviders:           null,  // all providers
    },
  },

  // Enterprise / unlimited
  enterprise: {
    dubbing: {
      maxDurationPerRequestSeconds:  null,  // no limit
      maxConcurrentJobs:             10,
      dailyLimitSeconds:             null,
      monthlyLimitSeconds:           null,
      overageAllowed:                true,
      dailySafetyCapSeconds:         null,
      allowedTtsProviders:           null,
    },
  },
};

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB");

  for (const [planKey, limits] of Object.entries(PLAN_LIMITS)) {
    const result = await PlanCatalog.updateMany(
      { key: planKey },
      {
        $set: {
          "featureFlags.dubbing": limits.dubbing,
        },
      },
    );
    console.log(`Plan "${planKey}": matched=${result.matchedCount} modified=${result.modifiedCount}`);
  }

  console.log("Done.");
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
