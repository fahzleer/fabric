# Fabric — System Documentation

> A full-stack e-commerce platform built for correctness, observability, and operational pragmatism.

---

## The Philosophy

Most software fails not because engineers are incompetent, but because they optimize for the wrong constraint. They write code that is easy to *write* but hard to *change*, easy to *run* but hard to *debug*, easy to *ship* but impossible to *reason about* six months later.

Fabric is designed around three axiomatic constraints:

**1. Errors are values, not exceptions.**
A function that can fail should return `Result<T, E>`. Full stop. The call site sees *exactly* what can go wrong, types it, and handles it. `try/catch` is a control-flow mechanism that erases type information at the boundary where you need it most. We don't use it for business logic.

**2. Effects are explicit.**
State mutation, network calls, and database writes are quarantined into explicit structures — `Effect.gen`, `EventOp<A>`, `PaymentCommand[]` — that are *described* in pure code and *executed* by an interpreter. This separation lets you test programs without mocking infrastructure, and reason about behavior without running anything.

**3. The write path and the read path have different requirements.**
The transactional write model (place order, charge card, decrement stock) has entirely different consistency requirements than the read model (show products to 10k concurrent shoppers). Forcing both through the same code path is the original sin of CRUD. We don't do it.

---

## System Topology

```
                        ┌─────────────────────────────────────┐
                        │       Cloudflare Worker (Edge)      │
                        │     apps/worker — URL router only   │
                        └──────────────┬──────────────────────┘
                                       │ routes by path prefix
               ┌───────────────────────┼───────────────────────┐
               │                       │                       │
               ▼                       ▼                       ▼
     /api/**, /auth/**      /checkout/**, /events/**     /** (everything else)
               │                       │                       │
               ▼                       ▼                       ▼
    ┌──────────────────┐   ┌──────────────────────────┐  ┌────────────────┐
    │     cf-api       │   │       cf-commerce        │  │   web (Next.js)│
    │  Hono + Firebase │   │  Hono + Firebase         │  │  React 19 +    │
    │  Functions v2    │   │  Functions v2            │  │  better-auth   │
    │  port :3010      │   │  port :8082              │  │  port :3000    │
    └────────┬─────────┘   └──────────────────────────┘  └────────────────┘
             │                          │
             │ HTTP (internal)          │ writes to / reads from
             └──────────────────────────┘
                          │
                          ▼
               ┌─────────────────────┐
               │   Firebase RTDB     │
               │   (write path DB)   │
               └─────────────────────┘
               ┌─────────────────────┐
               │   PostgreSQL        │
               │   (web sessions)    │
               └─────────────────────┘
```

---

## Repository Layout

```
fabric/                         ← Turborepo monorepo root
├── apps/
│   ├── cf-api/                 ← Main API: auth, products, orders, billing, payouts
│   ├── cf-commerce/            ← Commerce: events (CQRS), pricing (ROP), payment (commands)
│   ├── web/                    ← Next.js 16.1.6 storefront + merchant portal
│   └── worker/                 ← Cloudflare Worker: edge URL router
├── packages/
│   ├── types/                  ← @fabric/types — domain model, the source of truth
│   ├── contract/               ← @fabric/contract — oRPC input/output schemas
│   ├── orpc/                   ← @fabric/orpc — typed RPC utilities
│   ├── cache/                  ← @fabric/cache — Memcached + GCS adapters
│   ├── firebase/               ← @fabric/firebase — Firebase client factory
│   └── ui/                     ← @fabric/ui — shadcn/ui-based component library
├── docs/                       ← You are here
├── biome.json                  ← Formatter + linter (replaces ESLint + Prettier)
├── turbo.json                  ← Build task graph
└── package.json                ← Bun workspace root
```

---

## Technology Decisions

### Runtime: Bun 1.2.22

Node.js compatibility with 3-4× faster startup, native TypeScript execution, and a built-in test runner. For Firebase Functions v2 with min-instances=1, the cold-start delta is irrelevant — we use Bun anyway because it eliminates an entire layer of tooling (ts-node, esbuild, jest) without compromising the target runtime.

### Framework: Hono 4.7.0

Hono is what Express would have been if it had been designed *after* the web platform matured. It runs on any JS runtime (V8, Bun, CF Workers), has first-class TypeScript generics on context, and has zero unnecessary abstractions. The middleware model is functional composition, not monkey-patching. We use it for cf-api and cf-commerce.

### Database: Firebase RTDB (business data) + PostgreSQL (sessions)

**Firebase RTDB** for the operational store: writes at edge latency, scales horizontally without coordination, and pairs perfectly with real-time SSE fan-out. The tradeoff is no ad-hoc queries — you design the access patterns into the path structure up front. We accept this.

**PostgreSQL** (via better-auth + Drizzle) for web sessions *only*. Better-auth's session model requires relational integrity (FK from session → user). RTDB doesn't provide that guarantee. The two databases are never mixed in the same service.

### Type Safety: Branded Types + arktype

Every domain primitive is branded:
```typescript
type ProductId = BrandedId<"ProductId">
// { __brand: "ProductId"; value: string }
```
A raw `string` cannot be passed where `ProductId` is expected. The compiler catches this at the boundary where the data enters the system (HTTP request parsing), not at 3am during an incident.

arktype handles runtime validation at request ingress. The validation schema *is* the type — no duplication between runtime checks and TypeScript types.

### State Management: @effect-atom/atom-react (frontend)

React's built-in state model (`useState`, `useReducer`, `useContext`) breaks down under three conditions: derived async state, fine-grained subscriptions, and streaming updates. `@effect-atom/atom-react` solves all three with a composable graph of atoms that integrate natively with the Effect ecosystem (Stream, Effect.gen). The three patterns demonstrated in the merchant products page represent the canonical use cases.

### Formatter: Biome 1.9.4

One tool. Zero configuration drift. Biome replaces ESLint (formatter) + Prettier (linter) with a single Rust binary that runs in ~10ms on the entire codebase. No plugin conflicts, no `.eslintignore` archaeology, no "why is Prettier fighting ESLint" incidents. 100-char line width, single quotes, sorted imports.

---

## Service Boundaries

| Concern | Service | Why Here |
|---|---|---|
| Authentication (PASETO tokens) | cf-api | Tokens are signed with a key loaded from GCP Secret Manager at cold start. Centralizing token issuance reduces the attack surface. |
| Product catalog reads | cf-api | Public product listing is a straightforward CRUD read. No CQRS overhead needed. |
| Product state machine writes | cf-commerce/events | ProductCreated/Updated events flow through the Free Monad interpreter which maintains idempotency via `processed_events/{id}`. |
| Checkout pricing | cf-commerce/pricing | Stateless. cf-api passes stock quantities; pricing never touches a database. Railway-oriented pipeline returns `Either<PricingError, CheckoutResult>`. |
| Payment processing | cf-commerce/payment | Isolated from the rest of the system because payment gateways are unreliable and the retry/refund logic must be testable without mocking an order. |
| Web sessions | web (better-auth) | Session cookies live in PostgreSQL with proper relational integrity. The merchant portal bridges to PASETO via `/internal/issue-token`. |
| Edge routing | worker | Pure URL dispatch. Zero business logic. Runs at Cloudflare's 300+ PoPs. |

---

## Documentation Index

| Document | Contents |
|---|---|
| [docs/architecture.md](architecture.md) | Full system design, ADRs, data flow diagrams |
| [docs/apps/cf-api.md](apps/cf-api.md) | Routes, middleware stack, services, DI wiring |
| [docs/apps/cf-commerce.md](apps/cf-commerce.md) | Events (CQRS), pricing pipeline, payment commands |
| [docs/apps/web.md](apps/web.md) | Next.js structure, auth bridge, atom patterns |
| [docs/apps/worker.md](apps/worker.md) | Edge routing table, security headers |
| [docs/packages/types.md](packages/types.md) | Domain model — every type, every invariant |
| [docs/packages/contract.md](packages/contract.md) | oRPC schemas, input/output contracts |
| [docs/packages/cache.md](packages/cache.md) | Memcached adapter, GCS adapter, cache keys |
| [docs/packages/firebase.md](packages/firebase.md) | Firebase factory, RTDB path conventions |
| [docs/packages/orpc.md](packages/orpc.md) | oRPC utility layer |
| [docs/packages/ui.md](packages/ui.md) | Component library |
| [docs/patterns/free-monad-events.md](patterns/free-monad-events.md) | CQRS via Free Monad DSL |
| [docs/patterns/railway-oriented.md](patterns/railway-oriented.md) | Error handling with Either |
| [docs/patterns/command-pattern.md](patterns/command-pattern.md) | Payment command interpreter |
| [docs/patterns/atom-react.md](patterns/atom-react.md) | @effect-atom/atom-react — 3 patterns |
| [docs/patterns/security.md](patterns/security.md) | PASETO, CSRF, rate limiting, brute-force |
| [docs/guides/development.md](guides/development.md) | Local dev setup, env vars, emulators |
| [docs/guides/deployment.md](guides/deployment.md) | Firebase Functions v2 deploy, secrets |
| [docs/guides/contributing.md](guides/contributing.md) | Code standards, PR process, testing |

---

## Quick Start

```bash
# Prerequisites: Bun 1.2.22+, Node.js 22+, PostgreSQL 16+

# Install all workspace dependencies
bun install

# Start all services in dev mode (Turborepo parallel)
bun run dev

# Individual services
cd apps/cf-api && bun run dev     # :3010
cd apps/cf-commerce && bun run dev # :8082
cd apps/web && bun run dev        # :3000
cd apps/worker && bun run dev     # :8787

# Run all tests
bun run test

# Type-check entire monorepo
bun run typecheck

# Lint + format
bun run lint
```

See [guides/development.md](guides/development.md) for required environment variables.
