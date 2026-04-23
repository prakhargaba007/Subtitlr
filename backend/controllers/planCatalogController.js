const PlanCatalog = require("../models/PlanCatalog");

/** GET /api/plans — public list of sellable plans */
exports.listPublicPlans = async (req, res, next) => {
  try {
    const plans = await PlanCatalog.find({ isActivePublic: true })
      .sort({ sortOrder: 1, version: -1 })
      .select(
        "key displayName priceDisplay discountDisplay originalPrice interval dodoProductId creditsPerPeriod version featureFlags sortOrder"
      )
      .lean();

    const byKey = new Map();
    for (const p of plans) {
      if (!byKey.has(p.key)) byKey.set(p.key, p);
    }
    res.json({ plans: [...byKey.values()] });
  } catch (err) {
    next(err);
  }
};
