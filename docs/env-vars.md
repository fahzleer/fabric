# Environment Variables Reference

All environment variables across the entire monorepo, per app. Keep a `.env` file at the root of each app for local development. Never commit secrets to version control.

---

## apps/cf-api

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PASETO_KEY` | ✅ | — | 64-char hex string (32 bytes). Symmetric key for PASETO v3.local tokens. Generate: `openssl rand -hex 32` |
| `INTERNAL_SECRET` | ✅ | — | Shared secret for server-to-server calls (`/internal/**`). Must match `INTERNAL_SECRET` in cf-commerce and apps/web. |
| `CORS_ORIGIN` | | `*` | Allowed CORS origin (e.g. `https://yourapp.com`). Use `*` in dev only. |
| `MEMCACHED_SERVERS` | | `localhost:11211` | Comma-separated Memcached server addresses for rate limiting. |
| `EVENTS_SERVICE_URL` | | `http://localhost:8082` | URL to POST domain events (cf-commerce `/events`). |
| `COMMERCE_SERVICE_URL` | | `http://localhost:8083` | cf-commerce base URL (currently unused separately from pricing/payment). |
| `PRICING_SERVICE_URL` | | `http://localhost:8082` | cf-commerce URL for `/checkout/calculate` calls. |
| `PAYMENT_SERVICE_URL` | | `http://localhost:8082` | cf-commerce URL for `/payment/initiate` calls. |
| `GOOGLE_CLIENT_ID` | | `""` | Google OAuth client ID for social login (`POST /auth/login/google`). |
| `STRIPE_SECRET_KEY` | | `""` | Stripe secret key (`sk_live_...` or `sk_test_...`). Billing routes return errors if empty. |
| `STRIPE_WEBHOOK_SECRET` | | `""` | Stripe webhook endpoint signing secret (`whsec_...`). Webhooks will be rejected if empty. |
| `STRIPE_PRICE_STARTER` | | `""` | Stripe Price ID for the Starter plan (฿990/mo). Get from Stripe dashboard → Products. |
| `STRIPE_PRICE_PROFESSIONAL` | | `""` | Stripe Price ID for the Professional plan (฿2,990/mo). |
| `STRIPE_PRICE_ENTERPRISE` | | `""` | Stripe Price ID for the Enterprise plan (custom). |
| `STRIPE_PORTAL_RETURN_URL` | | `http://localhost:3000/merchant/billing` | URL Stripe redirects to after the customer portal session. |
| `USE_SECRET_MANAGER` | | `false` | Set to `true` in production to load `PASETO_KEY` and `INTERNAL_SECRET` from GCP Secret Manager instead of env vars. |
| `GCP_PROJECT_ID` | | — | GCP project ID. Required when `USE_SECRET_MANAGER=true`. |
| `PORT` | | `3010` | Port for the local Bun dev server. Ignored in Cloud Functions. |

### Firebase (cf-api)

cf-api uses `@firebase/firebase-admin` via `createFirebaseFromEnv()` in `@fabric/firebase`. Firebase credentials are resolved automatically from the environment:

| Variable | Required | Notes |
|----------|----------|-------|
| `FIREBASE_DATABASE_URL` | ✅ | e.g. `https://your-project-default-rtdb.asia-southeast1.firebasedatabase.app` |
| `GOOGLE_APPLICATION_CREDENTIALS` | Prod | Path to service account JSON. Not needed in Cloud Functions (auto-resolved). |

---

## apps/cf-commerce

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `INTERNAL_SECRET` | ✅ | — | Must match `INTERNAL_SECRET` in cf-api. Validates `/payment/promptpay/create` and payment result callbacks. |
| `CORS_ORIGIN` | | `*` | Allowed CORS origin. |
| `API_SERVICE_URL` | | `http://localhost:3010` | cf-api base URL. cf-commerce POSTs payment results to `${API_SERVICE_URL}/internal/payment-result`. |
| `PAYMENT_GATEWAY` | | `mock` | Payment gateway to use. `"mock"` for dev (95% success rate, no real charges). `"omise"` for production. |
| `OMISE_SECRET_KEY` | | `""` | Omise secret key. Required when `PAYMENT_GATEWAY=omise`. Get from Omise dashboard. |
| `OMISE_WEBHOOK_SECRET` | | `""` | Omise webhook HMAC-SHA256 signing secret. Webhooks are accepted without verification if empty. |
| `PORT` | | `8082` | Port for the local Bun dev server. |

### Firebase (cf-commerce)

Same pattern as cf-api — uses `createFirebaseFromEnv()`.

| Variable | Required | Notes |
|----------|----------|-------|
| `FIREBASE_DATABASE_URL` | ✅ | Same RTDB instance as cf-api. |
| `GOOGLE_APPLICATION_CREDENTIALS` | Prod | Auto-resolved in Cloud Functions. |

---

## apps/web

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | ✅ | `postgresql://postgres:postgres@localhost:5432/fabric` | PostgreSQL connection string for better-auth sessions. |
| `INTERNAL_SECRET` | ✅ | — | Must match cf-api. Used by `merchant-api.ts` to call `/internal/issue-token`. |
| `NEXT_PUBLIC_API_URL` | | `http://localhost:3010` | cf-api base URL. Used by the browser and server-side fetch calls. |
| `NEXT_PUBLIC_APP_URL` | | `http://localhost:3000` | Public URL of the web app. Used for OAuth redirect URIs and `trustedOrigins`. |
| `FACEBOOK_CLIENT_ID` | | — | Facebook OAuth app ID. Required to enable `POST /auth/login/facebook` in cf-api. |
| `FACEBOOK_CLIENT_SECRET` | | — | Facebook OAuth secret. Must match the app registered at developers.facebook.com. |
| `GOOGLE_CLIENT_ID` | | — | Google OAuth client ID. Enables the "Sign in with Google" button. |
| `GOOGLE_CLIENT_SECRET` | | — | Google OAuth client secret. |
| `BETTER_AUTH_SECRET` | | — | Secret for better-auth session signing. Generate: `openssl rand -base64 32`. |
| `NEXT_PUBLIC_MIXPANEL_TOKEN` | | — | Mixpanel project token for analytics. Analytics calls are no-ops if empty. |

---

## apps/worker

Worker env vars are not in `.env` files — they are set in `wrangler.toml` (non-secret) or in the Cloudflare dashboard / `wrangler secret put` (secret).

| Variable | Required | Description |
|----------|----------|-------------|
| `CF_API_URL` | ✅ | Full URL to the cf-api Cloud Function (e.g. `https://asia-east1-project.cloudfunctions.net/cfApi`). |
| `CF_COMMERCE_URL` | ✅ | Full URL to the cf-commerce Cloud Function. |
| `FIREBASE_HOSTING_URL` | ✅ | Firebase Hosting URL for the Next.js app (e.g. `https://your-project.web.app`). |

Set secrets:
```bash
wrangler secret put CF_API_URL
wrangler secret put CF_COMMERCE_URL
wrangler secret put FIREBASE_HOSTING_URL
```

---

## Shared secrets that must match across services

The following secrets must have identical values across all services that use them:

| Secret | Used in |
|--------|---------|
| `INTERNAL_SECRET` | cf-api, cf-commerce, apps/web |
| `FIREBASE_DATABASE_URL` | cf-api, cf-commerce |

Mismatched `INTERNAL_SECRET` causes:
- `/internal/issue-token` returns 401 → web portal cannot fetch merchant data
- `/payment/promptpay/create` returns 401 → PromptPay QR generation fails
- `/internal/payment-result` returns 401 → Orders remain stuck in `pending`

---

## Environment setup checklist for local dev

```bash
# 1. Generate PASETO key
export PASETO_KEY=$(openssl rand -hex 32)

# 2. Generate internal secret
export INTERNAL_SECRET=$(openssl rand -hex 32)

# 3. Start PostgreSQL (for apps/web)
psql -c "CREATE DATABASE fabric;"
cd apps/web && bunx drizzle-kit push

# 4. Start Firebase emulators (optional — use real RTDB in dev)
firebase emulators:start --only database

# 5. Start all services
bun run dev
```

---

## Production deployment checklist

- [ ] `PASETO_KEY` — stored in GCP Secret Manager, `USE_SECRET_MANAGER=true`
- [ ] `INTERNAL_SECRET` — stored in GCP Secret Manager, same value in cf-commerce and web
- [ ] `STRIPE_SECRET_KEY` — live key, not test key
- [ ] `STRIPE_WEBHOOK_SECRET` — copied from Stripe webhook endpoint dashboard
- [ ] `STRIPE_PRICE_STARTER/PROFESSIONAL/ENTERPRISE` — live Price IDs
- [ ] `OMISE_SECRET_KEY` — live key
- [ ] `OMISE_WEBHOOK_SECRET` — from Omise webhook settings
- [ ] `PAYMENT_GATEWAY=omise` — set in cf-commerce
- [ ] `CORS_ORIGIN` — exact origin, not `*`
- [ ] `CF_API_URL`, `CF_COMMERCE_URL`, `FIREBASE_HOSTING_URL` — in Cloudflare Worker secrets
- [ ] Firebase RTDB rules deployed: `firebase deploy --only database`
