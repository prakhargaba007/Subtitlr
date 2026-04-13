const PlanCatalog = require("../models/PlanCatalog");

/**
 * Upsert catalog rows from DODO_PLAN_CATALOG_JSON (array of objects).
 * Each object: { key, displayName, priceDisplay?, discountDisplay?, interval, dodoProductId, creditsPerPeriod, version?, isActivePublic?, sortOrder?, featureFlags? }
 */
async function seedPlanCatalogFromEnv() {
  const raw = String(process.env.DODO_PLAN_CATALOG_JSON || "").trim();
  if (!raw) return { seeded: 0, message: "DODO_PLAN_CATALOG_JSON empty; skip seed." };

  let rows;
  try {
    rows = JSON.parse(raw);
  } catch (e) {
    console.warn("[planCatalogSeed] Invalid DODO_PLAN_CATALOG_JSON:", e.message);
    return { seeded: 0, message: "Invalid JSON" };
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    return { seeded: 0, message: "Not an array" };
  }

  let n = 0;
  for (const row of rows) {
    if (!row || !row.key || !row.displayName || !row.interval || !row.dodoProductId) continue;
    const version = Number(row.version) > 0 ? Number(row.version) : 1;
    await PlanCatalog.findOneAndUpdate(
      { key: row.key, version },
      {
        $set: {
          displayName: row.displayName,
          priceDisplay: String(row.priceDisplay || "").trim(),
          discountDisplay: String(row.discountDisplay || "").trim(),
          interval: row.interval,
          dodoProductId: row.dodoProductId,
          creditsPerPeriod: Math.max(0, Number(row.creditsPerPeriod) || 0),
          isActivePublic: row.isActivePublic !== false,
          sortOrder: Number(row.sortOrder) || 0,
          featureFlags: row.featureFlags && typeof row.featureFlags === "object" ? row.featureFlags : {},
        },
      },
      { upsert: true, new: true }
    );
    n += 1;
  }
  return { seeded: n };
}

module.exports = { seedPlanCatalogFromEnv };
