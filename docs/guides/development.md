# Development Guide

---

## Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| Bun | ≥ 1.2.22 | Package manager, runtime, test runner |
| Node.js | ≥ 22 | Required by some Firebase tooling |
| PostgreSQL | ≥ 16 | better-auth sessions (apps/web only) |
| Firebase CLI | latest | Local emulators |
| Wrangler | latest | Cloudflare Worker dev server |

Install Bun:
```bash
curl -fsSL https://bun.sh/install | bash
```

---

## Initial Setup

```bash
# Clone and install
git clone <repo>
cd fabric
bun install          # Installs all workspaces in one pass

# Set up PostgreSQL database (for apps/web)
createdb fabric
cd apps/web
bun run db:migrate   # Run better-auth migrations via Drizzle
```

---

## Environment Variables

### apps/cf-api — Required

Create `apps/cf-api/.env`:

```bash
PASETO_KEY=<32-byte hex string>
INTERNAL_SECRET=<32-byte hex string>
FIREBASE_PROJECT_ID=<your-firebase-project>
FIREBASE_DATABASE_URL=https://<project>-default-rtdb.firebaseio.com
FIREBASE_STORAGE_BUCKET=<project>.appspot.com
```

Optional (for billing):
```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PROFESSIONAL=price_...
STRIPE_PRICE_ENTERPRISE=price_...
STRIPE_PORTAL_RETURN_URL=http://localhost:3000/merchant/billing
```

Optional (for payment gateway in prod mode):
```bash
PAYMENT_GATEWAY=omise   # or "mock" (default)
OMISE_SECRET_KEY=skey_test_...
```

Generate secrets:
```bash
# PASETO key (32 random bytes, hex-encoded)
openssl rand -hex 32

# Internal secret
openssl rand -hex 32
```

### apps/cf-commerce — Required

Create `apps/cf-commerce/.env`:

```bash
INTERNAL_SECRET=<same as cf-api>
FIREBASE_PROJECT_ID=<same as cf-api>
FIREBASE_DATABASE_URL=<same as cf-api>
FIREBASE_STORAGE_BUCKET=<same as cf-api>
API_SERVICE_URL=http://localhost:3010   # cf-api base URL
```

### apps/web — Required

Create `apps/web/.env.local`:

```bash
DATABASE_URL=postgresql://fah@localhost:5432/fabric
INTERNAL_SECRET=<same as cf-api>
NEXT_PUBLIC_API_URL=http://localhost:8787   # Cloudflare Worker URL (dev)
BETTER_AUTH_SECRET=<32-byte random string>
BETTER_AUTH_URL=http://localhost:3000
```

Optional (OAuth):
```bash
FACEBOOK_CLIENT_ID=...
FACEBOOK_CLIENT_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

---

## Running Services

Each service has a `dev` script. Run them in separate terminals or use the Turborepo root task (which runs all in parallel via Turborepo):

```bash
# All services in parallel (recommended)
bun run dev

# Individual services
cd apps/cf-api && bun run dev       # :3010
cd apps/cf-commerce && bun run dev  # :8082
cd apps/web && bun run dev          # :3000
cd apps/worker && bun run dev       # :8787 (proxies :3010 and :8082)
```

In development, the Cloudflare Worker (`apps/worker`) runs at `:8787` and proxies to local cf-api (`:3010`), cf-commerce (`:8082`), and Next.js (`:3000`). This mirrors the production topology.

**Dev without the Worker**: Point `NEXT_PUBLIC_API_URL` directly at `http://localhost:3010` in `apps/web/.env.local`. Useful when developing cf-api features without wrangler overhead.

---

## Firebase Local Emulator (Optional)

For local Firebase development without hitting the real project:

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Start emulators
firebase emulators:start --only database,storage

# Point services at emulator
# In apps/cf-api/.env and apps/cf-commerce/.env:
FIREBASE_DATABASE_URL=http://localhost:9000?ns=<your-project-id>
```

The Firebase Admin SDK detects emulator URLs automatically and bypasses authentication.

---

## Database Migrations (PostgreSQL / better-auth)

```bash
cd apps/web

# Generate migration from schema changes
bun run db:generate

# Apply pending migrations
bun run db:migrate

# Open Drizzle Studio (visual DB browser)
bun run db:studio
```

---

## Granting Merchant Access

The `store_owner` role must be set in PostgreSQL (better-auth's database), not Firebase:

```sql
-- Connect to the fabric database
UPDATE "user" SET role = 'store_owner' WHERE email = 'merchant@example.com';
```

The user must log out and back in for the role change to take effect in their session.

---

## Running Tests

```bash
# All tests
bun run test

# Specific workspace
cd apps/cf-api && bun test
cd apps/cf-commerce && bun test
cd packages/types && bun test

# With coverage
bun test --coverage

# Watch mode
bun test --watch
```

Bun test is Jest-compatible for basic assertions but uses Bun's own runner. `describe`, `it`, `test`, `expect`, `beforeEach`, `afterEach` work as expected. `vi.mock` does not exist — use constructor injection instead.

---

## Linting and Formatting

```bash
# Lint entire monorepo
bun run lint

# Format entire monorepo (auto-fix)
bun run format

# Type-check (tsc --noEmit, all workspaces)
bun run typecheck
```

Biome 1.9.4 handles both linting and formatting. Configuration is in `biome.json` at the monorepo root. There is no `.eslintrc`, no `.prettierrc`. Do not add them.

**Biome settings**:
- Line width: 100 characters
- Quote style: double quotes (TypeScript)
- Trailing commas: all
- Imports: sorted automatically

---

## E2E Tests (Cypress)

```bash
cd apps/web

# Interactive
npx cypress open

# Headless (CI mode)
npx cypress run

# With Lighthouse performance audit
npx cypress run --spec "cypress/e2e/performance/**"
```

---

## Common Development Workflows

### Adding a New API Route to cf-api

1. Create handler in `apps/cf-api/src/features/{domain}/{domain}.handlers.ts`
2. Create/update service in `apps/cf-api/src/features/{domain}/{domain}.service.ts`
3. Register route in `apps/cf-api/src/index.ts`
4. Add contract types to `packages/contract/src/routers/{domain}.router.ts`
5. Write tests in `apps/cf-api/src/features/{domain}/{domain}.service.spec.ts`

### Adding a New Domain Event

1. Define event type in `packages/types/src/events.ts`
2. Add program handler in `apps/cf-commerce/src/events/free/Dsl.ts`
3. Add interpreter case in `apps/cf-commerce/src/events/free/Interpreter.ts`
4. Add route in `apps/cf-commerce/src/events/router/Router.ts`
5. Write test against in-memory interpreter

### Adding a New Pricing Rule

1. Add new `PricingError` variant in `apps/cf-commerce/src/pricing/Error/PricingError.ts`
2. Write new pipeline step function
3. Compose into `checkoutFlow` via `pipe + Either.flatMap`
4. Add HTTP handler case for the new error variant
5. Write unit test (pure function — no mocking needed)

---

## Debugging

### cf-api and cf-commerce

Both services log structured JSON to stdout in development:

```bash
# Watch logs in real time
cd apps/cf-api && bun run dev 2>&1 | jq .
```

### Next.js

Standard Next.js debugging:

```bash
cd apps/web
NODE_OPTIONS='--inspect' bun run dev
# Open chrome://inspect in Chrome
```

### Firebase RTDB (Local Emulator)

Open `http://localhost:4000` after starting the emulator. The Emulator UI shows RTDB state in real time.

---

## Architecture Invariants (Do Not Violate)

1. **No business logic in the worker.** The worker is a URL router. Period.
2. **No PostgreSQL calls from cf-api or cf-commerce.** PostgreSQL is for better-auth (web sessions) only.
3. **No Firebase calls from pricing logic.** Pricing is stateless. cf-api passes stock data.
4. **No global singletons accessed via module-level variables.** All dependencies are constructor arguments.
5. **No `throw` in service or domain code.** Return `Result<T, E>`. Let the HTTP handler convert to HTTP status codes.
6. **No `any` types.** Biome's linter will catch most, but review before committing.
7. **No Jest, no ESLint, no Prettier.** Bun test, Biome only.
