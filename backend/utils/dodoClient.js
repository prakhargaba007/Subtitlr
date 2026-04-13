const { DodoPayments } = require("dodopayments");

/**
 * @returns {import('dodopayments').DodoPayments | null}
 */
function getDodoClient() {
  const bearerToken = String(process.env.DODO_PAYMENTS_API_KEY || "").trim();
  if (!bearerToken) return null;
  const envRaw = String(process.env.DODO_PAYMENTS_ENVIRONMENT || "live_mode").trim();
  const environment = envRaw === "test_mode" ? "test_mode" : "live_mode";
  return new DodoPayments({
    bearerToken,
    environment,
    webhookKey: process.env.DODO_PAYMENTS_WEBHOOK_KEY || null,
  });
}

module.exports = { getDodoClient };
