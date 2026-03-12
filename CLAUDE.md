# Fabric — Claude Code Instructions

## Critical Rules

- **Runtime**: Bun only — never suggest `npm`, `yarn`, or `pnpm`
- **Linter/Formatter**: Biome only — never suggest ESLint or Prettier
- **Test runner**: `bun test` only — never suggest Jest or Vitest (except `packages/ui` which uses Vitest for Storybook)
- **No Scala, no NestJS** — these don't exist in this project

## Architecture

```
User → Cloudflare CDN → apps/worker (edge router)
  /api/* /auth/* /token/*                → apps/cf-api   (Firebase Function, :3010)
  /checkout/* /events/* /payment/* ...   → apps/cf-commerce (Firebase Function, :8082)
  /**                                    → Vercel (Next.js SSR, :3000)
```

**Two Cloud Functions** (not separate services):
- `cfApi` — auth, products, orders, cart, billing (Stripe), payouts
- `cfCommerce` — pricing (Railway ORP) + events (CQRS/Free Monad) + payment (Omise)

## Domain Types — Critical Pitfalls

- `ProductPrice` uses `.amount` (display units), NOT `.cents`
  - `makeProductPriceFromCents(10_000, "THB")` → `{ amount: 100, currency: "THB" }`
  - `makeProductPriceFromCents()` is **infallible** — returns `ProductPrice` directly, no union
- `CreateProductBody` schema field is `price: number` (NOT `priceInCents`)
- `productToJson()` accesses branded type shapes: `p.id.value`, `p.name.value`, `p.price.amount`

## Auth

- PASETO v3.local tokens — env var is `PASETO_KEY` (64-char hex), never `PASETO_SHARED_KEY`
- Web sessions: better-auth + Drizzle + PostgreSQL (`fabric` DB)
- Auth routes: `/auth/login`, `/auth/register` — NOT `/sign-in` or `/sign-up`
- Merchant access: requires `role = "store_owner"` in PostgreSQL `"user".role` column
- Internal token bridge: `createMerchantApi()` → POST `/internal/issue-token` → PASETO token

## Service URLs (dev defaults)

| Service | Default |
|---------|---------|
| cf-api | `http://localhost:3010` |
| cf-commerce | `http://localhost:8082` |
| web | `http://localhost:3000` |

cf-commerce calls back to cf-api via `API_SERVICE_URL` (default `http://localhost:3010`)

## Payments

- **Omise** — card + PromptPay, inside `cf-commerce` only
- **Stripe** — merchant billing subscriptions only, inside `cf-api` only
- **Web3/USDC** — x402 protocol, Base chain, inside `apps/web` only

## GCP Secret Manager

cf-api only loads **2 secrets** from Secret Manager: `PASETO_KEY` + `INTERNAL_SECRET`
Everything else (Stripe, Omise, etc.) goes as Firebase Function env vars.
cf-commerce does NOT use Secret Manager.

## State Management (apps/web)

`@effect-atom/atom-react` v0.5.0 — **Atom GC bug**:
- Atoms with `keepAlive: false` (default) get GC'd if no subscriber before passive effects run
- Shared source-of-truth atoms MUST use `Atom.keepAlive(Atom.make(...))`
- `merchantAllProductsAtom` must be `keepAlive`

## Testing Patterns

- Constructor injection mocks (not `jest.fn()`)
- Firebase `transaction()` mocks must also mock `once("value")` for pre-read loop
- Test env: `PASETO_KEY` and `INTERNAL_SECRET` set in `apps/cf-api/test.setup.ts`
- DOM env: `test-preload.bun.ts` at root (referenced by `bunfig.toml`)

## Pre-commit Hook

Every `git commit` runs:
1. `bunx lint-staged` — biome check/format on staged files
2. `bun test` — full 720-test suite must pass
