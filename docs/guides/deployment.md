# Deployment Guide

---

## Infrastructure Overview

| Component | Platform | Deployment Unit |
|---|---|---|
| cf-api | Firebase Functions v2 (Cloud Run) | `cfApi` function |
| cf-commerce | Firebase Functions v2 (Cloud Run) | `cfCommerce` function |
| apps/web | Firebase Hosting (Next.js SSR) | Static + SSR pages |
| apps/worker | Cloudflare Workers | Wrangler deploy |
| PostgreSQL | Cloud SQL or self-hosted | Manual provisioning |
| Firebase RTDB | Firebase (managed) | Provisioned via console |
| Memcached | Cloud Memorystore or self-hosted | Manual provisioning |

---

## Prerequisites

```bash
# Firebase CLI (for Functions + Hosting)
npm install -g firebase-tools
firebase login

# Wrangler (for Cloudflare Worker)
npm install -g wrangler
wrangler login
```

---

## Secrets Management (Production)

In production, secrets are stored in **GCP Secret Manager** and loaded at cold start by `loadSecrets()` in cf-api. cf-commerce uses environment variables (set in `firebase.json` or via Firebase CLI).

### Create secrets in GCP Secret Manager

```bash
# Set your project
gcloud config set project <your-firebase-project-id>

# Create each secret
echo -n "<value>" | gcloud secrets create PASETO_KEY --data-file=-
echo -n "<value>" | gcloud secrets create INTERNAL_SECRET --data-file=-
echo -n "<value>" | gcloud secrets create STRIPE_SECRET_KEY --data-file=-
echo -n "<value>" | gcloud secrets create STRIPE_WEBHOOK_SECRET --data-file=-
# ... etc.

# Grant the Cloud Function service account access
gcloud projects add-iam-policy-binding <project-id> \
  --member="serviceAccount:<project-id>@appspot.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### cf-api Secret Names

`loadSecrets()` reads these names from Secret Manager:
- `PASETO_KEY`
- `INTERNAL_SECRET`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_STARTER`
- `STRIPE_PRICE_PROFESSIONAL`
- `STRIPE_PRICE_ENTERPRISE`
- `STRIPE_PORTAL_RETURN_URL`
- `GOOGLE_CLIENT_ID`

Non-secret config (CORS, URLs) is set via environment variables in the Firebase function configuration.

---

## Firebase Functions Deployment

### firebase.json Configuration

```json
{
  "functions": [
    {
      "source": "apps/cf-api",
      "codebase": "cf-api",
      "ignore": ["node_modules", ".git", "**/*.spec.ts"]
    },
    {
      "source": "apps/cf-commerce",
      "codebase": "cf-commerce",
      "ignore": ["node_modules", ".git", "**/*.spec.ts"]
    }
  ],
  "hosting": {
    "source": "apps/web",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "frameworksBackend": {
      "region": "asia-east1"
    }
  },
  "database": {
    "rules": "database.rules.json"
  },
  "storage": {
    "rules": "storage.rules"
  }
}
```

### Deploy

```bash
# Deploy everything
firebase deploy

# Deploy only functions
firebase deploy --only functions

# Deploy specific function
firebase deploy --only functions:cfApi
firebase deploy --only functions:cfCommerce

# Deploy only hosting (web app)
firebase deploy --only hosting

# Deploy database rules
firebase deploy --only database
```

### Function Configuration

Set runtime environment variables (non-secrets) via Firebase CLI:

```bash
# cf-api
firebase functions:config:set \
  cors.origin="https://your-domain.com" \
  service.events_url="https://cfcommerce-xxxx.run.app" \
  service.pricing_url="https://cfcommerce-xxxx.run.app" \
  service.payment_url="https://cfcommerce-xxxx.run.app"

# cf-commerce
firebase functions:config:set \
  cors.origin="https://your-domain.com" \
  service.api_url="https://cfapi-xxxx.run.app" \
  payment.gateway="omise"
```

### Function Spec (cf-api)

```typescript
// apps/cf-api/src/index.ts
export const cfApi = onRequest({
  memory: "512MiB",
  timeoutSeconds: 60,
  minInstances: 1,       // Always warm — no cold starts for API traffic
  concurrency: 80,
  region: process.env.CLOUD_FUNCTION_REGIONS?.split(",") ?? ["asia-east1"],
}, handler)
```

### Function Spec (cf-commerce)

```typescript
// apps/cf-commerce/src/index.ts
export const cfCommerce = onRequest({
  memory: "512MiB",
  timeoutSeconds: 120,   // SSE connections need extended timeout
  minInstances: 0,       // Scales to zero (pricing/payment are synchronous, not persistent)
  concurrency: 80,
  region: ["asia-east1"],
}, handler)
```

---

## Cloudflare Worker Deployment

### wrangler.toml

```toml
name = "fabric-worker"
main = "src/index.ts"
compatibility_date = "2024-01-01"
```

### Set Production Variables

```bash
# Production values via wrangler secret
wrangler secret put CF_API_URL
# Enter: https://cfapi-xxxx-uc.a.run.app

wrangler secret put CF_COMMERCE_URL
# Enter: https://cfcommerce-xxxx-uc.a.run.app

wrangler secret put FIREBASE_HOSTING_URL
# Enter: https://your-project.web.app
```

### Deploy

```bash
cd apps/worker
wrangler deploy
```

### Custom Domain

In the Cloudflare dashboard: Workers & Pages → your worker → Triggers → Add Custom Domain. Point `api.yourdomain.com` (or just `yourdomain.com`) to the worker.

---

## PostgreSQL Setup

better-auth requires PostgreSQL for session storage. In production, use Cloud SQL (PostgreSQL) for managed HA.

```bash
# Create Cloud SQL instance (PostgreSQL 16)
gcloud sql instances create fabric-sessions \
  --database-version=POSTGRES_16 \
  --tier=db-f1-micro \
  --region=asia-east1

# Create database
gcloud sql databases create fabric --instance=fabric-sessions

# Set password for postgres user
gcloud sql users set-password postgres \
  --instance=fabric-sessions \
  --password=<secure-password>

# Connect and run migrations
gcloud sql connect fabric-sessions --user=postgres
# Inside psql: run apps/web/db/migrations/*.sql
```

`DATABASE_URL` in `apps/web` production environment:
```
postgresql://postgres:<password>@/<database>?host=/cloudsql/<instance-connection-name>
```

(Cloud SQL uses Unix socket in production — not `localhost`.)

---

## Firebase RTDB Rules

```json
// database.rules.json
{
  "rules": {
    ".read": false,
    ".write": false,
    // Public product catalog — read-only for all
    "products_current": {
      ".read": true
    },
    // All other paths require server-side auth (Admin SDK bypasses rules)
    "users": { ".read": false, ".write": false },
    "orders": { ".read": false, ".write": false },
    "carts":  { ".read": false, ".write": false }
  }
}
```

The Firebase Admin SDK (used by cf-api and cf-commerce) bypasses RTDB rules entirely — rules apply only to client SDK connections. All application access is via Admin SDK. Rules are a last-resort safety net for accidental public exposure, not the primary access control mechanism.

---

## Stripe Webhook Setup

For billing events (subscription created, payment failed, etc.):

1. In Stripe Dashboard: Developers → Webhooks → Add endpoint
2. Endpoint URL: `https://cfapi-xxxx.run.app/billing/stripe-webhook` (or via Cloudflare Worker)
3. Events to listen for:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
4. Copy the webhook signing secret → save as `STRIPE_WEBHOOK_SECRET` in GCP Secret Manager

---

## Omise Webhook Setup

For payment confirmations (especially PromptPay):

1. In Omise Dashboard: Settings → Webhooks → Add Webhook
2. URL: `https://cfcommerce-xxxx.run.app/payment/omise/webhook`
3. Events: All charge events

---

## Health Check Monitoring

```bash
# cf-api health
curl https://cfapi-xxxx.run.app/api/health
# Expected: { "status": "ok" }

# cf-commerce health
curl https://cfcommerce-xxxx.run.app/health
# Expected: { "status": "ok" }
```

Set up Cloud Monitoring uptime checks against these endpoints for alerting.

---

## CI/CD (GitHub Actions)

Minimal pipeline:

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: 1.2.22

      - name: Install dependencies
        run: bun install

      - name: Typecheck
        run: bun run typecheck

      - name: Test
        run: bun run test

      - name: Deploy Firebase
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: ${{ secrets.GITHUB_TOKEN }}
          firebaseServiceAccount: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
          channelId: live

      - name: Deploy Cloudflare Worker
        run: cd apps/worker && wrangler deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

---

## Rollback

### Firebase Functions

```bash
# List deployed versions
firebase functions:log  # Check recent deploys

# Rollback is not native in Firebase Functions — redeploy previous tag
git checkout <previous-tag>
firebase deploy --only functions:cfApi
```

### Cloudflare Worker

```bash
# List deployments
wrangler deployments list

# Rollback to previous
wrangler rollback <deployment-id>
```

### Database

RTDB has no built-in rollback. For data corruption: restore from a RTDB export backup (export to GCS at scheduled intervals via Cloud Scheduler + Firebase Backup).

---

## Cost Estimation

At <100k MAU:

| Service | Usage | Estimated Cost |
|---|---|---|
| Firebase Functions v2 | 2M invocations/month | ~$0-5/month (free tier) |
| Firebase RTDB | 10GB storage, 50GB/month download | ~$25/month |
| Firebase Hosting | 10GB storage, 360MB/day transfer | Free tier |
| Cloudflare Workers | 10M requests/month | $5/month (paid plan) |
| Cloud SQL (PostgreSQL) | db-f1-micro, 10GB | ~$10/month |
| GCP Secret Manager | 10 secrets, 1M accesses/month | ~$0.10/month |
| Cloud Memorystore (Memcached) | 1GB | ~$35/month |

Total: ~$75-80/month at <100k MAU. The dominant cost is Memorystore. If budget is tight, replace Memcached rate limiting with a simpler in-process LRU (loses distributed rate limiting across instances, but acceptable at low traffic).
