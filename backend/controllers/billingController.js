const User = require("../models/User");
const PlanCatalog = require("../models/PlanCatalog");
const UserSubscription = require("../models/UserSubscription");
const { getDodoClient } = require("../utils/dodoClient");

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

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }
    if (!String(user.email || "").trim()) {
      return res
        .status(422)
        .json({ message: "User email is required for checkout." });
    }

    const client = getDodoClient();
    if (!client) {
      return res
        .status(503)
        .json({ message: "DODO_PAYMENTS_API_KEY is not configured." });
    }

    const returnUrl =
      String(process.env.DODO_CHECKOUT_RETURN_URL || "").trim() || null;

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

    res.status(201).json({
      sessionId: session.session_id,
      checkoutUrl: session.checkout_url,
    });
  } catch (err) {
    next(err);
  }
};
