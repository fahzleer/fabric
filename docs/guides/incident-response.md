# Incident Response Runbooks

Common failure scenarios with diagnosis steps and remediation procedures.

---

## Severity Levels

| Level | Impact | Response Time |
|-------|--------|---------------|
| P1 | All orders failing / payment processing down | 15 min |
| P2 | Merchant portal inaccessible / subscription billing broken | 1 hour |
| P3 | Degraded performance / specific feature broken | 4 hours |
| P4 | Minor UI issue / non-blocking | Next sprint |

---

## Runbook: P1 — Orders Not Processing

**Symptoms:** Customers cannot place orders; `POST /api/orders` returns 5xx or hangs.

### 1. Check cf-api health

```bash
curl https://api.fabric.co/api/health
```

If timeout or 5xx: cf-api is down or cold-starting. Check Firebase Functions console for unhandled exceptions.

### 2. Check Firebase RTDB connectivity

```bash
firebase database:get /orders --limit=1
```

If this fails: RTDB is unavailable. Check Firebase Status page (status.firebase.google.com).

### 3. Check cf-commerce connectivity

```bash
curl https://commerce.fabric.co/health
```

If unavailable: pricing pipeline is down. `OrderService.placeOrder()` will fall back to subtotal-only pricing, but this should still succeed.

### 4. Check Omise gateway

```bash
curl https://api.omise.co/charges -u <OMISE_SECRET_KEY>:
```

If 5xx from Omise: payment initiation will fail. `HttpPaymentAdapter` is fire-and-forget, so orders may still be created but never confirmed.

**Mitigation for Omise outage:**
- Orders are created with `status: "pending"` regardless
- When Omise recovers, the card charge may still succeed and the webhook will fire
- Do not manually confirm orders during an Omise outage — wait for the webhook

### 5. Check recent code deployment

```bash
firebase functions:log --only cfApi --lines=50
```

Look for import errors, `SyntaxError`, or configuration errors that appeared after the last deploy.

**Rollback:**
```bash
git checkout <previous-commit>
firebase deploy --only functions:cf-api:cfApi
```

---

## Runbook: P1 — Payment Webhook Not Processing

**Symptoms:** Orders stuck in `pending` status after successful payment.

### 1. Verify Stripe webhook delivery

Stripe Dashboard → Webhooks → select endpoint → view recent events.

Check for failed delivery attempts (red). Stripe retries with backoff — last retry is after 72 hours.

### 2. Verify webhook signature

Check cf-api logs:

```
jsonPayload.path="/webhooks/stripe"
severity=ERROR
```

If you see `Webhook signature verification failed`:
- `STRIPE_WEBHOOK_SECRET` is wrong
- The request body was modified in transit (proxy/CDN stripping headers)

**Fix:** Copy the correct signing secret from Stripe Dashboard → Webhooks → reveal signing secret.

### 3. Manually re-trigger the webhook

In Stripe Dashboard, find the `checkout.session.completed` event and click **Resend**.

### 4. Manual order confirmation (last resort)

```bash
curl -X POST https://api.fabric.co/internal/payment-result \
  -H "x-internal-secret: <INTERNAL_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"orderId":"<orderId>","paymentId":"<stripePaymentIntentId>","success":true}'
```

This triggers `OrderService.confirmOrder()` directly. Use with care — calling this on an already-confirmed order is a no-op (idempotent FSM).

---

## Runbook: P2 — Merchant Portal Inaccessible

**Symptoms:** Merchants cannot access `/merchant/**` routes; 500 errors or blank pages.

### 1. Check better-auth / PostgreSQL

The merchant portal depends on the PostgreSQL `fabric` database for sessions.

```bash
psql postgresql://fah@localhost:5432/fabric -c "SELECT 1"
```

If unavailable: all session validation fails. Check connection limits (max 3 from `admin-db.ts`).

### 2. Check the dual-auth bridge

Look for errors from `POST /internal/issue-token`:

```
jsonPayload.path="/internal/issue-token"
severity=ERROR
```

If `INTERNAL_SECRET` mismatch: apps/web and cf-api have different values. Verify both use the same secret.

### 3. Check apps/web deployment (Vercel)

Vercel Dashboard → Deployments → check latest deployment status and build logs.

If Next.js build failed, the previous deployment remains active. Check error logs for missing env vars or type errors.

### 4. Check PASETO_KEY

```bash
firebase functions:config:get | grep paseto
```

If `PASETO_KEY` is wrong length or changed without token migration: all existing tokens become invalid and all merchants are logged out simultaneously. Issue new tokens (users re-login).

---

## Runbook: P2 — Stripe Subscriptions Not Activating

**Symptoms:** Merchants pay via Stripe but their plan does not upgrade from `free`.

### Diagnosis

1. Check if `STRIPE_PRICE_STARTER` / `STRIPE_PRICE_PROFESSIONAL` env vars are set:
   ```bash
   firebase functions:config:get | grep stripe
   ```

2. Check `BillingService.handleSubscriptionCreated()` logs:
   ```
   jsonPayload.message=~"subscription|plan"
   severity=ERROR
   ```

3. Verify the Stripe Price ID matches the Stripe Dashboard (they look like `price_1ABC...`).

### Fix

```bash
firebase functions:config:set stripe.price_starter="price_..."
firebase deploy --only functions:cf-api:cfApi

# Manually trigger the upgrade for affected merchants:
firebase database:update /merchants/<userId> \
  --data '{"plan":"starter","planStatus":"active","stripeSubscriptionId":"sub_..."}'
```

---

## Runbook: P3 — Rate Limiting False Positives

**Symptoms:** Legitimate users are getting 429 responses; `RateLimitError` in logs.

### Diagnosis

The rate limiter uses Memcached with an IP + path sliding window. If multiple users share an IP (corporate NAT, VPN), they may hit the limit collectively.

```bash
# Check current limit for an IP (via Memcached CLI)
telnet <MEMCACHED_HOST> 11211
get rate_limit:/auth/login:<ip>
```

### Mitigation

If you cannot connect to Memcached, the rate limiter fails open (no limiting). This means an outage is safer than a false-positive for legitimate traffic.

**Temporary fix:** Increase the rate limit ceiling in `auth.middleware.ts`:

```typescript
const RATE_LIMIT = {
  "/auth/login": { requests: 20, windowSeconds: 60 },  // increased from 10
}
```

Requires redeployment.

---

## Runbook: P3 — Token Replay Attack Detected

**Symptoms:** A merchant reports being logged out of all sessions unexpectedly. Logs show `Token family revoked`.

### What happened

A refresh token was used after it was already blacklisted. This triggers family revocation — all refresh tokens from the same login session are revoked. The user must re-login.

### Diagnosis

```bash
# Find the token family in Firebase
firebase database:get /refresh_tokens \
  --orderBy=tokenFamily \
  --equalTo=<familyId>
```

If all tokens in the family have `revokedAt` set, a replay was detected.

### Response

This is working as designed — replay detection is a security feature. The merchant should re-login.

If this happens to many users simultaneously, check for:
- Duplicate request delivery from a reverse proxy
- Bug in the client-side token storage (sending old refresh tokens)
- Session hijacking attempt

---

## Runbook: P3 — Firebase RTDB Hot Path

**Symptoms:** High read latency on `/api/products`; Firebase Console shows high bandwidth.

**Root cause:** `product_current` is publicly readable. If a high-traffic event drives heavy traffic to the storefront, all requests hit Firebase RTDB directly.

### Mitigation

1. Enable Memcached caching for `findActive()`:
   ```typescript
   // HttpProductApiAdapter already uses unstable_cache in apps/web
   // Ensure MEMCACHED_SERVERS env var is set and the cache TTL is reasonable
   ```

2. Increase ISR revalidation time:
   ```typescript
   // http-product-api.adapter.ts
   { revalidate: 600 }  // 10 minutes instead of 5
   ```

3. Set Firebase RTDB minimum instances to avoid cold start latency on read path.

---

## Runbook: P4 — SSE Connections Dropping

**Symptoms:** Real-time notifications (order confirmed, new product) not reaching store owners.

**Context:** SSE connections are long-lived (open for the session). Cloudflare Worker may buffer/timeout long responses.

### Diagnosis

```bash
# Count active SSE connections
firebase functions:log --only cfCommerce | grep "SSE registered"
```

### Mitigation

If SSE is not critical (UI falls back to polling), disable the SSE connection endpoint in the Worker route table and serve it directly from Firebase Hosting.

If SSE is critical, configure Cloudflare to allow streaming responses (disable response buffering for the `/sse/*` path).

---

## Post-Incident Checklist

- [ ] Incident timeline documented in Slack/Notion
- [ ] Root cause identified
- [ ] Affected merchants notified (if order data impacted)
- [ ] Fix deployed and validated
- [ ] Monitoring alert added to prevent recurrence
- [ ] TECH_DEBT.md updated if a systemic issue was found
- [ ] Runbook updated with new learnings

---

## On-Call Contacts

| System | Contact |
|--------|---------|
| Firebase Functions | GCP Console → Firebase Console |
| Stripe | Stripe Support (dashboard.stripe.com/support) |
| Omise | Omise Support (support@omise.co) |
| Cloudflare Worker | Cloudflare Dashboard → Workers & Pages |
| PostgreSQL (Vercel) | Vercel Dashboard → Storage → Postgres |

---

## Useful Firebase CLI Commands

```bash
# View function logs (streaming)
firebase functions:log --only cfApi --follow

# Deploy single function
firebase deploy --only functions:cf-api:cfApi

# Get function config
firebase functions:config:get

# Set a single config value
firebase functions:config:set stripe.secret_key="sk_live_..."

# Read from RTDB
firebase database:get /orders/<orderId>
firebase database:get /merchants/<userId>

# Write to RTDB (use with extreme caution)
firebase database:update /orders/<orderId> --data '{"status":"cancelled"}'

# View RTDB rules
firebase database:rules:get

# Deploy RTDB rules only
firebase deploy --only database
```
