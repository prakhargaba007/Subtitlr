const mongoose = require("mongoose");
const Schema = mongoose.Schema;

/**
 * Local mirror of a Dodo subscription + editable creditsPerRenewal (grandfather price, change grant).
 */
const userSubscriptionSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    dodoSubscriptionId: { type: String, required: true, unique: true, index: true },
    dodoCustomerId: { type: String, default: "" },
    dodoProductId: { type: String, default: "" },
    status: {
      type: String,
      enum: ["pending", "active", "on_hold", "cancelled", "expired", "failed", "unknown"],
      default: "pending",
      index: true,
    },
    creditsPerRenewal: { type: Number, required: true, min: 0 },
    planCatalog: { type: Schema.Types.ObjectId, ref: "PlanCatalog", default: null },
    planCatalogVersionAtSignup: { type: Number, default: 0 },
    pricingCohort: { type: String, default: "" },
    cancelAtNextBillingDate: { type: Boolean, default: false },
    nextBillingDate: { type: Date, default: null },
    previousBillingDate: { type: Date, default: null },
    trialPeriodDays: { type: Number, default: 0 },
    lastDodoPayloadAt: { type: Date, default: null },
  },
  { timestamps: true }
);

userSubscriptionSchema.index({ user: 1, status: 1 });

module.exports = mongoose.model("UserSubscription", userSubscriptionSchema);
