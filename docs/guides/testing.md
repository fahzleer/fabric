# Testing Guide

All tests run with `bun test`. The full suite (~720 tests) must pass before every commit (enforced by the pre-commit hook). This guide covers test structure, mocking patterns, and common pitfalls.

---

## Running Tests

```bash
# Full suite (what pre-commit runs)
bun test

# Single file
bun test apps/cf-api/src/features/billing/billing.service.spec.ts

# Pattern match
bun test --pattern "auth"

# Watch mode
bun test --watch
```

Tests live alongside source files: `foo.service.ts` → `foo.service.spec.ts`. Do not create a separate `__tests__` directory.

---

## Environment Setup

`test.setup.ts` at `apps/cf-api/src/` runs before all cf-api specs and seeds required env vars:

```typescript
// apps/cf-api/src/test.setup.ts
process.env.PASETO_KEY ??= "a".repeat(64)       // 64-char hex required by PasetoVerifierService
process.env.INTERNAL_SECRET ??= "a".repeat(64)  // required by internalSecret() middleware
```

This file is referenced by `bunfig.toml`:

```toml
[test]
preload = ["./test-preload.bun.ts"]
```

The root `test-preload.bun.ts` sets up DOM environment. `apps/cf-api/src/test.setup.ts` is imported explicitly in each spec that needs it, or via `preload` in a local `bunfig.toml`.

---

## Dependency Injection Mocking

All services use constructor injection. Mocks are plain objects that implement the port interface — no `jest.mock()` or `vi.mock()`.

### Pattern: Mock repository

```typescript
// Create a minimal implementation of the port
const mockOrderRepo: OrderRepositoryPort = {
  findById: async (id) => ({ _tag: "Ok", value: fakeOrder }),
  findByUserId: async () => ({ _tag: "Ok", value: { items: [], total: 0 } }),
  save: async () => ({ _tag: "Ok", value: undefined }),
  atomicReserveAndSave: async () => ({ _tag: "Ok", value: fakeOrder }),
}

// Inject into service under test
const service = new OrderService(
  mockOrderRepo,
  mockCartRepo,
  mockPayment,
  mockProductRepo,
  mockPricing,
  mockVoucherRepo,
  mockEventPublisher,
  mockActivity,
  mockMerchantRepo
)
```

### Pattern: Override a single method

```typescript
const mockRepo = {
  ...baseRepo,
  findById: async () => ({ _tag: "Err", error: { _tag: "OrderNotFoundError", message: "not found" } }),
}
```

### Pattern: Spy with state

```typescript
const publishedEvents: EventEnvelope[] = []
const mockEventPublisher: EventPublisherPort = {
  publish: async (event) => { publishedEvents.push(event) },
}

// After test action:
expect(publishedEvents).toHaveLength(1)
expect(publishedEvents[0].event_type).toBe("OrderPlaced")
```

---

## Firebase Mocking

**Never use the Firebase emulator in unit tests.** The `packages/firebase` package is not imported by test files. Repositories are mocked at the port boundary.

For integration tests that do need Firebase semantics (e.g., testing `atomicReserveAndSave`), use the `dryRun` mode or a manually constructed mock.

### Firebase `transaction()` mocking

Firebase `transaction()` calls the callback twice: once with `null` (speculative), once with the real snapshot. Mocks must handle both:

```typescript
const mockRef = {
  transaction: async (cb: (data: unknown) => unknown) => {
    cb(null)  // speculative call — must be a no-op
    const result = cb(existingData)
    return { committed: true, snapshot: { val: () => result } }
  },
  once: async (event: string) => ({ val: () => existingData }),  // pre-read snapshot
}
```

The `once("value")` call is used in repositories that pre-read data before running the transaction (to handle the null speculative pass). If you mock `transaction` without mocking `once`, the test will fail.

---

## PASETO Token Helpers

```typescript
import { encryptToken } from "../../infrastructure/auth/paseto-verifier.service"

const token = await encryptToken(
  { sub: "user-123", email: "test@example.com", role: "customer" },
  "a".repeat(64),  // test PASETO_KEY from test.setup.ts
  900              // 15 min TTL
)

// Use in request header:
const headers = { Authorization: `Bearer ${token}` }
```

---

## Result<T, E> Assertions

Use helper assertions for readable tests:

```typescript
// Assert success
expect(result._tag).toBe("Ok")
if (result._tag === "Ok") {
  expect(result.value.id).toBeDefined()
}

// Assert specific error
expect(result._tag).toBe("Err")
if (result._tag === "Err") {
  expect(result.error._tag).toBe("InvalidCredentialsError")
}
```

---

## Testing the Free Monad (cf-commerce)

The dry-run interpreter runs programs against an in-memory Map instead of Firebase RTDB. This is the standard approach for cf-commerce event handler tests:

```typescript
import { runDryRun } from "../events/free/Interpreter"

const program = handleProductCreated(event)
const { state, notifications, emitted } = await runDryRun(program, initialState)

expect(state.get(productId)?.status).toBe("draft")
expect(emitted).toHaveLength(1)
```

---

## Testing the Pricing Pipeline (cf-commerce)

Pricing functions are pure — no mocking needed:

```typescript
import { checkoutFlow } from "../pricing/Pipeline/Checkout"

const result = checkoutFlow({
  items: [{ productId: "p1", unitPriceCents: 29900, quantity: 1, size: "M" }],
  shippingAddress: { country: "TH", province: "Bangkok" },
  currency: "THB",
})

expect(result._tag).toBe("Right")
if (result._tag === "Right") {
  expect(result.right.totalCents).toBe(29900 + 4900) // price + TH shipping
}
```

---

## Testing HTTP Handlers (Hono)

Use the Hono `app.fetch()` API directly — no real HTTP server needed:

```typescript
import { Hono } from "hono"
import { registerProductRoutes } from "./product.handlers"

const app = new Hono()
registerProductRoutes(app, mockProductService, mockVerifier)

const response = await app.fetch(
  new Request("http://localhost/api/products", {
    headers: { Authorization: `Bearer ${validToken}` },
  })
)

expect(response.status).toBe(200)
const body = await response.json()
expect(body.products).toHaveLength(2)
```

---

## Testing Auth Middleware

The `requireAuth` middleware reads `Authorization: Bearer <token>` and sets `userId`/`userRole`/`userEmail` on the Hono context. In handler tests, provide a real encrypted token or bypass middleware by injecting a pre-authed context:

```typescript
// Option 1: Real token (preferred)
const token = await encryptToken({ sub: "u1", email: "a@b.com", role: "store_owner" }, PASETO_KEY, 900)

// Option 2: Skip middleware, test handler logic only
app.use("*", async (c, next) => {
  c.set("userId", "u1")
  c.set("userRole", "store_owner")
  await next()
})
```

---

## Testing Rate Limiting

Rate limiter uses Memcached. In tests, inject a mock that always returns count < limit:

```typescript
const mockCache = {
  increment: async (key: string, ttl: number) => ({ count: 1, isNew: false }),
  get: async () => null,
  set: async () => {},
}
```

---

## Test File Conventions

```
apps/cf-api/src/
  features/
    billing/
      billing.service.ts
      billing.service.spec.ts    ← unit tests for service
    auth/
      auth.handlers.ts
      auth.handlers.spec.ts      ← integration tests for HTTP handlers
      token-rotation.spec.ts     ← focused spec for token rotation edge cases
      rate-limiting.spec.ts      ← focused spec for lockout behaviour
apps/cf-commerce/src/
  pricing/
    Pipeline/
      Checkout.spec.ts           ← pipeline tests
  events/
    free/
      Dsl.spec.ts                ← Free Monad program tests
```

### What to test per layer

| Layer | What to test | What NOT to test |
|-------|-------------|-----------------|
| Domain entities | FSM transitions, validation, immutability | Firebase reads/writes |
| Services | Business rule orchestration, error propagation | HTTP response shaping |
| HTTP handlers | Request parsing, status codes, auth enforcement | Business logic (belongs in service) |
| Pricing pipeline | Each step independently + full pipeline | Firebase, Stripe, Omise calls |
| Free Monad programs | Dry-run interpreter output | Firebase interpreter |

---

## Common Pitfalls

**1. Forgetting `test.setup.ts` env vars**

```
Error: PASETO_KEY must be a 64-character hex string
```

Fix: ensure `test.setup.ts` is imported or `process.env.PASETO_KEY` is set before the module loads.

**2. Firebase `transaction()` null pass**

The callback receives `null` on the first (speculative) invocation. If the mock doesn't handle `null`, the repository will throw `Cannot read property 'qty' of null`. Always write the callback defensively:

```typescript
transaction: async (cb) => {
  cb(null)  // mock speculative pass
  return { committed: true, snapshot: { val: () => cb(existingData) } }
}
```

**3. Async fire-and-forget events**

`eventPublisher.publish()` is called with `void` — it's not awaited. If you assert `publishedEvents.length` immediately after calling the service, the push may not have happened yet. Use `await Promise.resolve()` to flush microtasks, or make the mock synchronous.

**4. Branded type construction in tests**

```typescript
// Wrong — TypeScript won't accept plain string
const id: ProductId = "abc"

// Correct — use the branded constructor or cast
const id = { __brand: "ProductId" as const, value: "abc" } as ProductId
```

**5. `Maybe<string>` vs `string | undefined`**

Domain types use `Maybe<T>` (Some/None), not optional fields. In tests:

```typescript
import { Some, None } from "@fabric/types"
const merchant = { stripeCustomerId: None(), ... }
const merchant2 = { stripeCustomerId: Some("cus_abc"), ... }
```
