# Payments & Billing Architecture

This document outlines how the Kili Labs backend integrates with Dodopayments to manage subscriptions, one-time credit purchases, and overall billing observability.

## 🏢 Core Models
All billing operations interact with these three Mongoose models:
- **`PlanCatalog`** ([`../backend/models/PlanCatalog.js`](../backend/models/PlanCatalog.js)): The source of truth for available plans. It stores the price, duration (monthly/yearly), included credits, and feature flags (e.g., max file size) for each tier.
- **`UserSubscription`** ([`../backend/models/UserSubscription.js`](../backend/models/UserSubscription.js)): Links a user to a `PlanCatalog` entry. It tracks the subscription status, renewal date, and the Dodo subscription ID.
- **`CreditTransaction`** ([`../backend/models/CreditTransaction.js`](../backend/models/CreditTransaction.js)): A ledger that records every credit addition (e.g., subscription renewal) and deduction (e.g., dubbing a 5-minute video).

## 🔌 Integration Flow

### 1. Checkout Session Creation
When a user clicks "Upgrade" or buys credits on the frontend, a request is made to `POST /api/billing/dodo/checkout-session` ([`../backend/routes/billingRoutes.js`](../backend/routes/billingRoutes.js)).
- The `billingController` validates the requested plan ID against the `PlanCatalog`.
- It makes an API call to Dodopayments to generate a checkout URL.
- The frontend redirects the user to this URL to complete the payment.

### 2. Webhook Processing
Dodopayments uses webhooks to asynchronously notify our backend about successful payments, subscription renewals, or cancellations.
- **Endpoint**: `POST /api/webhooks/dodo` ([`../backend/routes/dodoWebhookRoutes.js`](../backend/routes/dodoWebhookRoutes.js))
- **IMPORTANT**: This endpoint must receive the raw body to verify the cryptographic signature sent by Dodopayments (configured in `app.js` before the JSON body parser).
- **Controller**: `dodoWebhookController.js`. It parses events like `payment.succeeded` or `subscription.active`.
  - On `payment.succeeded`, it checks if the payment was for credits or a subscription, creates a `CreditTransaction`, updates the user's `availableCredits`, and (if applicable) updates the `UserSubscription` document.

### 3. Credit Deductions
When a user initiates an AI job (like dubbing), the backend calculates the required credits based on file duration.
- The `assertEnoughCredits` utility ([`../backend/utils/creditUtils.js`](../backend/utils/creditUtils.js)) verifies the balance.
- Upon job completion, credits are formally deducted, and a negative `CreditTransaction` is logged.
- The user's active plan dictates limits, such as maximum video length, which is enforced via the `featureFlags` defined in the `PlanCatalog`.
