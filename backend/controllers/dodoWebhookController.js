const DodoWebhookReceipt = require("../models/DodoWebhookReceipt");
const { getDodoClient } = require("../utils/dodoClient");
const { processDodoWebhookEvent, recordWebhookReceipt } = require("../services/billingSubscriptionService");

/**
 * POST /api/webhooks/dodo
 * Raw body required (mounted with express.raw in app.js).
 */
exports.handleDodoWebhook = async (req, res) => {
  const webhookId = String(req.headers["webhook-id"] || "").trim();
  try {
    if (!webhookId) {
      return res.status(400).json({ message: "Missing webhook-id header." });
    }

    const dup = await DodoWebhookReceipt.findOne({ webhookId }).lean();
    if (dup) {
      return res.status(200).json({ received: true, duplicate: true });
    }

    const client = getDodoClient();
    const key = client?.webhookKey || String(process.env.DODO_PAYMENTS_WEBHOOK_KEY || "").trim();
    if (!client || !key) {
      return res.status(503).json({ message: "Dodo webhook key not configured." });
    }

    const raw = req.body instanceof Buffer ? req.body.toString("utf8") : String(req.body || "");
    const headers = {
      "webhook-id": String(req.headers["webhook-id"] || ""),
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

    await processDodoWebhookEvent(payload);
    await recordWebhookReceipt(webhookId, payload.type || "");
    return res.status(200).json({ received: true });
  } catch (e) {
    console.error("[dodo webhook]", e);
    if (e.statusCode === 422) {
      try {
        await DodoWebhookReceipt.create({ webhookId, eventType: "skipped_missing_user" });
      } catch (_) {}
      return res.status(200).json({ received: true, skipped: true, reason: e.message });
    }
    return res.status(500).json({ message: e.message || "Webhook handler error" });
  }
};
