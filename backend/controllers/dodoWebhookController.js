const DodoWebhookReceipt = require("../models/DodoWebhookReceipt");
const { getDodoClient } = require("../utils/dodoClient");
const { processDodoWebhookEvent } = require("../services/billingSubscriptionService");

/**
 * POST /api/webhooks/dodo
 * Raw body required (mounted with express.raw in app.js).
 */
exports.handleDodoWebhook = async (req, res) => {
  const webhookId = String(req.headers["webhook-id"] || "").trim();
  try {
    if (!webhookId) return res.status(400).json({ message: "Missing webhook-id header." });

    const client = getDodoClient();
    const key = client?.webhookKey || String(process.env.DODO_PAYMENTS_WEBHOOK_KEY || "").trim();
    if (!client || !key) return res.status(503).json({ message: "Dodo webhook key not configured." });

    const raw = req.body instanceof Buffer ? req.body.toString("utf8") : String(req.body || "");
    const headers = {
      "webhook-id": webhookId,
      "webhook-signature": String(req.headers["webhook-signature"] || ""),
      "webhook-timestamp": String(req.headers["webhook-timestamp"] || ""),
    };

    let payload;
    try {
      payload = client.webhooks.unwrap(raw, { headers, key });
    } catch (verifyErr) {
      console.warn("[dodo webhook] Signature verification failed:", verifyErr.message);
      return res.status(401).json({ message: "Invalid signature" });
    }

    // 1. Enforce EXACTLY-ONCE idempotency safely with locked processing timeout
    const lockTimeout = new Date(Date.now() - 5 * 60 * 1000); // 5 mins dead letter limit
    
    const receipt = await DodoWebhookReceipt.findOneAndUpdate(
      { 
        webhookId,
        $or: [
          { status: "failed" },
          { status: "processing", lockedAt: { $lt: lockTimeout } }
        ]
      },
      { 
        $set: { eventType: payload.type || "", status: "processing", lockedAt: new Date() },
        $setOnInsert: { webhookId }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true, rawResult: true }
    ).catch(err => err);

    if (receipt instanceof Error) {
      if (receipt.code === 11000) {
        const existing = await DodoWebhookReceipt.findOne({ webhookId }).lean();
        if (existing && existing.status === "completed") {
          return res.status(200).json({ received: true, duplicate: true });
        }
        return res.status(409).json({ message: "Concurrent processing detected, please retry" });
      }
      throw receipt;
    }

    // 2. PROCESS payload safely
    try {
      await processDodoWebhookEvent(payload);
      await DodoWebhookReceipt.updateOne({ webhookId }, { status: "completed", lockedAt: null });
      return res.status(200).json({ received: true });
    } catch (processErr) {
      if (processErr.statusCode === 422) {
        // Drop malformed 422 errors permanently without delete
        await DodoWebhookReceipt.updateOne({ webhookId }, { status: "failed", error: processErr.message, lockedAt: null });
        return res.status(200).json({ received: true, skipped: true, reason: processErr.message });
      } else {
        // Expected backoff error: mark failed to resume lock immediately for Dodo retry.
        await DodoWebhookReceipt.updateOne({ webhookId }, { status: "failed", error: processErr.message || "Unknown error", lockedAt: null });
        throw processErr; // Let Express throw 500 so Dodo retries
      }
    }
  } catch (e) {
    console.error("[dodo webhook] Critical wrapper error:", e);
    return res.status(500).json({ message: e.message || "Webhook handler error" });
  }
};
