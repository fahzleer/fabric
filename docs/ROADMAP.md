# Fabric Platform Roadmap

**Author:** Engineering
**Last Updated:** 2026-03-11
**Status:** Living document — update when priorities shift

---

## Executive Summary

Fabric is a commerce enablement platform targeting Thai SMBs first, then broader Southeast Asia. The core thesis: merchants in the region are underserved by Shopify (expensive, no local payment UX) and by Facebook Shops (no inventory control, no analytics). We win on localization depth — PromptPay-native checkout, THB-first pricing, Thai language — combined with a SaaS subscription model that keeps CAC low and expansion revenue healthy.

**Where we are today:** The infrastructure bet has paid off. The three hardest backend systems — SaaS billing (Stripe), Thai payment processing (Omise + PromptPay), and the merchant portal — are all substantially implemented and tested. The platform is feature-complete enough to onboard paying merchants in Thailand. The bottleneck has shifted from "build it" to "harden it, instrument it, and expand it."

**The next 12 months in one sentence:** Ship what we have to real users, close the operational gaps that block revenue collection, then expand the SEA footprint from a position of proven unit economics.

---

## Codebase Reality Check

The following corrects the strategy document's status table, which was authored before significant implementation milestones. Read the code, not the doc.

| Area | Strategy Doc Said | Actual State |
|------|-------------------|--------------|
| Merchant portal (dashboard, products, analytics) | ❌ Not built | ✅ Fully implemented |
| Store owner registration (web frontend) | ❌ No frontend | ✅ `/auth/register/store` page + server action |
| Public storefront `/store/[slug]` | Not mentioned | ✅ Implemented with SSR + OG metadata |
| Thai payment (PromptPay / Omise) | ❌ MockGateway only | ✅ `OmisePaymentGateway` + `PromptPayAdapter` + webhook handler; env-var selectable |
| SaaS billing (Stripe subscriptions) | ❌ Zero | ✅ `BillingService` + `StripeBillingAdapter` + plan enforcement middleware + full test suite |
| Payout system | Not mentioned | ✅ Balance, request, list, admin approve/reject — backend complete; merchant UI complete |
| Plan tier names | starter / growth / scale | Code uses: **free / starter / professional / enterprise** |
| Cloudflare Worker | Described as Elysia local proxy | ✅ Real edge URL router (`apps/worker`) — proxies to Firebase Functions |
| Admin portal (UI) | Not mentioned | ❌ Backend routes exist; no `/admin/**` pages in `apps/web` |
| Affiliate system | Not mentioned | ❌ Domain types exist in `packages/types`; no service, routes, or UI |
| Inventory management UI | Not mentioned | ❌ Reservation logic in cf-commerce; no receive/audit/transfer UI |
| Custom domain (professional+ feature) | Not mentioned | ❌ `hasCustomDomain: true` in plan config; not implemented yet |
| Store avatar / logo upload | Not mentioned | ❌ Emoji placeholder only |

---

## Current Architecture

```
User → Cloudflare CDN → apps/worker (Cloudflare Worker, edge URL router)
  /api/* /auth/* /token/*                  → apps/cf-api   (Firebase Function v2, :3010)
  /checkout/* /events/* /payment/* etc.    → apps/cf-commerce (Firebase Function v2, :8082)
  /**                                      → Vercel (Next.js 16, SSR, :3000)
```

**Two Cloud Functions, no microservices sprawl:**
- `cfApi` — auth (PASETO v3.local), products, cart, orders, billing (Stripe), payouts, internal coordination
- `cfCommerce` — pricing pipeline (Railway ORP), events (CQRS/Free Monad), payment (Omise)

**Data stores:**
- Firebase RTDB — primary store for cf-api and cf-commerce (products, carts, orders, merchants, payouts)
- PostgreSQL (`fabric` DB) — better-auth session management only (apps/web)

**Plan tiers and limits:**

| Plan | Products | Orders/mo | Analytics | Custom Domain | Price |
|------|----------|-----------|-----------|---------------|-------|
| Free | 5 | 50 | ✗ | ✗ | ฿0 |
| Starter | 50 | 500 | ✓ | ✗ | ฿990/mo |
| Professional | 500 | Unlimited | ✓ | ✓ | ฿2,990/mo |
| Enterprise | Unlimited | Unlimited | ✓ | ✓ | Custom |

---

## Phase 4 — Operational Readiness (Q2 2026)

*The code is written. This phase closes the gap between "it works in dev" and "it collects money in production."*

### 4.1 Production Environment Setup

- [ ] **Stripe price IDs** — `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_PROFESSIONAL`, `STRIPE_PRICE_ENTERPRISE` must point to real Stripe products. Currently default to empty string; billing subscribe silently fails without them.
- [ ] **Omise keys** — `OMISE_SECRET_KEY` and `OMISE_WEBHOOK_SECRET` for live environment. Webhook HMAC-SHA256 verification is implemented; just needs the real secret.
- [ ] **PASETO key rotation** — Document the procedure for rotating `PASETO_KEY` without invalidating all active sessions. Token family revocation is implemented; rotation runbook is not.
- [ ] **Firebase Rules** — Audit RTDB security rules. Merchant records, payout balances, and order data need per-user read isolation enforced at the DB layer, not just at the application layer.

### 4.2 Admin Portal Frontend

Backend payout management routes exist (`GET /admin/payouts`, `PATCH /admin/payouts/:id/approve`, `PATCH /admin/payouts/:id/reject`). There is no frontend for these. Operators are currently blind to pending payout requests.

**Deliverable:** `/admin/**` route group in `apps/web` with:
- Pending payout queue with approve/reject actions
- Merchant listing (plan, status, product count, revenue)
- Basic audit log view

This is the single biggest operational gap. Without it, the payout flow is a dead end.

### 4.3 Test Coverage Gaps

The test suite is strong for the core domain (billing, auth, orders, products). Missing:

| File | Gap |
|------|-----|
| `payout.service.spec.ts` | Zero tests for PayoutService |
| `store.handlers.spec.ts` | Zero tests for store routes |
| `plan.middleware.spec.ts` | Plan enforcement middleware untested |
| E2E checkout | No Cypress test covering the full cart → checkout → Omise charge flow |

Pre-commit hook runs all 720 tests. Untested paths are invisible to the gate.

### 4.4 Storefront UX Polish

- [ ] **Merchant avatar/logo** — Storefront shows an emoji placeholder (`🏪`). Need image upload to Firebase Storage + presigned URL pattern. Professional plan feature.
- [ ] **Storefront pagination** — `/store/[slug]` fetches first 20 products. The UI shows a "Showing N of M" hint but no page controls. Merchants with >20 products have invisible inventory.
- [ ] **Product search within store** — No filtering or search on the public storefront. Table stakes for stores with >20 products.

### 4.5 Custom Domain Infrastructure

`hasCustomDomain: true` is defined for professional and enterprise plans but nothing enforces or implements it. This is a meaningful upgrade incentive. Options: Cloudflare SSL for SaaS (cheapest path), or a dedicated subdomain scheme (`{slug}.fabric.co`). Decision needed before it can be built.

---

## Phase 5 — SEA Expansion (Q3–Q4 2026)

*Thailand-first is the right GTM; SEA-ready is the right architecture. These are the gaps between here and there.*

### 5.1 Multi-Currency

Currently hardcoded THB throughout. `CurrencyCode` type exists in `packages/types`; `ProductPrice` carries a `currency` field. The pricing pipeline in cf-commerce validates currency but only accepts THB.

Priority expansion order based on GDP/e-commerce volume: **SGD → MYR → IDR → PHP → VND**

Work required:
- Exchange rate service (Fixer.io or Open Exchange Rates with a 1-hour cache)
- Currency conversion in the checkout pipeline
- Display currency vs. settlement currency separation (we settle in THB, display in local currency)
- `PLANS` limits are currency-agnostic (product/order counts); pricing page needs localization

### 5.2 Local Payment Methods by Market

| Market | Priority Methods | Gateway |
|--------|-----------------|---------|
| Thailand | PromptPay ✅ | Omise ✅ |
| Singapore | PayNow, GrabPay | Omise SG or Stripe |
| Malaysia | FPX, Touch 'n Go | Omise MY or iPay88 |
| Indonesia | QRIS, GoPay, OVO | Midtrans |
| Philippines | GCash, Maya | PayMongo |

The `IPaymentGateway` interface is clean. Each market needs a new adapter. The command pattern in cf-commerce (`processPaymentLogic → interpretPaymentCommands`) makes gateway swapping mechanical.

### 5.3 Localization Framework

The Next.js app currently has no i18n setup. `next-intl` or `next-i18next` needs to be layered in before the codebase grows further. Retrofitting i18n into 50k+ lines of JSX is expensive. Start now.

Thai translation is the P0. English stays as the base locale.

### 5.4 Regional Compliance

- **Thailand PDPA** — Privacy policy, consent management, data retention policy. Required for merchant onboarding.
- **Tax collection** — VAT registration and invoice generation for each market. Not in scope until we have merchants in that market, but the data model needs to support it.
- **KYC for payouts** — Manual bank info string today (`bankInfo: string >= 5 & string <= 200`). Production payouts need verified bank accounts. Integrate with a KYC provider before scaling payout volume.

---

## Phase 6 — Growth Infrastructure (Q1–Q2 2027)

### 6.1 Affiliate / Referral System

Domain types (`Affiliate`, `AffiliateLink`, `AffiliateEarning`, `AffiliatePayout`, `ContentPipelineItem`) exist in `packages/types/src/affiliate.types.ts`. No backend service or routes exist. This is a deliberate deferral — implement only after the core merchant flow has proven retention.

When building: the Free Monad event system in cf-commerce is the right place to track affiliate attribution events. Attribution window and commission rate are config-level decisions, not code changes.

### 6.2 Inventory Management

Stock reservation is implemented in cf-commerce (cf. `InventoryReserved`, `InventoryReservationFailed` domain events). What doesn't exist:
- Inventory receive (purchase orders, lot tracking)
- Stock audit / shrinkage recording
- Low-stock alerts
- Purchase order management

The domain types (`LotId`, `AuditId`, `InventoryReceived`, `StockAuditRecorded`, `ShrinkageCharged`, `InventoryBalance`) are already in `packages/types`. This is schema-ready, implementation-pending.

### 6.3 Marketplace Discovery

Currently the platform is a collection of isolated stores with no cross-store discovery. A marketplace feed (curated home page, category browse, search) is the unlock for organic customer acquisition. This is a Phase 6 feature — don't build it until there are enough merchants to populate it meaningfully (target: 100+ active stores).

### 6.4 Subscription Upsell Triggers

Plan enforcement is in place (`requireActivePlan`, `requireProductCapacity`). The product creation flow blocks with a 403 when limits are hit, but the user lands on a generic error. This should surface a contextual upgrade prompt: "You've hit your 50-product limit. Upgrade to Professional for 500 products."

This is a conversion optimization change, not a new feature. Build it alongside the billing page.

---

## Phase 7 — Platform (2027+)

These are directionally correct but details should not be committed to until Phase 5/6 economics are proven.

**AI-assisted merchant tools:**
- Product description generation (Claude API, already available)
- Demand forecasting on `completedOrderCount` + `totalRevenueCents` timeseries
- Smart pricing suggestions based on category benchmarks

**Mobile:**
- Merchant app (inventory management, order notifications) — React Native with shared domain logic from `packages/`
- No customer-facing native app until we have evidence that PWA conversion rates are insufficient

**API Platform:**
- Public REST API for merchants to integrate their own systems
- Webhook delivery for order events (the domain event system in cf-commerce is the foundation)

**White-label:**
- Enterprise plan unlock: branded storefronts on custom domains with custom checkout colors
- Custom domain infrastructure (4.5) is the prerequisite

---

## Technical Debt Register

These are tracked separately from the roadmap but need owners and deadlines.

| Item | Severity | Notes |
|------|----------|-------|
| Firebase RTDB security rules not audited | High | Application-layer guards exist but DB-layer isolation unverified |
| `bankInfo` payout field is free text | High | Must be structured + KYC-verified before scaling |
| No structured logging in cf-api | Medium | `requestLogger()` middleware exists; no log aggregation / alerting configured |
| `Atom.keepAlive` bug scope | Medium | Documented in CLAUDE.md; `merchantAllProductsAtom` fixed; audit other shared atoms |
| Public storefront fetches only page 1 | Medium | 20-product hard limit breaks UX for larger merchants |
| Worker SSE passthrough | Medium | SSE connections (long-lived) may not survive Cloudflare Worker's default response streaming behavior under load |
| CSRF token rotation on 401 | Low | Double-submit cookie is in place; token rotation on auth failure not implemented |
| `planExpiresAt` not enforced | Low | Field exists on `FirebaseMerchantRecord`; no cron job checks it |

Full list: `docs/TECH_DEBT.md`

---

## Non-Goals (explicit scope control)

The following are explicitly out of scope for the foreseeable future. Revisit if market evidence changes.

- **Full-stack ERP / accounting integration** — Export to CSV is sufficient. QuickBooks/Xero integrations are a distraction at this stage.
- **Physical retail POS hardware** — `/pos/calculate` exists in cf-commerce for calculation only. We do not sell hardware.
- **Social commerce (Instagram/TikTok shop sync)** — Interesting, not urgent. Requires platform API stability we don't control.
- **B2B / wholesale pricing** — Enterprise plan feature, post-Phase 6.
- **Own payment gateway / acquiring license** — Use Omise and Stripe as licensed intermediaries. Building our own acquiring stack is a multi-year, multi-million-baht regulatory bet.

---

## Success Metrics by Phase

| Phase | Metric | Target |
|-------|--------|--------|
| 4 (Operational) | Merchants with active paid plan | 50 paying merchants |
| 4 (Operational) | Payout processed without manual intervention | 100% of requests via admin portal |
| 5 (SEA Expansion) | Markets live | TH + SG |
| 5 (SEA Expansion) | Non-THB GMV | >10% of total GMV |
| 6 (Growth) | Monthly active stores | 500 |
| 6 (Growth) | Plan upgrade conversion (free → paid) | >15% |
| 7 (Platform) | API-integrated merchants | >20% of professional+ tier |

---

## Appendix: Key File Index

For engineers joining the project:

| Concern | Entry Point |
|---------|-------------|
| API cold start, route registration | `apps/cf-api/src/index.ts` |
| Commerce cold start, payment gateway wiring | `apps/cf-commerce/src/index.ts` |
| Edge routing logic | `apps/worker/src/index.ts` |
| Plan tiers, limits, pure domain functions | `apps/cf-api/src/domain/billing/billing.value-objects.ts` |
| Stripe billing service | `apps/cf-api/src/features/billing/billing.service.ts` |
| Omise card gateway | `apps/cf-commerce/src/payment/adapters/omise-payment-gateway.adapter.ts` |
| PromptPay QR flow | `apps/cf-commerce/src/payment/adapters/promptpay.adapter.ts` |
| Plan enforcement middleware | `apps/cf-api/src/infrastructure/guards/plan.middleware.ts` |
| Pricing pipeline (Railway ORP) | `apps/cf-commerce/src/pricing/` |
| Free Monad event interpreter | `apps/cf-commerce/src/events/` |
| Merchant portal layout + role gate | `apps/web/src/app/(merchant)/layout.tsx` |
| Dual-auth bridge (better-auth → PASETO) | `apps/web/src/lib/merchant-api.ts` |
| Domain type definitions | `packages/types/src/` |
| Architecture decisions, patterns | `docs/patterns/` |
