# ADR 0006: Remove Free Monad DSL from Event Processing

**Status:** Accepted  
**Date:** 2024-02-10

## Context

The event processing pipeline in `apps/cf-commerce/src/events/` was implemented using a Free Monad pattern: `EventOp<A>` DSL operations were defined in `free/Dsl.ts` and interpreted in `free/Interpreter.ts`. The intent was to separate "what to do" from "how to do it".

In practice this caused problems:
- The interpreter had a single call site (`ProductAgg.ts`) — zero benefit from the abstraction
- Type signatures became complex: `FreeMonad<EventOp<A>, A>` vs plain `Promise<A>`
- Effect.Effect was used as a trampoline but added heavy transitive dependencies
- New team members could not understand the event handling code without understanding Free Monads
- Testing required mocking the interpreter, adding indirection with no benefit

## Decision

Remove the Free Monad DSL and interpreter. Replace with plain async functions that accept `EventRepositoryPort` as a dependency.

Deleted files:
- `apps/cf-commerce/src/events/free/Dsl.ts`
- `apps/cf-commerce/src/events/free/Interpreter.ts`
- `apps/cf-commerce/src/events/free/Interpreter.spec.ts`
- `apps/cf-commerce/src/events/functor/Applicative.ts`

New pattern: `handleProductCreated(repo: EventRepositoryPort, meta, payload): Promise<void>`

## Consequences

**Positive:**
- Event handlers are now readable by any TypeScript developer
- `EventRepositoryPort` is a plain interface — easily mocked with constructor injection
- 400+ lines of DSL/interpreter code deleted
- No Effect.Effect dependency in the event pipeline (only used in pricing where it was already there)

**Negative:**
- Lost the theoretical ability to swap interpreters — in practice this was never used
- Effect.Effect is still a transitive dependency via other modules

## Related

- ADR 0007 for similar removal in payment processing
