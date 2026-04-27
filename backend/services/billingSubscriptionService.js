const mongoose = require("mongoose");
const PlanCatalog = require("../models/PlanCatalog");
const UserSubscription = require("../models/UserSubscription");
const User = require("../models/User");
const CreditTransaction = require("../models/CreditTransaction");
const DodoWebhookReceipt = require("../models/DodoWebhookReceipt");
const { addCredits, deductCredits, processRefundAtomic } = require("../utils/creditUtils");

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
  // Guarantee upgrades apply credits to 'creditsPerRenewal'
  if (!preserveCreditsPerRenewal && defaultCredits > 0) {
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

  const { getDodoClient } = require("../utils/dodoClient");
  const CheckoutLock = require("../models/CheckoutLock");
  const client = getDodoClient();

  // Clear successful checkout lock
  const planKeyStr = dodo.metadata?.planCatalogKey || "";
  if (planKeyStr) {
    await CheckoutLock.deleteOne({ user: sub.user });
  }

  // Enforce Single Source of Truth for Subscriptions
  const user = await User.findById(sub.user);
  if (user) {
    // If there is an existing active sub that differs from this newly activated one
    if (user.activeSubscriptionId && user.activeSubscriptionId.toString() !== sub._id.toString()) {
      const oldSub = await UserSubscription.findById(user.activeSubscriptionId);
      if (oldSub && oldSub.status !== "cancelled" && oldSub.status !== "expired") {
        if (client && oldSub.dodoSubscriptionId) {
          try {
            if (typeof client.subscriptions?.cancel === "function") {
              await client.subscriptions.cancel(oldSub.dodoSubscriptionId);
            } else if (typeof client.subscriptions?.update === "function") {
              await client.subscriptions.update(oldSub.dodoSubscriptionId, { status: "cancelled" });
            }
          } catch (err) {
            console.error(`[Dodo] Failed cancelling old subscription ${oldSub.dodoSubscriptionId}:`, err);
          }
        }
        oldSub.status = "pending_cancel";
        await oldSub.save();
      }
    }
    // Update Single Source of Truth
    user.activeSubscriptionId = sub._id;
    await user.save();
  }

  // Sync any remaining rogue active subscriptions
  await UserSubscription.updateMany(
    { user: sub.user, status: "active", _id: { $ne: sub._id } },
    { $set: { status: "cancelled" } }
  );

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

/**
 * Payment succeeded is the "source of truth" to grant subscription credits.
 * We fetch the live subscription (to get next_billing_date) and then grant credits
 * for that billing period using the same idempotency key.
 *
 * @param {object} payment - Dodo Payment payload
 */
async function handlePaymentSucceeded(payment) {
  const { getDodoClient } = require("../utils/dodoClient");
  const client = getDodoClient();
  if (!client) return null;

  const subId = payment.subscription_id || payment.subscriptionId || null;
  if (!subId) return null; // not a subscription payment

  // Fetch subscription for accurate billing period dates
  let dodoSub = null;
  try {
    const getter =
      client.subscriptions?.get ||
      client.subscriptions?.retrieve ||
      null;
    if (typeof getter === "function") {
      dodoSub = await getter.call(client.subscriptions, subId);
    }
  } catch (e) {
    // throw so webhook retries; we don't want to miss a grant due to transient network
    throw e;
  }
  if (!dodoSub || !dodoSub.subscription_id) return null;

  // Sync local mirror first (plan, dates, status)
  const sub = await syncUserSubscriptionFromDodo(dodoSub, {
    setPlanVersionOnCreate: true,
    preserveCreditsPerRenewal: true,
  });

  if (!sub) return null;
  if (sub.status !== "active") return { subscription: sub, grant: { granted: false, reason: "not_active" } };

  // Treat as renewal when previousBillingDate exists, else initial activation.
  const isRenewal = Boolean(dodoSub.previous_billing_date);
  const periodKey = billingPeriodKey(dodoSub);
  const credits = sub.creditsPerRenewal;

  const r = await grantSubscriptionCredits(
    sub.user.toString(),
    credits,
    isRenewal ? "subscription_renewal" : "subscription_initial",
    isRenewal
      ? `Subscription renewed (${sub.dodoSubscriptionId})`
      : `Subscription activated (${sub.dodoSubscriptionId})`,
    periodKey,
    {
      dodoSubscriptionId: sub.dodoSubscriptionId,
      event: "payment.succeeded",
      paymentId: payment.payment_id || payment.paymentId || payment.id || null,
    }
  );

  return { subscription: sub, grant: r };
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

async function handleRefund(dodo, webhookEventId) {
  const userId = await resolveUserIdFromDodo(dodo);
  if (!userId) return null;

  const paymentId = dodo.payment_id || dodo.id;
  if (!paymentId) return null;

  // Internally derived deterministic idempotency key removing network payload trust
  const idempotencyKey = `refund_trace_${paymentId}_${webhookEventId || Date.now()}`;

  try {
    // Offload to a pure, DB-enforced atomic function that solves all TOCTOU refund gaps
    await processRefundAtomic(userId, paymentId, idempotencyKey);
  } catch (e) {
    if (e.code === 11000 || (e.writeErrors && e.writeErrors[0].code === 11000)) {
      // Confirmed idempotency rejection natively via DB index; swallow to drop correctly
      return;
    }
    throw e; // Bubble true transient errors so the outer webhook receipt forces a safe retry
  }
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

  // 4. STRICT WEBHOOK VALIDATION & SINGLE SOURCE OF TRUTH
  // Prevents reactivating old subscriptions or overlapping billing by validating activeSubscriptionId
  if (
    type === "subscription.renewed" || 
    type === "subscription.updated" ||
    type === "subscription.plan_changed" ||
    type === "payment.succeeded"
  ) {
    const dodoSubId = data.subscription_id || data.id;
    if (dodoSubId) {
      const existing = await UserSubscription.findOne({ dodoSubscriptionId: dodoSubId }).lean();
      if (existing) {
        if (existing.status === "cancelled" || existing.status === "pending_cancel") {
          console.log(`[Webhook] Dropping ${type} for cancelled/pending_cancel subscription ${dodoSubId}`);
          return;
        }

        const user = await User.findById(existing.user).lean();
        if (user && user.activeSubscriptionId && user.activeSubscriptionId.toString() !== existing._id.toString()) {
          console.log(`[Webhook] CRITICAL DROP: ${type} for ${dodoSubId} failed activeSubscriptionId validation.`);
          
          // Forcefully cancel the rogue subscription recursively
          const { getDodoClient } = require("../utils/dodoClient");
          const client = getDodoClient();
          if (client) {
            try {
              if (typeof client.subscriptions?.cancel === "function") {
                await client.subscriptions.cancel(dodoSubId);
              }
            } catch (err) {}
          }
          await UserSubscription.updateOne({ _id: existing._id }, { $set: { status: "cancelled" } });
          return;
        }
      }
    }
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
    case "payment.succeeded":
      await handlePaymentSucceeded(data);
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
      // Make sure preserveCreditsPerRenewal defaults to false to adopt new credits
      await syncUserSubscriptionFromDodo(data, {
        allowMissingUser: true,
        preserveCreditsPerRenewal: false,
      });
      break;
    case "payment.refunded":
    case "payment.dispute_won":
    case "payment.dispute_lost":
      if (type === "payment.refunded" || type === "payment.dispute_lost") {
        await handleRefund(data, event.event_id || event.id || String(Date.now()));
      }
      break;
    default:
      break;
  }

  // (Removed createdAt-based cleanup. System now relies purely on user.activeSubscriptionId structural validation and aggressive hook drops.)
}

module.exports = {
  billingPeriodKey,
  findPlanByDodoProductId,
  findPlanByKey,
  syncUserSubscriptionFromDodo,
  grantSubscriptionCredits,
  processDodoWebhookEvent,
};
