# 🧵 Fabric

An e-commerce platform for the Thai market — merchants list products, customers browse and checkout, payments go through card, PromptPay, or crypto.

→ **Live: [fabric.cool](https://fabric.cool)**

---

## Who uses it

**Shoppers** — browse products, add to cart, pay with card / PromptPay / USDC

**Merchants** — manage products, track orders, view analytics, get paid out

**Admins** — oversee inventory, approve payouts, manage the platform

---

## How it's built

Three services behind a single domain:

```
fabric.cool
  ├── /api/*        → Business logic (auth, products, orders, billing)
  ├── /checkout/*   → Pricing & payments
  └── /**           → Next.js storefront + merchant portal
```

Each service has one job. The Cloudflare Worker at the edge decides which service handles each request.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 · React 19 · Tailwind CSS 4 |
| API | Hono 4.7 · Firebase Functions v2 (Node 22) |
| Edge Router | Cloudflare Worker |
| Auth | PASETO v3.local · better-auth + PostgreSQL |
| Database | Firebase Realtime Database + PostgreSQL |
| Payments | Omise (card + PromptPay) · Stripe (billing) · Web3/USDC |
| Runtime | Bun 1.2+ |

---

## Architecture decisions

**Why two backend services?**
Pricing and payment logic changes independently from auth and product management. Separating them means a pricing rule change doesn't require touching auth code.

**Why Cloudflare Worker as router?**
One domain, three services. The Worker adds security headers and routes traffic at the edge before it hits any origin server.

**Why PASETO instead of JWT?**
PASETO v3.local uses symmetric encryption — tokens are opaque to clients, no algorithm confusion attacks possible.

---

## Run locally

```bash
# Install (Bun only)
bun install

# Start Firebase emulator
bun run emulator

# Start all services
bun run dev

# Or individually
bun --env-file=apps/cf-api/.env run apps/cf-api/src/index.ts            # :3010
bun --env-file=apps/cf-commerce/.env run apps/cf-commerce/src/index.ts  # :8082
bun run dev --filter=web                                                  # :3000
```

## Environment

Copy `.env.example` files in each app:

```bash
cp apps/cf-api/.env.example apps/cf-api/.env
cp apps/cf-commerce/.env.example apps/cf-commerce/.env
cp apps/web/.env.local.example apps/web/.env.local
```

Required:
- `PASETO_KEY` — 64-char hex (cf-api)
- `INTERNAL_SECRET` — shared secret between cf-api and cf-commerce

---

## Testing

```bash
bun test          # all 720 tests
bun test --watch  # watch mode
```

---

## Deploy

See [`DEPLOY.html`](./DEPLOY.html) for full deploy architecture.

**TL;DR:**
```bash
firebase deploy --only functions  # Cloud Functions
firebase deploy --only hosting    # Static assets
vercel --prod                     # Next.js SSR
wrangler deploy                   # Cloudflare Worker (from apps/worker/)
```

---

## Go deeper

- [`DEPLOY.html`](./DEPLOY.html) — full infrastructure map
- [`apps/cf-api/`](./apps/cf-api/) — auth, products, orders, billing
- [`apps/cf-commerce/`](./apps/cf-commerce/) — pricing pipeline, event sourcing (Free Monad + CQRS)
- [`packages/types/`](./packages/types/) — domain model (start here to understand the whole system)

---

## License

MIT — see [LICENSE](./LICENSE)
