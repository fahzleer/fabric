# Tech Debt

Known technical debt, shortcuts, and things worth revisiting. Ordered by severity.

---

## 🔴 High — Should Fix Before Scaling

### 1. Merchant routes unprotected at middleware level
**File**: `apps/web/src/middleware.ts`
**Issue**: Next.js middleware only protects `/products` and `/product/*`. All `/merchant/*` routes rely on server-side session checks inside each page/action rather than being blocked at the edge. A miscoded page could accidentally render without auth.
**Fix**: Add `/merchant/*` and `/admin/*` to the middleware matcher.

### 2. cf-commerce does not use GCP Secret Manager
**File**: `apps/cf-commerce/src/config.ts`
**Issue**: `INTERNAL_SECRET` is loaded from plain env vars in cf-commerce. Only cf-api uses Secret Manager. If the Firebase Function env var is misconfigured, the secret is visible in the Firebase Console.
**Fix**: Add Secret Manager support to cf-commerce the same way cf-api does it.

### 3. No rate limiting on cf-commerce
**File**: `apps/cf-commerce/src/`
**Issue**: cf-api has Memcached-backed rate limiting (10 req/min on login). cf-commerce (payment, pricing, SSE) has no rate limiting at all.
**Fix**: Add sliding-window rate limiter to at least `/payment/initiate` and `/checkout/calculate`.

### 4. SSE connections leak on Cloud Functions
**File**: `apps/cf-commerce/src/events/`
**Issue**: Firebase Functions have a 120s timeout. Long-lived SSE connections (`GET /sse/:userId`) will be force-closed at 120s. Client needs to reconnect but there is no documented reconnect strategy.
**Fix**: Implement EventSource reconnect on the client side with exponential backoff, or move SSE to a dedicated long-running service.

---

## 🟡 Medium — Worth Fixing Soon

### 5. Cold start latency on cfApi (minInstances=1 costs money when scaling)
**File**: `apps/cf-api/src/index.ts`
**Issue**: `minInstances: 1` keeps one warm instance running 24/7 to avoid cold starts. For a demo this is fine; for production at scale it becomes expensive.
**Fix**: Profile cold start time and consider lazy-loading heavy deps (firebase-admin, secret-manager).

### 6. `productToJson` presenter tightly coupled to branded type shapes
**File**: `apps/cf-api/src/features/product/`
**Issue**: `productToJson` accesses `p.id.value`, `p.name.value`, `p.price.amount` directly. Any refactor of branded types silently breaks the presenter and only fails at runtime (not type-check time).
**Fix**: Add a typed `toJSON()` method to the domain types, or use a schema-validated presenter.

### 7. No pagination on product listings
**Files**: `apps/cf-api/src/features/product/`, `apps/web/src/app/(shop)/products/`
**Issue**: Products are fetched in full with no cursor or page-based pagination. Will degrade at scale.
**Fix**: Add cursor-based pagination to `GET /api/products`.

### 8. PromptPay status polling is client-driven
**File**: `apps/web/src/app/(shop)/checkout/_components/promptpay-form.tsx`
**Issue**: Client polls for payment status. No server-push notification on payment confirmation.
**Fix**: Push confirmed status via SSE (`/sse/:userId`) instead of polling.

### 9. `apps/web/.env.local` committed (not just `.env.local.example`)
**File**: `apps/web/.env.local`
**Issue**: The actual `.env.local` file appears to be tracked. Local secrets should never be committed.
**Fix**: Verify `.gitignore` covers `apps/web/.env.local` and rotate any secrets that may have been committed.

### 10. Worker `bun.lock` separate from root
**File**: `apps/worker/bun.lock`
**Issue**: The Cloudflare Worker has its own `bun.lock` separate from the monorepo root. Dependency versions can drift between the worker and other apps.
**Fix**: Consider removing the worker's standalone lockfile and relying on the root workspace.

---

## 🟢 Low — Nice to Have

### 11. `packages/ui` uses Vitest + Storybook alongside Bun test
**File**: `packages/ui/vitest.config.ts`
**Issue**: Two test runners in the monorepo (`bun test` everywhere, `vitest` only in packages/ui for Storybook addon). Minor inconsistency.
**Fix**: Acceptable as-is. Document clearly that Vitest is Storybook-only.

### 12. Stale Scala/sbt entries in root `.gitignore`
**File**: `.gitignore`
**Issue**: Root `.gitignore` has `target/`, `.bsp/`, `.metals/` entries leftover from a removed Scala payment service.
**Fix**: Remove the Scala section from `.gitignore`.

### 13. `apps/web/README.md` is Next.js scaffold boilerplate
**File**: `apps/web/README.md`
**Issue**: Default `create-next-app` README, not project-specific documentation.
**Fix**: Replace with Fabric-specific docs or delete (root `README.md` covers it).

### 14. No structured logging in cf-commerce
**Files**: `apps/cf-commerce/src/`
**Issue**: cf-api uses a `requestLogger` middleware with structured JSON logs. cf-commerce uses `console.log/error` inconsistently.
**Fix**: Add the same `requestLogger` middleware from cf-api to cf-commerce.

### 15. CoinGecko USDC/THB rate has no fallback
**File**: `apps/web/src/app/api/crypto/rate/route.ts`
**Issue**: If CoinGecko API is down, the Web3 checkout flow breaks entirely with no fallback rate.
**Fix**: Cache the last known rate in Redis/KV and serve it as fallback on CoinGecko errors.

---

## ✅ Resolved

| Issue | Fixed |
|-------|-------|
| `PASETO_SHARED_KEY` vs `PASETO_KEY` mismatch | 2026-03-11 |
| Default `CF_API_URL` port 8081 in cf-commerce | 2026-03-11 |
| Hardcoded `"dev-secret"` fallback in payment files | 2026-03-11 |
| 20 failing tests (wrong mock shapes, field names) | 2026-03-11 |
| `apps/web` embedded git repo in monorepo | 2026-03-11 |
