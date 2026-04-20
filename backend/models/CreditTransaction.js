const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const CreditTransactionSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    /** "credit" = credits added, "debit" = credits spent */
    type: {
      type: String,
      enum: ["credit", "debit"],
      required: true,
    },
    /** Always a positive number regardless of type */
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    /** User's balance immediately before this transaction */
    balanceBefore: {
      type: Number,
      required: true,
    },
    /** User's balance immediately after this transaction */
    balanceAfter: {
      type: Number,
      required: true,
    },
    /** Where the credit movement originated */
    source: {
      type: String,
      enum: [
        "signup_bonus",
        "subtitle_job",
        "dubbing_job",
        "purchase",
        "refund",
        "admin_grant",
        "subscription_initial",
        "subscription_renewal",
      ],
      required: true,
    },
    /** Human-readable label shown in the UI, e.g. "Transcribed video.mp4 (3 min)" */
    description: {
      type: String,
      default: "",
    },
    /** Optional bag of extra data (fileName, duration, jobId, paymentId, …) */
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

CreditTransactionSchema.index(
  { "metadata.billingPeriodKey": 1 },
  { unique: true, sparse: true }
);

CreditTransactionSchema.index(
  { source: 1, "metadata.paymentId": 1 },
  { 
    unique: true, 
    partialFilterExpression: { "metadata.paymentId": { $exists: true } }
  }
);

CreditTransactionSchema.index(
  { "metadata.idempotencyKey": 1 },
  { 
    unique: true, 
    partialFilterExpression: { "metadata.idempotencyKey": { $exists: true } }
  }
);

module.exports = mongoose.model("CreditTransaction", CreditTransactionSchema);
