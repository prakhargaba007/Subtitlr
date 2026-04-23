const mongoose = require("mongoose");
const PlanCatalog = require("../models/PlanCatalog");
const User = require("../models/User");

function requireFullAdmin(user) {
  return user && user.role === "admin";
}

/** GET /api/admin/plans */
exports.listAllPlans = async (req, res, next) => {
  try {
    const plans = await PlanCatalog.find({})
      .sort({ key: 1, version: -1, sortOrder: 1 })
      .lean();
    res.json({ plans });
  } catch (err) {
    next(err);
  }
};

/** POST /api/admin/plans */
exports.createPlan = async (req, res, next) => {
  try {
    const actor = await User.findById(req.userId).select("role").lean();
    if (!requireFullAdmin(actor)) {
      return res.status(403).json({ message: "Only full admin may create plans." });
    }

    const key = String(req.body?.key || "").trim();
    const displayName = String(req.body?.displayName || "").trim();
    const priceDisplay = String(req.body?.priceDisplay || "").trim();
    const discountDisplay = String(req.body?.discountDisplay || "").trim();
    const originalPrice = req.body?.originalPrice !== undefined && req.body?.originalPrice !== null ? Number(req.body.originalPrice) : null;
    const interval = String(req.body?.interval || "").trim();
    const dodoProductId = String(req.body?.dodoProductId || "").trim();
    const creditsPerPeriod = Math.max(0, Number(req.body?.creditsPerPeriod) || 0);
    const version = Math.max(1, Math.floor(Number(req.body?.version) || 1));
    const isActivePublic = req.body?.isActivePublic !== false;
    const sortOrder = Math.floor(Number(req.body?.sortOrder) || 0);
    const featureFlags =
      req.body?.featureFlags && typeof req.body.featureFlags === "object"
        ? req.body.featureFlags
        : {};

    if (!key || !displayName || !interval || !dodoProductId) {
      return res.status(422).json({
        message: "key, displayName, interval, and dodoProductId are required.",
      });
    }
    if (!["monthly", "annual", "one_time"].includes(interval)) {
      return res.status(422).json({ message: "interval must be monthly|annual|one_time." });
    }

    const plan = await PlanCatalog.create({
      key,
      displayName,
      priceDisplay,
      discountDisplay,
      originalPrice,
      interval,
      dodoProductId,
      creditsPerPeriod,
      version,
      isActivePublic,
      sortOrder,
      featureFlags,
    });

    res.status(201).json({ plan });
  } catch (err) {
    next(err);
  }
};

/** PATCH /api/admin/plans/:id */
exports.patchPlan = async (req, res, next) => {
  try {
    const actor = await User.findById(req.userId).select("role").lean();
    if (!requireFullAdmin(actor)) {
      return res.status(403).json({ message: "Only full admin may update plans." });
    }

    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid plan id." });
    }

    const patch = {};
    const setStr = (k) => {
      if (req.body?.[k] !== undefined) patch[k] = String(req.body[k] || "").trim();
    };

    setStr("displayName");
    setStr("priceDisplay");
    setStr("discountDisplay");
    setStr("interval");
    setStr("dodoProductId");

    if (req.body?.originalPrice !== undefined) {
      patch.originalPrice = req.body.originalPrice !== null ? Number(req.body.originalPrice) : null;
    }

    if (req.body?.creditsPerPeriod !== undefined) {
      patch.creditsPerPeriod = Math.max(0, Math.floor(Number(req.body.creditsPerPeriod) || 0));
    }
    if (req.body?.isActivePublic !== undefined) {
      patch.isActivePublic = !!req.body.isActivePublic;
    }
    if (req.body?.sortOrder !== undefined) {
      patch.sortOrder = Math.floor(Number(req.body.sortOrder) || 0);
    }
    if (req.body?.featureFlags !== undefined) {
      if (req.body.featureFlags && typeof req.body.featureFlags === "object") {
        patch.featureFlags = req.body.featureFlags;
      } else {
        return res.status(422).json({ message: "featureFlags must be an object." });
      }
    }

    if (patch.interval && !["monthly", "annual", "one_time"].includes(patch.interval)) {
      return res.status(422).json({ message: "interval must be monthly|annual|one_time." });
    }

    const plan = await PlanCatalog.findByIdAndUpdate(id, { $set: patch }, { new: true }).lean();
    if (!plan) {
      return res.status(404).json({ message: "Plan not found." });
    }
    res.json({ plan });
  } catch (err) {
    next(err);
  }
};

