const mongoose = require("mongoose");
const PlanCatalog = require("../models/PlanCatalog");
const UserSubscription = require("../models/UserSubscription");
const User = require("../models/User");
const DodoWebhookReceipt = require("../models/DodoWebhookReceipt");
const { addCredits } = require("../utils/creditUtils");

/** One grant per subscription per billing period end (avoids double grant if active + renewed share the same cycle). */
function billingPeriodKey(dodo) {
  const sid = dodo.subscription_id || "";
  const next = dodo.next_billing_date || "";
  return `${sid}|${next}`;
}

function mapDodoStatus(status) {
  const s = String(status || "").toLowerCase();
  if (s === "active") return "active";
  if (s === "on_hold" || s === "on hold") return "on_hold";
  if (s === "cancelled" || s === "canceled") return "cancelled";
  if (s === "expired") return "expired";
  if (s === "failed") return "failed";
  if (s === "pending") return "pending";
  return "unknown";
}

async function findPlanByDodoProductId(productId) {
  if (!productId) return null;
  const plans = await PlanCatalog.find({ dodoProductId: productId }).sort({ version: -1 }).lean();
  return plans[0] || null;
}

async function findPlanByKey(key) {
  if (!key) return null;
  const plans = await PlanCatalog.find({ key }).sort({ version: -1 }).lean();
  return plans[0] || null;
}

async function resolveUserIdFromDodo(dodo) {
  const meta = dodo.metadata || {};
  const uid = meta.userId || meta.user_id;
  if (uid && mongoose.Types.ObjectId.isValid(uid)) {
    const u = await User.findById(uid).select("_id").lean();
    if (u) return uid;
  }
  const existing = await UserSubscription.findOne({ dodoSubscriptionId: dodo.subscription_id })
    .select("user")
    .lean();
  if (existing?.user) return existing.user.toString();
  return null;
}

/**
 * @param {object} dodo — Dodo Subscription payload
 * @param {{ preserveCreditsPerRenewal?: boolean, setPlanVersionOnCreate?: boolean, allowMissingUser?: boolean }} [opts]
 */
async function syncUserSubscriptionFromDodo(dodo, opts = {}) {
  const {
    preserveCreditsPerRenewal = false,
    setPlanVersionOnCreate = false,
    allowMissingUser = false,
  } = opts;

  const userId = await resolveUserIdFromDodo(dodo);
  if (!userId) {
    if (allowMissingUser) return null;
    const err = new Error("Missing userId in subscription metadata; set metadata.userId on checkout.");
    err.statusCode = 422;
    throw err;
  }

  const plan =
    (await findPlanByDodoProductId(dodo.product_id)) ||
    (dodo.metadata?.planCatalogKey ? await findPlanByKey(dodo.metadata.planCatalogKey) : null);

  const defaultCredits = plan ? plan.creditsPerPeriod : 0;

  const existing = await UserSubscription.findOne({ dodoSubscriptionId: dodo.subscription_id });

  const base = {
    user: userId,
    dodoCustomerId: dodo.customer?.customer_id || "",
    dodoProductId: dodo.product_id || "",
    status: mapDodoStatus(dodo.status),
    cancelAtNextBillingDate: !!dodo.cancel_at_next_billing_date,
    nextBillingDate: dodo.next_billing_date ? new Date(dodo.next_billing_date) : null,
    previousBillingDate: dodo.previous_billing_date ? new Date(dodo.previous_billing_date) : null,
    trialPeriodDays: Number(dodo.trial_period_days) || 0,
    lastDodoPayloadAt: new Date(),
  };

  if (plan) {
    base.planCatalog = plan._id;
  }

  if (!existing) {
    base.dodoSubscriptionId = dodo.subscription_id;
    base.creditsPerRenewal = defaultCredits;
    if (plan && setPlanVersionOnCreate) {
      base.planCatalogVersionAtSignup = plan.version;
    }
    return UserSubscription.create(base);
  }

  Object.assign(existing, base);
  if (!preserveCreditsPerRenewal && defaultCredits > 0 && !existing.creditsPerRenewal) {
    existing.creditsPerRenewal = defaultCredits;
  }
  await existing.save();
  return existing;
}

/**
 * Grant credits for current billing window (idempotent via metadata.billingPeriodKey unique index).
 */
async function grantSubscriptionCredits(userId, amount, source, description, periodKey, extraMeta = {}) {
  if (!amount || amount < 1) return { granted: false, reason: "zero_amount" };
  try {
    await addCredits(userId, amount, source, description, {
      ...extraMeta,
      billingPeriodKey: periodKey,
    });
    return { granted: true };
  } catch (e) {
    if (e && e.code === 11000) return { granted: false, reason: "duplicate_period" };
    throw e;
  }
}

async function handleSubscriptionActive(dodo) {
  const sub = await syncUserSubscriptionFromDodo(dodo, { setPlanVersionOnCreate: true });
  const periodKey = billingPeriodKey(dodo);
  const credits = sub.creditsPerRenewal;
  const r = await grantSubscriptionCredits(
    sub.user.toString(),
    credits,
    "subscription_initial",
    `Subscription activated (${sub.dodoSubscriptionId})`,
    periodKey,
    { dodoSubscriptionId: sub.dodoSubscriptionId, event: "subscription.active" }
  );
  return { subscription: sub, grant: r };
}

async function handleSubscriptionRenewed(dodo) {
  const sub = await syncUserSubscriptionFromDodo(dodo, { preserveCreditsPerRenewal: true });
  const periodKey = billingPeriodKey(dodo);
  const credits = sub.creditsPerRenewal;
  const r = await grantSubscriptionCredits(
    sub.user.toString(),
    credits,
    "subscription_renewal",
    `Subscription renewed (${sub.dodoSubscriptionId})`,
    periodKey,
    { dodoSubscriptionId: sub.dodoSubscriptionId, event: "subscription.renewed" }
  );
  return { subscription: sub, grant: r };
}

async function handleSubscriptionUpdated(dodo) {
  return syncUserSubscriptionFromDodo(dodo, {
    preserveCreditsPerRenewal: true,
    allowMissingUser: true,
  });
}

async function handleTerminalStatus(dodo, status) {
  let sub = await UserSubscription.findOne({ dodoSubscriptionId: dodo.subscription_id });
  if (!sub) {
    sub = await syncUserSubscriptionFromDodo(dodo, {
      setPlanVersionOnCreate: true,
      allowMissingUser: true,
    });
  }
  if (!sub) return null;
  sub.status = status;
  sub.lastDodoPayloadAt = new Date();
  await sub.save();
  return sub;
}

/**
 * Process verified webhook body (parsed JSON). Persists receipt only after success.
 */
async function processDodoWebhookEvent(event) {
  const type = event.type;
  const data = event.data;

  if (!type || !data) {
    const err = new Error("Invalid webhook payload");
    err.statusCode = 400;
    throw err;
  }

  switch (type) {
    case "subscription.active":
      await handleSubscriptionActive(data);
      break;
    case "subscription.renewed":
      await handleSubscriptionRenewed(data);
      break;
    case "subscription.updated":
      await handleSubscriptionUpdated(data);
      break;
    case "subscription.on_hold":
      await handleTerminalStatus(data, "on_hold");
      break;
    case "subscription.cancelled":
      await handleTerminalStatus(data, "cancelled");
      break;
    case "subscription.expired":
      await handleTerminalStatus(data, "expired");
      break;
    case "subscription.failed":
      await handleTerminalStatus(data, "failed");
      break;
    case "subscription.plan_changed":
      await handleSubscriptionUpdated(data);
      break;
    default:
      break;
  }
}

async function recordWebhookReceipt(webhookId, eventType) {
  await DodoWebhookReceipt.create({ webhookId, eventType: eventType || "" });
}

module.exports = {
  billingPeriodKey,
  findPlanByDodoProductId,
  findPlanByKey,
  syncUserSubscriptionFromDodo,
  grantSubscriptionCredits,
  processDodoWebhookEvent,
  recordWebhookReceipt,
};
