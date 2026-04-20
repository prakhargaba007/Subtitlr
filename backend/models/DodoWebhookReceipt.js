const mongoose = require("mongoose");
const Schema = mongoose.Schema;

/** Processed Dodo webhook deliveries (idempotency; created only after successful handling). */
const dodoWebhookReceiptSchema = new Schema(
  {
    webhookId: { type: String, required: true, unique: true, index: true },
    eventType: { type: String, default: "" },
    status: { type: String, enum: ["processing", "completed", "failed"], default: "processing" },
    error: { type: String, default: "" },
    lockedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("DodoWebhookReceipt", dodoWebhookReceiptSchema);
