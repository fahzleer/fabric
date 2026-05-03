# ADR 0005: effect-ts as Canonical FP Library

**Status:** Accepted  
**Date:** 2024-02-10

## Context

The codebase uses functional programming primitives (Either, Option, pipe, Effect) in several places. Before this ADR, three FP "sources" coexisted:

1. **`packages/types/src/kernel.ts`** — custom `Result<T,E>`, `Maybe<T>`, `Brand<T,K>` types (no Either/pipe)
2. **`effect-ts` (`"effect"`)** — used for `Either`, `Option`, `pipe` in the pricing pipeline; `Effect`, `Schedule`, `Duration` for retry logic; `Option` in React components
3. **`@effect-atom/atom-react`** — used for `Atom` React state management

A fourth library (`fp-ts`) was considered but never adopted — it is absent from all package.json files.

The concern was that mixing `kernel.ts` Result with `effect-ts` Either in the same codebase creates two parallel patterns for the same concept, and that future contributors might introduce `fp-ts` as a third Either source.

## Decision

**`effect-ts` is the canonical library for Either, Option, pipe, and Effect-based concurrency.** `kernel.ts` `Result<T,E>` is retained only for the service/infrastructure layer where the full `effect-ts` runtime is inappropriate (synchronous domain logic, Firebase adapters).

Explicit boundaries:
| Layer | FP primitives | Library |
|---|---|---|
| Pricing pipeline (ROP) | `Either`, `pipe` | `effect-ts` |
| React components | `Option`, `Effect` | `effect-ts` |
| Event publisher retry | `Effect`, `Schedule` | `effect-ts` |
| Domain + service layer | `Result<T,E>`, `Maybe<T>` | `kernel.ts` |
| Schema parsing | `Schema.parse` | `effect-ts` |
| Atom state | `Atom` | `@effect-atom/atom-react` |

**Forbidden pattern:**
```typescript
// In the same file — pick ONE
import { Either } from "effect";
import { Ok, Err } from "@fabric/types";  // kernel Result — not the same as Either
```

`kernel.ts` `Result` and `effect-ts` `Either` must not be mixed in the same function or module.

## Consequences

**Positive:**
- Single Either/pipe library in any given file — no confusion about which `right`/`left` to use
- `effect-ts` is already the dominant library by file count — standardizing on it reduces the conceptual surface
- `kernel.ts` stays small (Brand, Result, Maybe, CurrencyCode) — no new abstractions added there

**Negative:**
- `effect-ts` is a heavy dependency (~300KB minified) — present even when only `Option` is used
- The split between `kernel.ts` Result and `effect-ts` Either requires contributors to know which layer they're in
- `@effect-atom/atom-react` is tightly coupled to `effect-ts` version — upgrades must be coordinated

## Related

- `packages/types/src/kernel.ts`
- `apps/cf-commerce/src/pricing/Pipeline/` (effect-ts Either/pipe)
- `apps/cf-api/src/infrastructure/events/effect-event-publisher.ts` (effect-ts Effect)
