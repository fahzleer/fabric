# Contributing Guide

---

## Code Standards

### TypeScript

**No `any`.** If you need to escape the type system, use `unknown` and narrow explicitly. `any` defeats the purpose of having types.

**No thrown exceptions in service or domain code.** Functions that can fail return `Result<T, E>`. Repositories return `Result<T, RepositoryError>`. Services return `Result<T, ServiceError>`. HTTP handlers convert `Result` to HTTP status codes. Exceptions are for unrecoverable runtime errors (OOM, missing required environment variable).

**No raw strings where branded types exist.** Use `ProductId`, `OrderId`, `UserId`. Construct them at the boundary where you receive raw data (HTTP request parsing). Pass branded types internally.

**Explicit over implicit.** Explicit constructor injection over global singletons. Explicit `Result<T, E>` over implicit exceptions. Explicit type annotations on function return types (at the module boundary, not everywhere).

### File Organization

Every feature in `cf-api` lives in `src/features/{domain}/`:
```
src/features/
  {domain}/
    {domain}.handlers.ts     ← HTTP handlers (thin: validate input, call service, return DTO)
    {domain}.service.ts      ← Business logic
    {domain}.service.spec.ts ← Service unit tests
    {domain}.types.ts        ← Local types (if not in @fabric/types)
```

Repository implementations live in `src/infrastructure/firebase/`:
```
src/infrastructure/
  firebase/
    {domain}.repository.ts
  guards/
    auth.middleware.ts
    role.middleware.ts
  monitoring/
    logger.ts
  secrets/
    secret-manager.service.ts
```

### Naming Conventions

| Pattern | Convention |
|---|---|
| Files | `kebab-case.ts` |
| Classes | `PascalCase` |
| Interfaces | `PascalCase` (no `I` prefix) |
| Type aliases | `PascalCase` |
| Functions | `camelCase` |
| Constants | `UPPER_SNAKE_CASE` (module-level) or `camelCase` (local) |
| Ports (interfaces) | `{Name}Port` — e.g., `ProductRepositoryPort`, `PaymentGatewayPort` |
| Adapters (implementations) | `{Backend}{Name}Adapter` — e.g., `FirebaseProductRepository`, `OmisePaymentGateway` |

---

## Testing Standards

### Test File Location

Tests live next to the code they test:

```
src/features/product/product.service.ts
src/features/product/product.service.spec.ts
```

Not in a separate `__tests__` directory. Not in a root-level `test/` directory. Next to the file.

### Test Structure

```typescript
import { describe, test, expect, beforeEach } from "bun:test"

describe("ProductService", () => {
  // Build the system under test in beforeEach for isolation
  let service: ProductService
  let productRepo: InMemoryProductRepository
  let eventPublisher: NoopEventPublisher
  let activityRepo: InMemoryActivityRepository

  beforeEach(() => {
    productRepo  = new InMemoryProductRepository()
    eventPublisher = new NoopEventPublisher()
    activityRepo = new InMemoryActivityRepository()
    service = new ProductService(productRepo, eventPublisher, activityRepo)
  })

  describe("create", () => {
    test("returns Ok with created product", async () => {
      const result = await service.create(validCreateInput, testUserId)
      expect(result._tag).toBe("Ok")
    })

    test("publishes ProductCreated event", async () => {
      await service.create(validCreateInput, testUserId)
      expect(eventPublisher.published).toHaveLength(1)
      expect(eventPublisher.published[0]._type).toBe("ProductCreated")
    })

    test("returns Err when repo fails", async () => {
      productRepo.failNextWrite = true   // In-memory test double
      const result = await service.create(validCreateInput, testUserId)
      expect(result._tag).toBe("Err")
    })
  })
})
```

**No mocking frameworks.** No `jest.fn()`, `vi.mock()`, `sinon.stub()`. Use in-memory implementations (test doubles) as constructor arguments. They are explicit, inspectable, and don't require framework-specific syntax.

### What to Test

**Test service logic, not repository implementation**. The repository has one job: call Firebase. Test that the service calls the correct repository methods with correct arguments and handles `Ok` and `Err` responses correctly.

**Test pricing pipelines exhaustively**. Every `PricingError` variant should have a test case. Pure functions are trivially testable — there is no excuse for incomplete coverage.

**Test event programs against the in-memory interpreter**. Programs are pure data. Test them by running `interpretDryRun(program, inMemoryCtx)` and asserting on `ctx.events`, `ctx.states`, `ctx.notifications`.

**Don't test the database**. `FirebaseProductRepository.findById()` calls `db.ref(...).get()`. That's a Firebase SDK call. Firebase tests its own SDK. You are not testing Firebase. Integration tests that hit the emulator are acceptable for smoke-testing the full stack, but unit tests should not depend on RTDB.

---

## Pull Request Process

### Before Opening a PR

```bash
bun run typecheck   # Must pass: zero TypeScript errors
bun run lint        # Must pass: zero Biome errors
bun run test        # Must pass: all tests green
```

If any of these fail, fix them before opening the PR. CI will run the same checks.

### PR Scope

A PR should do **one thing**. "Add product creation + fix auth bug + update types" is three PRs. Scope creep makes review harder and makes rollback impossible (you cannot roll back only the auth bug fix if it's bundled with the product creation feature).

### PR Description

```markdown
## What

One sentence: what does this PR do?

## Why

One paragraph: why is this change necessary? What problem does it solve?

## How

Bullet points: the significant decisions made in implementation.
Not a walkthrough of every line changed — assume the reviewer can read the diff.

## Testing

How was this tested? What edge cases were considered?
```

### Review Criteria

- Does the code follow the patterns established in this document?
- Are errors returned as `Result<T, E>`, not thrown?
- Are new dependencies injected via constructor, not accessed globally?
- Do new event handlers have corresponding in-memory interpreter tests?
- Do new pricing rules have tests for both the success case and the error case?
- Are new environment variables documented in the development guide?

---

## Adding a New Dependency

New dependencies require justification. Questions to ask before `bun add`:

1. **Does this already exist in the ecosystem?** Check `packages/*/package.json` and `apps/*/package.json`. A utility you need in cf-api might already be in cf-commerce.

2. **Is this the smallest package that solves the problem?** `lodash` for one `groupBy` call is wrong. `date-fns` for one `format` call might be right (date formatting is genuinely complex).

3. **Does it introduce a runtime?** Adding a framework (Express, Fastify, NestJS) to a service that already uses Hono is wrong.

4. **Is it maintained?** Check GitHub last commit, open issues, weekly downloads.

5. **Does it conflict with Biome or Bun?** Some packages assume Jest, Webpack, or Node-specific globals.

---

## Performance Considerations

### Cold Starts

cf-api has `minInstances: 1` — no cold starts for normal traffic. cf-commerce scales to zero; its cold start budget is the timeout of the first request it receives after a quiet period. Keep the cold start sequence fast:

- No synchronous filesystem reads at module initialization
- No heavy computation at module initialization
- `loadSecrets()` is async and awaited — this is the dominant cold start cost

### Database Access Patterns

RTDB read performance is determined by path depth and result size. Never read a parent node to get child data. Design paths for your access patterns:

```
✅ db.ref(`products_current/${productId}`)           → O(1) read
❌ db.ref("products_current").orderByChild("status")  → Full scan
```

If you find yourself needing ad-hoc queries against RTDB, stop. Add a denormalized path designed for that access pattern.

### Event Publishing

Event publishing from cf-api is fire-and-forget. Do not `await` the event publisher call in the critical path. The order is created; the event will eventually be processed. Consistency is eventual, not transactional.

---

## Common Mistakes

**Updating RTDB role instead of PostgreSQL**:
```sql
-- ✅ Correct: update PostgreSQL for merchant access
UPDATE "user" SET role = 'store_owner' WHERE email = 'merchant@example.com';
```
The web session role comes from PostgreSQL. Updating Firebase RTDB `users/{userId}.role` only affects cf-api's internal checks — it does NOT change what `session.user.role` returns in the Next.js app.

**Using `makeProductPriceFromCents()` expecting a `Result`**:
```typescript
// ❌ Wrong: this is not a Result
const price = makeProductPriceFromCents(1999, "THB")
if (price._tag === "Ok") ...  // TypeScript error — ProductPrice has no _tag

// ✅ Correct: it returns ProductPrice directly
const price = makeProductPriceFromCents(1999, "THB")
// price: ProductPrice, always valid
```

**Not wrapping shared atoms with `Atom.keepAlive`**:
```typescript
// ❌ Will be GC'd between useLayoutEffect seed and passive effect subscription
export const sharedAtom = Atom.make<MyType[]>([])

// ✅ Persists across the React render lifecycle
export const sharedAtom = Atom.keepAlive(Atom.make<MyType[]>([]))
```

**Calling cf-api routes that don't exist from the browser**:
The `/internal/**` routes are not proxied by the Cloudflare Worker. They are unreachable from the browser. Only server-side code (Next.js server actions, cf-commerce) can call them.
