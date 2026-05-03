# ADR 0018: Auth Middleware Design

**Status:** Accepted  
**Date:** 2026-04-29

## Context

Fabric has three authentication surfaces:

1. **Web browser sessions** — Next.js frontend users (customers, merchants, admins)
2. **Internal service-to-service calls** — e.g., order service calling product service to reserve stock
3. **Merchant portal API** — merchant-authenticated calls that cross the internal token bridge

Three options were evaluated for service auth:

| Option | Mechanism | Suitable for |
|--------|-----------|--------------|
| **A — Bearer token (better-auth session)** | JWT/session from browser | User-facing routes |
| **B — Shared secret header** | `x-internal-secret` env var | Service-to-service calls |
| **C — mTLS** | Client certificates | High-security service mesh |

Option C is operationally heavy for the current deployment scale. Options A and B cover all current use cases.

## Decision

**Two-tier auth model:**

### Tier 1 — User auth (browser → gateway → service)

- `packages/auth/src/middleware.ts` exports `requireAuth()` and `requireRole(role)` as Elysia plugins
- `requireAuth()` validates the `Authorization: Bearer <token>` header using the better-auth session store (PostgreSQL `fabric` DB)
- `requireRole(role)` calls `requireAuth()` first, then asserts `user.role === role`
- On success, injects `userId` and `role` into the Elysia handler context via `derive({ as: "global" })`
- Used by: customer routes, payment routes, shipping GET routes, promotion apply, importer (admin only), product merchant routes

### Tier 2 — Internal secret (service → service)

- `x-internal-secret` HTTP header, value from `INTERNAL_SECRET` env var
- Used for routes that services call on each other without a user session: `POST /products/:id/reserve` (order → product), `POST /shipments/internal` (order → shipping), `POST /internal/issue-token` (web → customer)
- `requireInternalSecret()` implemented inline in each service — simple string comparison, fail with 401 if missing or wrong
- Secret is shared via environment configuration, not distributed key exchange

### Merchant token bridge

- `apps/web` calls `POST /internal/issue-token` with `TOKEN_ISSUE_SECRET` to get a short-lived base64url token
- Token payload: `{ sub, email, role, iat, exp }` — validated by customer service on merchant portal routes
- Bridge is needed because the merchant portal is served by the customer service but sessions live in the web app's `fabric` DB

## Consequences

**Positive:**
- `requireAuth` / `requireRole` are re-usable across all services without reimplementation
- Scoped Elysia plugin model means auth applies only to the declared route group
- Internal secret is simple to rotate (env var change + deploy) and leaves no cryptographic state
- No inter-service token exchange needed for the common case

**Negative:**
- `INTERNAL_SECRET` is a shared symmetric secret — compromise exposes all internal routes across all services
- Token bridge is bespoke — not a standard OAuth client-credentials flow; external audit may flag it
- `requireAuth` reads the PostgreSQL session store on every request — no session cache (by ADR 0015 decision)

## Implementation

- `packages/auth/src/middleware.ts` — `requireAuth()`, `requireRole()`
- `apps/shipping/src/http/shipping.routes.ts` — `requireInternalSecret()` on `/internal` routes
- `apps/product/src/http/inventory.routes.ts` — `requireInternalSecret()` on `/reserve` routes
- `apps/customer/src/http/internal.routes.ts` — `TOKEN_ISSUE_SECRET` guard on `/internal/issue-token`
