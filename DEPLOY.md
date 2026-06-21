# Fabric — Deployment Guide

## Services Overview

| Service | Platform | How to Deploy |
|---|---|---|
| `apps/web` | **Vercel** | Automatic — push to `main` and Vercel deploys |
| `apps/cf-api` | **Firebase Functions** | Manual: build + `firebase deploy --only functions --project production` |
| `apps/cf-commerce` | **Firebase Functions** | Same as cf-api — build both then deploy together |
| `apps/worker` | **Cloudflare Workers** | Manual: `wrangler deploy` from `apps/worker` |

---

## Routing Layer — fabric.cool

All traffic enters via **Cloudflare CDN** → **apps/worker** (Cloudflare Worker), which proxies to the correct backend:

| Path Pattern | Routes To |
|---|---|
| `/api/*` `/auth/*` `/token/*` | `cfApi` Cloud Function (asia-east1) |
| `/checkout/*` `/events/*` `/pricing/*` `/inventory/*` `/voucher/*` `/sse/*` `/payment/*` | `cfCommerce` Cloud Function (asia-east1) |
| `/**` (everything else) | Vercel (Next.js SSR) |

```toml
# wrangler.toml
CF_API_URL          = "https://asia-east1-PROJECT_ID.cloudfunctions.net/cfApi"
CF_COMMERCE_URL     = "https://asia-east1-PROJECT_ID.cloudfunctions.net/cfCommerce"
FIREBASE_HOSTING_URL = "https://your-app.vercel.app"
routes = [{ pattern = "fabric.cool/*", zone_name = "fabric.cool" }]
```

```bash
cd apps/worker && wrangler deploy
```

---

## Firebase Cloud Functions

### cf-api (`apps/cf-api`)

- **Stack:** Hono v4.7 · Node.js 22 · asia-east1
- **Handles:** Auth (PASETO v3.local) · Products · Cart · Orders · Stripe billing · Payouts · Internal token bridge
- **Config:** 512 MiB · 60s timeout · `minInstances: 1` (set via `CF_MIN_INSTANCES`) · concurrency: 80

```bash
# From project root
cd apps/cf-api
bun run build
firebase deploy --only functions:cf-api:cfApi --project production
```

### cf-commerce (`apps/cf-commerce`)

- **Stack:** Hono v4.7 · Node.js 22 · asia-east1
- **Handles:** Pricing pipeline (Railway ORP) · Events CQRS (Free Monad + SSE) · Payment — Omise card + PromptPay QR
- **Config:** 512 MiB · 120s timeout · `minInstances: 0` · concurrency: 80

```bash
cd apps/cf-commerce
bun run build
firebase deploy --only functions:cf-commerce:cfCommerce --project production
```

### Deploy both at once

```bash
# From project root
cd /path/to/fabric
bunx turbo build --filter=cf-api --filter=cf-commerce
cd apps/cf-api
firebase deploy --only functions --project production
```

> **Shared packages** bundled at build time: `@fabric/types` · `@fabric/firebase` · `@fabric/cache` · `@fabric/orpc` · `@fabric/contract`

---

## Web App — Next.js (`apps/web`)

- **Platform:** Vercel (SSR required — cannot use Firebase Hosting for server rendering)
- **Stack:** Next.js 16.1.6 · React 19 · better-auth + PostgreSQL · Dexie IndexedDB (offline cart) · wagmi + viem (Web3)

```bash
# Auto-deploy on push to main, or manual:
vercel --prod
```

### Firebase Hosting (static chunks only)

Firebase Hosting serves `apps/web/.next/static` (JS/CSS/fonts) with `Cache-Control: immutable`. It does **not** handle SSR — Vercel does.

```bash
cd apps/web && bun run build
cd ../.. && firebase deploy --only hosting
```

---

## Databases & Storage

| Store | Used By | Purpose |
|---|---|---|
| Firebase Realtime Database | cf-api, cf-commerce | users · products · orders · carts · merchants · vouchers · event_log · refresh_tokens · token_blacklist · login_attempts |
| Firebase Storage | cf-api, cf-commerce | Product images · merchant assets (`@fabric/cache/gcs`) |
| PostgreSQL | apps/web only | better-auth sessions · user roles (`customer` \| `store_owner` \| `admin`) · Drizzle ORM |
| Memcached (Cloud Memorystore) | cf-api | Product cache · Rate limiting (10 req/min sliding window login) |
| Redis | apps/web (optional) | Next.js ISR multi-instance tag invalidation |

---

## Google Cloud Platform

### Secret Manager — cf-api only

Only two secrets go through Secret Manager. Everything else is a plain Firebase Function env var.

```bash
echo -n "$(openssl rand -hex 32)" | gcloud secrets create PASETO_KEY --data-file=-
echo -n "$(openssl rand -hex 20)" | gcloud secrets create INTERNAL_SECRET --data-file=-
```

Also set these env vars on cf-api:

```
USE_SECRET_MANAGER=true
GCP_PROJECT_ID=your-project-id
```

> **cf-commerce does not use Secret Manager.** Set `INTERNAL_SECRET` directly as a Firebase Function env var on cf-commerce.

---

## Payment Services

### Stripe — Merchant Billing (cf-api only)

- Library: `stripe` v17 · API version `2025-01-27.acacia`
- Plans: `free` / `starter` / `professional` / `enterprise`
- Webhook events: `customer.subscription.updated` · `customer.subscription.deleted`
- Webhook endpoint: `POST /webhooks/stripe` on cfApi

### Omise — Card + PromptPay (cf-commerce only)

- **Card:** OmiseJS CDN tokenizes client-side → server-side charge via cfCommerce
- **PromptPay:** QR generation + client polling
- Webhook HMAC-SHA256: `POST /payment/omise/webhook` on cfCommerce

### Web3 — USDC on Base (x402 Protocol)

- Libraries: `wagmi` v3 · `viem` v2
- Flow: `402 response` → user signs EIP-3009 TransferWithAuthorization → resubmit with `X-Payment` header
- Rate: CoinGecko USDC/THB (2-min revalidation)

---

## Environment Variables

### `apps/cf-api`

```
# GCP Secret Manager (cf-api only)
PASETO_KEY=<64-char hex>
INTERNAL_SECRET=<shared secret>
USE_SECRET_MANAGER=true
GCP_PROJECT_ID=your-project-id

# Firebase Function env vars
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PROFESSIONAL=price_...
STRIPE_PRICE_ENTERPRISE=price_...
STRIPE_PORTAL_RETURN_URL=https://fabric.cool/merchant/billing
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
MEMCACHED_SERVERS=host:11211
EVENTS_SERVICE_URL=https://.../cfCommerce
COMMERCE_SERVICE_URL=https://.../cfCommerce
PRICING_SERVICE_URL=https://.../cfCommerce
PAYMENT_SERVICE_URL=https://.../cfCommerce
CORS_ORIGIN=https://fabric.cool
CF_MIN_INSTANCES=1
```

### `apps/cf-commerce`

> **Does not use Secret Manager.** Set all vars directly as Firebase Function env vars.

```
INTERNAL_SECRET=<same value as cf-api>
PAYMENT_GATEWAY=omise
OMISE_SECRET_KEY=skey_...
OMISE_WEBHOOK_SECRET=...
API_SERVICE_URL=https://asia-east1-PROJECT.cloudfunctions.net/cfApi
CORS_ORIGIN=https://fabric.cool
```

> `INTERNAL_SECRET` must be identical to the value in cf-api.

### `apps/web` (Vercel)

```
API_CORE_URL=https://.../cfApi
NEXT_PUBLIC_API_CORE_URL=https://.../cfApi
NEXT_PUBLIC_APP_URL=https://fabric.cool
DATABASE_URL=postgresql://...
BETTER_AUTH_SECRET=<random 64 chars>
BETTER_AUTH_URL=https://fabric.cool
INTERNAL_SECRET=<same as cf-api>
FACEBOOK_CLIENT_ID=...
FACEBOOK_CLIENT_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
REVALIDATE_SECRET=<random secret>
REDIS_URL=redis://...   # optional — only needed for ISR tag invalidation
```

---

## First-Time Deploy Order

1. **Cloudflare** — Add `fabric.cool` to Cloudflare, update nameservers at registrar. Wait ~10–30 min for propagation.
2. **Firebase Project** — Create project, upgrade to Blaze plan, enable Realtime Database + Storage in `asia-east1`.
3. **GCP Secret Manager** — Create `PASETO_KEY` and `INTERNAL_SECRET` secrets (cf-api only).
4. **Firebase Function env vars** — Set Stripe, Omise, Google, and service URL env vars for both functions.
5. **Deploy Firebase Functions** — Build both codebases and run `firebase deploy --only functions --project production`.
6. **PostgreSQL** — Provision a database (Neon or Supabase free tier). Copy `DATABASE_URL`.
7. **Deploy Vercel** — Set all env vars (`API_CORE_URL`, `DATABASE_URL`, `BETTER_AUTH_SECRET`, etc.) then `vercel --prod`.
8. **Deploy Cloudflare Worker** — Update `wrangler.toml` with real function URLs, then `cd apps/worker && wrangler deploy`.
9. **Deploy Firebase Hosting** — Build Next.js, then `firebase deploy --only hosting`.
10. **Configure Webhooks** — Point Stripe and Omise dashboards to the deployed function URLs:
    - Stripe: `https://.../cfApi/webhooks/stripe`
    - Omise: `https://.../cfCommerce/payment/omise/webhook`

---

## Health Check Endpoints

```bash
# cf-api
GET https://fabric.cool/api/health

# cf-commerce
GET https://fabric.cool/events/health

# apps/web — no dedicated health route
# /api/* routes to cfApi, not the Next.js app
# Verify via Vercel dashboard or GET /
```

---

## Verify DNS Propagation

After pointing `fabric.cool` to Cloudflare, check global propagation at:

- https://dnschecker.org — query type `NS` or `A`, domain `fabric.cool`
- https://www.whatsmydns.net

All green = propagated. Typically 10–30 min, up to 48h maximum.
