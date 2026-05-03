# ADR 0019: Customer Service Bounded Context — Keep Together vs Split

**Status:** Accepted  
**Date:** 2026-04-29

## Context

`apps/customer` handles four distinct concerns inside a single service:

| Concern | Routes | Auth |
|---------|--------|------|
| Customer identity & profile | `POST /customers`, `GET/PATCH /customers/:id` | Public registration; bearer token for updates |
| Merchant portal | `/merchant/*` | `requireRole("store_owner")` |
| Admin panel | `/admin/*` | `requireRole("admin")` |
| Internal token bridge | `POST /internal/issue-token` | Shared secret header |

Each concern has a different change rate and different consumers:
- **Identity** — changed by auth flows, registration funnels
- **Merchant portal** — changed by merchant feature development
- **Admin panel** — changed by ops tooling
- **Token bridge** — rarely changes; bridges web session → merchant API token

Two options were evaluated:

| Option | Deployment | DB | Effort |
|--------|-----------|-----|--------|
| **A — Single service, separate route files** | One process on `:4002` | `fabric_customers` shared | Low |
| B — Split into `apps/merchant` (:4010) + `apps/admin` (:4011) | Three processes | Same DB | High |

Option B adds three separate pg-boss instances, three separate connection pools, and three sets of deploy pipelines. The `fabric_customers` DB is shared regardless — so Option B pays the operational cost of split processes without getting data isolation.

## Decision

**Option A** — single `apps/customer` process with two clearly separated route files:

- `src/http/customer.routes.ts` — customer identity: `POST /customers` (public), `GET/PATCH /customers/:id` (authenticated). Depends on `CustomerService`.
- `src/http/platform.routes.ts` — merchant portal (`/merchant/*`), admin panel (`/admin/*`), store queries (`/api/stores/*`), token bridge (`/internal/issue-token`), activity logging. Does not depend on `CustomerService` — operates directly against the `fabric_customers` DB via Kysely, or via the internal token bridge pattern.

Auth enforcement is per route-group:
- `/merchant/*` → `requireRole("store_owner")`
- `/admin/*` → `requireRole("admin")`
- `/internal/issue-token` → `x-internal-secret` header guard

## Consequences

**Positive:**
- Clear code-level boundary: customer identity PRs only touch `customer.routes.ts`; merchant/admin PRs only touch `platform.routes.ts`
- Single process = single deploy, single connection pool, simpler ops
- No cross-service calls needed: merchant portal reads the same DB as customer profile
- Route files can be extracted to separate services later with only a `main.ts` change

**Negative:**
- A slow admin query can still affect customer registration latency (shared process, no isolation)
- Merchant and admin routes share the same Elysia instance — a crash in one affects all

**Migration path:** If merchant load justifies isolation, `platform.routes.ts` can be moved to a new `apps/merchant` service with only an `import` change in `main.ts`. No domain logic changes required.

## Implementation

- `apps/customer/src/http/customer.routes.ts` — customer identity (profile CRUD)
- `apps/customer/src/http/platform.routes.ts` — merchant portal + admin + token bridge
- `apps/customer/src/main.ts` — mounts both: `.use(customerRoutes).use(platformRoutes)`
