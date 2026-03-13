# Stripe Billing Setup Guide

Fabric uses Stripe for merchant SaaS subscription billing. This is separate from Omise (used for customer order payments). This guide covers setup, webhook configuration, and plan management.

---

## Architecture

```
Merchant clicks "Upgrade" in portal
  │
  ▼
BillingService.subscribeToPlan(userId, planId)
  │
  ├── Find/create Stripe Customer (lazy provision)
  │
  ├── Create Stripe Checkout Session
  │     (mode: "subscription", price: STRIPE_PRICE_<PLAN>)
  │
  └── Redirect merchant to Stripe Checkout URL
        │
        ▼
     Merchant pays on Stripe-hosted page
        │
        ▼
     Stripe sends webhook → POST /webhooks/stripe
        │
        ├── checkout.session.completed → update plan in Firebase
        ├── customer.subscription.updated → sync plan changes
        ├── customer.subscription.deleted → cancel subscription
        └── invoice.payment_failed → mark as past_due
```

---

## Required Environment Variables

All Stripe env vars go as Firebase Function environment variables (NOT in GCP Secret Manager):

```bash
# Stripe secret key
STRIPE_SECRET_KEY=sk_live_...        # production
STRIPE_SECRET_KEY=sk_test_...        # test/staging

# Stripe webhook signing secret (from Stripe Dashboard → Webhooks)
STRIPE_WEBHOOK_SECRET=whsec_...

# Price IDs for each plan (from Stripe Dashboard → Products → Prices)
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PROFESSIONAL=price_...
STRIPE_PRICE_ENTERPRISE=price_...    # optional — enterprise is usually manual
```

**Critical:** If `STRIPE_PRICE_STARTER` is empty or missing, `subscribeToPlan("starter")` silently fails with no error (the Stripe session creation will fail). This is a known gap — see `docs/TECH_DEBT.md`.

---

## Stripe Dashboard Setup

### 1. Create Products

In Stripe Dashboard → Products → Add Product:

| Product | Billing Period | Amount |
|---------|---------------|--------|
| Fabric Starter | Monthly | ฿990 |
| Fabric Professional | Monthly | ฿2,990 |
| Fabric Enterprise | Monthly | Custom |

For each product, create a recurring price. Copy the Price ID (`price_...`) into the corresponding Firebase Function env var.

### 2. Configure Webhooks

In Stripe Dashboard → Webhooks → Add Endpoint:

- **URL:** `https://your-domain.com/webhooks/stripe` (routes through Cloudflare Worker → cf-api)
- **Events to listen for:**
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`
  - `invoice.payment_succeeded` (optional — for revenue tracking)

Copy the webhook signing secret (`whsec_...`) into `STRIPE_WEBHOOK_SECRET`.

### 3. Set Firebase Function env vars

```bash
firebase functions:config:set \
  stripe.secret_key="sk_live_..." \
  stripe.webhook_secret="whsec_..." \
  stripe.price_starter="price_..." \
  stripe.price_professional="price_..." \
  stripe.price_enterprise="price_..."
```

Then deploy:

```bash
firebase deploy --only functions:cf-api:cfApi
```

---

## Billing Service (`billing.service.ts`)

### Key methods

```typescript
class BillingService {
  // Returns Stripe Checkout URL for redirect
  subscribeToPlan(userId: string, planId: PlanId): Promise<{ checkoutUrl: string }>

  // Returns Stripe Customer Portal URL for self-serve subscription management
  getPortalUrl(userId: string): Promise<{ portalUrl: string }>

  // Called by webhook handler on checkout.session.completed
  handleSubscriptionCreated(session: Stripe.CheckoutSession): Promise<void>

  // Called by webhook handler on customer.subscription.updated/deleted
  handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void>

  // Called by webhook handler on invoice.payment_failed
  handlePaymentFailed(invoice: Stripe.Invoice): Promise<void>
}
```

### Stripe Customer provisioning

Stripe customers are provisioned **lazily** — only on first subscription, not on merchant onboarding.

```typescript
// BillingService.getOrCreateStripeCustomer()
const merchant = await merchantRepo.findByUserId(userId)
if (isSome(merchant.stripeCustomerId)) {
  return merchant.stripeCustomerId.value  // already exists
}

// Create new Stripe customer
const customer = await stripe.customers.create({
  email: merchant.email,
  name: merchant.storeName,
  metadata: { userId },
})

// Persist Stripe customer ID to Firebase
await merchantRepo.updateStripeCustomerId(userId, customer.id)
return customer.id
```

### Plan limits enforcement

Plan limits are enforced in cf-api middleware before expensive operations:

```typescript
// infrastructure/guards/plan.middleware.ts
export function requireActivePlan(verifier: PasetoVerifierService, merchantRepo: MerchantRepositoryPort) {
  return async (c: Context, next: Next) => {
    const userId = c.get("userId")
    const merchant = await merchantRepo.findByUserId(userId)
    if (!isSubscriptionActive(merchant)) {
      return c.json({ error: "Active subscription required", _tag: "SubscriptionRequired" }, 403)
    }
    await next()
  }
}

export function requireProductCapacity(verifier: PasetoVerifierService, merchantRepo: MerchantRepositoryPort) {
  return async (c: Context, next: Next) => {
    const userId = c.get("userId")
    const merchant = await merchantRepo.findByUserId(userId)
    if (!canAddProduct(merchant)) {
      return c.json({ error: "Product limit reached", _tag: "ProductCapacityError" }, 403)
    }
    await next()
  }
}
```

---

## Webhook Handler (`POST /webhooks/stripe`)

```typescript
// features/billing/billing.handlers.ts
app.post("/webhooks/stripe", async (c) => {
  const sig = c.req.header("stripe-signature")
  const body = await c.req.text()

  // Verify webhook signature (HMAC-SHA256)
  const event = stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET)

  switch (event.type) {
    case "checkout.session.completed":
      await billingService.handleSubscriptionCreated(event.data.object)
      break
    case "customer.subscription.updated":
      await billingService.handleSubscriptionUpdated(event.data.object)
      break
    case "customer.subscription.deleted":
      await billingService.handleSubscriptionUpdated(event.data.object)  // status = "cancelled"
      break
    case "invoice.payment_failed":
      await billingService.handlePaymentFailed(event.data.object)
      break
  }

  return c.json({ received: true })
})
```

The webhook endpoint returns 200 immediately after dispatching. If processing fails, Stripe retries with exponential backoff (up to 72 hours).

### What each webhook does to Firebase

| Stripe Event | Firebase Update |
|--------------|----------------|
| `checkout.session.completed` | `merchants/{userId}.plan`, `.planStatus: "active"`, `.stripeSubscriptionId` |
| `customer.subscription.updated` (active→past_due) | `merchants/{userId}.planStatus: "past_due"` |
| `customer.subscription.deleted` | `merchants/{userId}.planStatus: "cancelled"`, `.planExpiresAt: accessUntil` |
| `invoice.payment_failed` | `merchants/{userId}.planStatus: "past_due"` |

---

## Plan Tiers

```typescript
// domain/billing/billing.value-objects.ts
const PLANS: Record<PlanId, PlanConfig> = {
  free: {
    maxProducts: 5,
    maxOrdersPerMonth: 50,
    hasAnalytics: false,
    hasCustomDomain: false,
    stripePriceId: null,
  },
  starter: {
    maxProducts: 50,
    maxOrdersPerMonth: 500,
    hasAnalytics: true,
    hasCustomDomain: false,
    stripePriceId: process.env.STRIPE_PRICE_STARTER ?? "",
  },
  professional: {
    maxProducts: 500,
    maxOrdersPerMonth: -1,  // unlimited
    hasAnalytics: true,
    hasCustomDomain: true,
    stripePriceId: process.env.STRIPE_PRICE_PROFESSIONAL ?? "",
  },
  enterprise: {
    maxProducts: -1,        // unlimited
    maxOrdersPerMonth: -1,
    hasAnalytics: true,
    hasCustomDomain: true,
    stripePriceId: process.env.STRIPE_PRICE_ENTERPRISE ?? "",
  },
}
```

Plan helpers (pure functions):

```typescript
canAddProduct(merchant: Merchant): boolean
isSubscriptionActive(merchant: Merchant): boolean  // planStatus is "active" or "trialing"
isPlanSufficient(userPlan: PlanId, requiredPlan: PlanId): boolean  // uses PLAN_RANK
```

---

## Local Development with Stripe

### Stripe CLI (webhook forwarding)

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to local cf-api
stripe listen --forward-to http://localhost:3010/webhooks/stripe

# Copy the webhook signing secret from CLI output → STRIPE_WEBHOOK_SECRET in .env
```

### Test cards

| Scenario | Card Number |
|----------|-------------|
| Success | 4242 4242 4242 4242 |
| Decline | 4000 0000 0000 0002 |
| 3D Secure | 4000 0025 0000 3155 |
| Insufficient funds | 4000 0000 0000 9995 |

Use any future expiry date, any 3-digit CVC.

### Test webhook events manually

```bash
# Trigger a test checkout.session.completed
stripe trigger checkout.session.completed

# Trigger a subscription cancelled
stripe trigger customer.subscription.deleted
```

---

## Troubleshooting

### Subscription silently fails (no plan upgrade)

**Cause:** `STRIPE_PRICE_STARTER` is empty.

**Fix:** Set the env var and redeploy. Check Firebase Function config:
```bash
firebase functions:config:get | grep stripe
```

### Webhook returns 400

**Cause:** `stripe-signature` header doesn't match `STRIPE_WEBHOOK_SECRET`.

**Fix:** Verify `STRIPE_WEBHOOK_SECRET` matches the webhook endpoint's signing secret in Stripe Dashboard, not the account-level secret.

### Merchant's plan not updated after payment

**Cause:** Webhook delivery failed or was not configured.

**Fix:**
1. Check Stripe Dashboard → Webhooks → view attempts
2. Re-send the `checkout.session.completed` event from Stripe Dashboard
3. Or manually update Firebase: `merchants/{userId}.plan = "starter"`, `merchants/{userId}.planStatus = "active"`

### `planExpiresAt` not enforced

`planExpiresAt` is set on cancellation but no cron job enforces it. Cancelled merchants retain their plan features until you manually downgrade them or a scheduled function is implemented. Tracked in `docs/TECH_DEBT.md`.
