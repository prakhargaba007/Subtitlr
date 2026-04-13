const mongoose = require("mongoose");
const User = require("../models/User");
const UserSubscription = require("../models/UserSubscription");

/**
 * PATCH /api/admin/subscriptions/:id
 * body: { creditsPerRenewal: number }
 * Full admin only (not sub-admin).
 */
exports.patchSubscriptionCredits = async (req, res, next) => {
  try {
    const admin = await User.findById(req.userId).select("role").lean();
    if (!admin || admin.role !== "admin") {
      return res.status(403).json({ message: "Only full admin may update subscription credits." });
    }

    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid subscription id." });
    }

    const credits = Number(req.body?.creditsPerRenewal);
    if (!Number.isFinite(credits) || credits < 0) {
      return res.status(422).json({ message: "creditsPerRenewal must be a non-negative number." });
    }

    const sub = await UserSubscription.findByIdAndUpdate(
      id,
      { $set: { creditsPerRenewal: Math.floor(credits) } },
      { new: true }
    )
      .populate("planCatalog", "key displayName")
      .lean();

    if (!sub) {
      return res.status(404).json({ message: "Subscription not found." });
    }

    res.json({ subscription: sub });
  } catch (err) {
    next(err);
  }
};
