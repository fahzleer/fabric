# ADR 0017: Elysia as the HTTP Framework

**Status:** Accepted  
**Date:** 2026-04-29

## Context

All Fabric microservices need an HTTP framework that runs on **Bun**. Four candidates were evaluated:

| Framework | Bun native | Type safety | Plugin model | Throughput (req/s) |
|-----------|-----------|-------------|--------------|-------------------|
| **Elysia** | Yes (Bun-first) | End-to-end via `t.*` schemas | Scoped/global plugins, `derive`, `onBeforeHandle` | ~300 k (Bun) |
| Hono | Yes (multi-runtime) | `zod-validator` add-on | Middleware chaining | ~250 k (Bun) |
| Fastify | Node.js (Bun compat) | JSON schema + TypeBox | Hook system | ~180 k (Node) |
| Express | Node.js | None | Middleware stack | ~80 k (Node) |

Key requirements:

1. **Bun runtime** — `bun:sqlite`, `bun:ffi`, native performance
2. **End-to-end type inference** — request body, params, query, and response types flow from schema to handler without manual casting
3. **Plugin scoping** — auth middleware must apply to specific route groups without polluting unrelated routes
4. **Effect-TS compatibility** — handlers need to call `Effect.runPromise`; no framework-level DI conflict

## Decision

Use **Elysia** across all microservices.

Key Elysia features used in Fabric:

- `t.Object(...)` schemas on `.post(…, { body })`, `.get(…, { params })` — validated and typed at the handler boundary
- `new Elysia({ prefix })` sub-apps composed with `.use()` — enables per-group auth middleware
- `{ as: "scoped" }` on `onBeforeHandle` — middleware applies only to the current plugin's routes, not to the parent app's routes
- `derive({ as: "global" }, …)` — injects `userId`, `role` into handler context from auth middleware
- `bootRuntime(layer)` + `Effect.runPromise` — Effect integration without framework conflict

## Consequences

**Positive:**
- Handlers are fully typed with no `as unknown as T` casts from body/params/query
- Plugin scoping eliminates the class of bug where auth middleware accidentally applies to public routes (or vice versa)
- Elysia's `Bun.serve` integration delivers the full Bun HTTP performance
- Small dependency surface — no separate validation library needed

**Negative:**
- Elysia is Bun-first; running in Node.js for tests requires `--bun` flag or Bun test runner
- Plugin scoping with `as: "scoped"` vs `as: "global"` requires careful understanding — incorrect scoping is a common mistake
- Smaller ecosystem than Express/Fastify; fewer community plugins

## Implementation

- All `apps/*/src/http/*.routes.ts` files use Elysia for route definition
- `packages/effect-http/src/plugin.ts` — Elysia plugin helpers (`bootRuntime`, `handler`)
- `packages/middleware/src/redis-throttle.ts` — Elysia plugin with `{ as: "scoped" }`
