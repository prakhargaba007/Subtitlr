const User = require("../models/User");
const PlanCatalog = require("../models/PlanCatalog");
const UserSubscription = require("../models/UserSubscription");
const { getDodoClient } = require("../utils/dodoClient");
const CheckoutLock = require("../models/CheckoutLock");
const UserUsage = require("../models/UserUsage");

/** GET /api/billing/subscription */
exports.getMySubscription = async (req, res, next) => {
  try {
    const rows = await UserSubscription.find({ user: req.userId })
      .sort({ updatedAt: -1 })
      .populate(
        "planCatalog",
        "key displayName interval creditsPerPeriod version",
      )
      .lean();
    res.json({ subscriptions: rows });
  } catch (err) {
    next(err);
  }
};

/** GET /api/billing/current-plan */
exports.getCurrentPlan = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).populate({
      path: "activeSubscriptionId",
      populate: { path: "planCatalog", select: "key displayName creditsPerPeriod interval features featureFlags sortOrder" }
    }).lean();

    const activeSub = user?.activeSubscriptionId;

    const usage = await UserUsage.findOne({ user: req.userId }).select("activeJobsCount").lean();
    const activeJobsCount = usage?.activeJobsCount || 0;

    if (!activeSub || !activeSub.planCatalog) {
      return res.json({ currentPlan: null, activeJobsCount });
    }

    // 6. RECONCILIATION MECHANISM (Auto-fix missing callbacks)
    const client = getDodoClient();
    if (client && activeSub.dodoSubscriptionId && activeSub.status !== "cancelled" && activeSub.status !== "expired") {
      try {
        if (typeof client.subscriptions?.get === "function" || typeof client.subscriptions?.retrieve === "function") {
          const fetcher = client.subscriptions.get || client.subscriptions.retrieve;
          const liveDodoSub = await fetcher.call(client.subscriptions, activeSub.dodoSubscriptionId);
          if (liveDodoSub && liveDodoSub.status) {
            const liveStatus = String(liveDodoSub.status || "").toLowerCase();
            const normalizedStatus = liveStatus === "canceled" ? "cancelled" : liveStatus;
            
            if (normalizedStatus && normalizedStatus !== activeSub.status && normalizedStatus !== "unknown") {
              activeSub.status = normalizedStatus;
              await UserSubscription.updateOne({ _id: activeSub._id }, { $set: { status: normalizedStatus } });
            }
          }
        }
      } catch (err) {
        // Suppress network errors on dashboard load to prevent breaking UI
      }
    }

    res.json({
      currentPlan: {
        planKey: activeSub.planCatalog.key,
        displayName: activeSub.planCatalog.displayName,
        creditsPerPeriod: activeSub.planCatalog.creditsPerPeriod,
        interval: activeSub.planCatalog.interval,
        features: activeSub.planCatalog.features || [],
        featureFlags: activeSub.planCatalog.featureFlags || {},
        sortOrder: activeSub.planCatalog.sortOrder || 0,
        status: activeSub.status,
        nextBillingDate: activeSub.nextBillingDate,
        cancelAtNextBillingDate: activeSub.cancelAtNextBillingDate,
      },
      activeJobsCount
    });
  } catch (err) {
    next(err);
  }
};

/** POST /api/billing/cancel */
exports.cancelMySubscription = async (req, res, next) => {
  try {
    console.log("[Billing][cancel] start", { userId: req.userId });
    const user = await User.findById(req.userId).populate({
      path: "activeSubscriptionId",
      populate: { path: "planCatalog", select: "key displayName" },
    });

    const activeSub = user?.activeSubscriptionId;
    if (!activeSub || !activeSub.dodoSubscriptionId) {
      console.warn("[Billing][cancel] no active subscription", {
        userId: req.userId,
        hasActiveSubscriptionId: Boolean(user?.activeSubscriptionId),
      });
      return res.status(404).json({ message: "No active subscription found." });
    }

    console.log("[Billing][cancel] active subscription", {
      userId: req.userId,
      subscriptionId: String(activeSub._id),
      dodoSubscriptionId: String(activeSub.dodoSubscriptionId),
      status: String(activeSub.status || ""),
      cancelAtNextBillingDate: Boolean(activeSub.cancelAtNextBillingDate),
      nextBillingDate: activeSub.nextBillingDate ? new Date(activeSub.nextBillingDate).toISOString() : null,
      planKey: activeSub?.planCatalog?.key,
    });

    if (activeSub.cancelAtNextBillingDate) {
      console.log("[Billing][cancel] already scheduled", {
        userId: req.userId,
        subscriptionId: String(activeSub._id),
        dodoSubscriptionId: String(activeSub.dodoSubscriptionId),
      });
      return res.status(200).json({ success: true, message: "Already set to cancel at next billing date." });
    }

    const client = getDodoClient();
    if (!client) {
      console.error("[Billing][cancel] dodo client not configured", { userId: req.userId });
      return res.status(503).json({ message: "Billing provider is not configured." });
    }

    // Prefer cancel-at-period-end behavior if available.
    // Dodo SDK capabilities vary; we attempt cancel(), then fall back to update().
    let cancelled = false;
    try {
      if (typeof client.subscriptions?.cancel === "function") {
        console.log("[Billing][cancel] provider call", {
          userId: req.userId,
          method: "subscriptions.cancel",
          dodoSubscriptionId: String(activeSub.dodoSubscriptionId),
        });
        await client.subscriptions.cancel(activeSub.dodoSubscriptionId);
        cancelled = true;
      } else if (typeof client.subscriptions?.update === "function") {
        console.log("[Billing][cancel] provider call", {
          userId: req.userId,
          method: "subscriptions.update",
          dodoSubscriptionId: String(activeSub.dodoSubscriptionId),
          payload: { cancel_at_next_billing_date: true },
        });
        await client.subscriptions.update(activeSub.dodoSubscriptionId, { cancel_at_next_billing_date: true });
        cancelled = true;
      } else {
        console.error("[Billing][cancel] provider client missing cancel/update", {
          userId: req.userId,
          hasSubscriptions: Boolean(client.subscriptions),
          cancelType: typeof client.subscriptions?.cancel,
          updateType: typeof client.subscriptions?.update,
        });
      }
    } catch (err) {
      console.error("Failed to cancel subscription:", err);
      // If provider call fails, surface a clear message.
      return res.status(502).json({ message: "Could not cancel subscription. Please try again." });
    }

    if (cancelled) {
      console.log("[Billing][cancel] provider call ok, updating local record", {
        userId: req.userId,
        subscriptionId: String(activeSub._id),
      });
      await UserSubscription.updateOne(
        { _id: activeSub._id },
        { $set: { cancelAtNextBillingDate: true } }
      );
      console.log("[Billing][cancel] done", {
        userId: req.userId,
        subscriptionId: String(activeSub._id),
        dodoSubscriptionId: String(activeSub.dodoSubscriptionId),
      });
    } else {
      console.warn("[Billing][cancel] provider call not executed", {
        userId: req.userId,
        subscriptionId: String(activeSub._id),
        dodoSubscriptionId: String(activeSub.dodoSubscriptionId),
      });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("[Billing][cancel] unexpected error", { userId: req.userId, err });
    next(err);
  }
};

/** POST /api/billing/resume */
exports.resumeMySubscription = async (req, res, next) => {
  try {
    console.log("[Billing][resume] start", { userId: req.userId });
    const user = await User.findById(req.userId).populate({
      path: "activeSubscriptionId",
      populate: { path: "planCatalog", select: "key displayName" },
    });

    const activeSub = user?.activeSubscriptionId;
    if (!activeSub || !activeSub.dodoSubscriptionId) {
      console.warn("[Billing][resume] no active subscription", {
        userId: req.userId,
        hasActiveSubscriptionId: Boolean(user?.activeSubscriptionId),
      });
      return res.status(404).json({ message: "No active subscription found." });
    }

    console.log("[Billing][resume] active subscription", {
      userId: req.userId,
      subscriptionId: String(activeSub._id),
      dodoSubscriptionId: String(activeSub.dodoSubscriptionId),
      status: String(activeSub.status || ""),
      cancelAtNextBillingDate: Boolean(activeSub.cancelAtNextBillingDate),
      nextBillingDate: activeSub.nextBillingDate ? new Date(activeSub.nextBillingDate).toISOString() : null,
      planKey: activeSub?.planCatalog?.key,
    });

    if (!activeSub.cancelAtNextBillingDate) {
      return res.status(200).json({ success: true, message: "Subscription is not scheduled for cancellation." });
    }

    const client = getDodoClient();
    if (!client) {
      console.error("[Billing][resume] dodo client not configured", { userId: req.userId });
      return res.status(503).json({ message: "Billing provider is not configured." });
    }

    let resumed = false;
    try {
      if (typeof client.subscriptions?.update === "function") {
        console.log("[Billing][resume] provider call", {
          userId: req.userId,
          method: "subscriptions.update",
          dodoSubscriptionId: String(activeSub.dodoSubscriptionId),
          payload: { cancel_at_next_billing_date: false },
        });
        await client.subscriptions.update(activeSub.dodoSubscriptionId, { cancel_at_next_billing_date: false });
        resumed = true;
      } else {
        console.error("[Billing][resume] provider client missing update()", {
          userId: req.userId,
          hasSubscriptions: Boolean(client.subscriptions),
          updateType: typeof client.subscriptions?.update,
        });
      }
    } catch (err) {
      console.error("Failed to resume subscription:", err);
      return res.status(502).json({ message: "Could not resume subscription. Please try again." });
    }

    if (resumed) {
      console.log("[Billing][resume] provider call ok, updating local record", {
        userId: req.userId,
        subscriptionId: String(activeSub._id),
      });
      await UserSubscription.updateOne(
        { _id: activeSub._id },
        { $set: { cancelAtNextBillingDate: false } }
      );
      console.log("[Billing][resume] done", {
        userId: req.userId,
        subscriptionId: String(activeSub._id),
        dodoSubscriptionId: String(activeSub.dodoSubscriptionId),
      });
    } else {
      console.warn("[Billing][resume] provider call not executed", {
        userId: req.userId,
        subscriptionId: String(activeSub._id),
        dodoSubscriptionId: String(activeSub.dodoSubscriptionId),
      });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("[Billing][resume] unexpected error", { userId: req.userId, err });
    next(err);
  }
};

/**
 * POST /api/billing/dodo/checkout-session
 * body: { planKey: string }
 */
exports.createDodoCheckoutSession = async (req, res, next) => {
  try {
    const planKey = String(req.body?.planKey || "").trim();
    if (!planKey) {
      return res.status(422).json({ message: "planKey is required." });
    }

    const plan = (
      await PlanCatalog.find({ key: planKey, isActivePublic: true })
        .sort({ version: -1 })
        .limit(1)
        .lean()
    )[0];
    if (!plan) {
      return res
        .status(404)
        .json({ message: "Plan not found or not available." });
    }

    const user = await User.findById(req.userId).populate({
      path: "activeSubscriptionId",
      populate: { path: "planCatalog" }
    });

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    if (!String(user.email || "").trim()) {
      return res.status(422).json({ message: "User email is required for checkout." });
    }

    // 2. Strict Active Subscription Enforcement (Single Source of Truth)
    if (user.activeSubscriptionId) {
      const activeSub = user.activeSubscriptionId;
      if (activeSub.planCatalog && activeSub.planCatalog.key === plan.key) {
        return res.status(400).json({ message: "Already on this plan" });
      }
      if (activeSub.status === "pending_cancel") {
        return res.status(409).json({ message: "You have a pending subscription change in progress." });
      }
    }

    const client = getDodoClient();
    if (!client) {
      return res
        .status(503)
        .json({ message: "DODO_PAYMENTS_API_KEY is not configured." });
    }

    const CheckoutLock = require("../models/CheckoutLock");
    
    // 1. Atomic User-Level Lock Setup
    const now = new Date();
    
    // Clean up uniquely stale locks first to make room if needed
    await CheckoutLock.deleteOne({ 
      user: user._id, 
      expiresAt: { $lt: now } 
    });

    const pendingId = "pending_" + Date.now();
    
    // Atomically claim lock strictly on the User level
    const lock = await CheckoutLock.findOneAndUpdate(
      { user: user._id },
      { 
        $setOnInsert: { 
          planCatalogKey: plan.key,
          sessionId: pendingId, 
          checkoutUrl: "GENERATING", 
          expiresAt: new Date(now.getTime() + 15 * 60 * 1000) 
        } 
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // 2. Enforce global idemptotency and cross-plan blocking
    if (lock.sessionId !== pendingId) {
      if (lock.checkoutUrl === "GENERATING") {
        return res.status(409).json({ message: "Checkout is currently generating. Please try again in a few seconds." });
      }
      if (lock.planCatalogKey !== plan.key) {
        return res.status(409).json({ message: "You already have a pending checkout for a different plan. Please complete it or wait for it to expire." });
      }
      return res.status(200).json({
        sessionId: lock.sessionId,
        checkoutUrl: lock.checkoutUrl,
        reused: true
      });
    }

    let returnUrl = String(process.env.DODO_CHECKOUT_RETURN_URL || "").trim() || null;
    if (returnUrl) {
      returnUrl += (returnUrl.includes("?") ? "&" : "?") + "verifying=true";
    }

    const session = await client.checkoutSessions.create({
      product_cart: [{ product_id: plan.dodoProductId, quantity: 1 }],
      customer: {
        email: String(user.email).trim(),
        name:
          String(user.name || user.userName || "Customer").trim() || "Customer",
      },
      return_url: returnUrl,
      metadata: {
        userId: user._id.toString(),
        planCatalogKey: plan.key,
      },
    });

    // 3. Update the lock with the finalized Dodo checkout
    await CheckoutLock.updateOne(
      { _id: lock._id },
      { 
        $set: { 
          sessionId: session.session_id, 
          checkoutUrl: session.checkout_url 
        } 
      }
    );

    res.status(201).json({
      sessionId: session.session_id,
      checkoutUrl: session.checkout_url,
    });
  } catch (err) {
    next(err);
  }
};
