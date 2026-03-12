# 🧵 Fabric

E-commerce platform built on Firebase + Cloudflare — monorepo with Turborepo + Bun workspaces.

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

## Apps

```
apps/
  cf-api/       → Main API (auth, products, orders, billing)  :3010
  cf-commerce/  → Commerce (pricing, events, payment)          :8082
  web/          → Next.js storefront + merchant portal          :3000
  worker/       → Cloudflare edge router (fabric.cool → services)
packages/
  types/        → Domain types (single source of truth)
  ui/           → Shared React components (shadcn/ui)
  firebase/     → Firebase admin helpers
  cache/        → GCS + Memcached adapters
  orpc/         → oRPC contract definitions
  contract/     → Shared API contracts
```

## Quick Start

```bash
# Install (Bun only)
bun install

# Start Firebase emulator
bun run emulator

# Start all services
bun run dev

# Or individually
bun --env-file=apps/cf-api/.env run apps/cf-api/src/index.ts      # :3010
bun --env-file=apps/cf-commerce/.env run apps/cf-commerce/src/index.ts  # :8082
bun run dev --filter=web                                            # :3000
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

## Testing

```bash
bun test              # all 720 tests
bun test --watch      # watch mode
```

## Deploy

See [`DEPLOY.html`](./DEPLOY.html) for full deploy architecture.

**TL;DR:**
```bash
firebase deploy --only functions    # Cloud Functions
firebase deploy --only hosting      # Static assets
vercel --prod                       # Next.js SSR
wrangler deploy                     # Cloudflare Worker (from apps/worker/)
```

## License

MIT — see [LICENSE](./LICENSE)
