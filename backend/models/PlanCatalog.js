const mongoose = require("mongoose");
const Schema = mongoose.Schema;

/**
 * Versioned public plans: new buyers bind to current rows; old rows kept for history.
 * dodoProductId must match the subscription product id in Dodo Payments.
 */
const planCatalogSchema = new Schema(
  {
    key: { type: String, required: true, index: true },
    displayName: { type: String, required: true },
    /** Display-only (source of truth for actual charge is Dodo product pricing). */
    priceDisplay: { type: String, default: "" },
    /** Display-only (e.g. \"20% off\" or \"$5 off\"). */
    discountDisplay: { type: String, default: "" },
    interval: {
      type: String,
      enum: ["monthly", "annual", "one_time"],
      required: true,
    },
    dodoProductId: { type: String, required: true, index: true },
    creditsPerPeriod: { type: Number, required: true, min: 0 },
    version: { type: Number, default: 1, min: 1 },
    isActivePublic: { type: Boolean, default: true, index: true },
    featureFlags: { type: Schema.Types.Mixed, default: {} },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

planCatalogSchema.index({ key: 1, version: 1 }, { unique: true });

module.exports = mongoose.model("PlanCatalog", planCatalogSchema);
