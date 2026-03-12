# Free Monad Events — CQRS DSL

> "The essence of functional programming is substituting data for code." — The programs are data. The interpreter is code. You can swap the code. You cannot swap the data.

---

## Why Free Monads

The question is not "what is a Free Monad?" The question is "what problem does it solve?"

**The problem**: You have business logic (event handling programs) that must run against real infrastructure in production and against in-memory state in tests. The naive solution — dependency injection with interfaces — works, but it requires every effectful operation to be an injected dependency, and it requires you to construct mock implementations for every test.

The Free Monad solution is more radical: *the program itself is data*. It describes what operations should happen, without executing them. The interpreter decides how to execute. You swap the interpreter, not the dependencies.

---

## The DSL in Depth

```typescript
// events/free/Dsl.ts

// Every operation the event system can perform is a case in this union.
// Adding a new operation = adding a new case.
// Adding a new interpreter = implementing all cases.
type EventOp<A> =
  // Terminal case — no more operations, return a value
  | { readonly _tag: "Pure"; readonly value: A }

  // Append an event to the journal + mark as processed
  | { readonly _tag: "Persist"
      readonly event: DomainEvent
      readonly k: (result: undefined) => EventOp<A>
    }

  // Read a product's current materialized state
  | { readonly _tag: "ReadState"
      readonly id: string
      readonly k: (state: Option<ProductState>) => EventOp<A>
    }

  // Write/overwrite a product's materialized state
  | { readonly _tag: "WriteState"
      readonly id: string
      readonly state: ProductState
      readonly k: (result: undefined) => EventOp<A>
    }

  // Push a notification to a connected SSE client
  | { readonly _tag: "Notify"
      readonly userId: string
      readonly message: string
      readonly k: (result: undefined) => EventOp<A>
    }

  // Emit a derived domain event (handled recursively)
  | { readonly _tag: "Emit"
      readonly derived: DomainEvent
      readonly k: (result: undefined) => EventOp<A>
    }

  // Check if this eventId has already been processed
  | { readonly _tag: "IsIdempotent"
      readonly eventId: string
      readonly k: (seen: boolean) => EventOp<A>
    }
```

`k` is the **continuation** — the rest of the program after this operation completes. When the interpreter executes an operation, it passes the result to `k` to get the next `EventOp<A>` to execute.

### The bind Function

`bind` is monadic sequencing. It attaches a continuation `f` to every `Pure` leaf of an existing program:

```typescript
function bind<A, B>(op: EventOp<A>, f: (a: A) => EventOp<B>): EventOp<B> {
  switch (op._tag) {
    case "Pure":
      return f(op.value)          // Replace the leaf with f(value)

    case "Persist":
      return { ...op, k: (r) => bind(op.k(r), f) }   // Attach f deeper

    case "ReadState":
      return { ...op, k: (s) => bind(op.k(s), f) }

    // ... same pattern for all non-Pure cases
  }
}
```

This is the `>>=` (bind) operator from Haskell, translated to TypeScript. It threads the continuation through the entire program tree.

### Smart Constructors

Programs don't construct `EventOp` objects directly — they use smart constructors:

```typescript
const pure       = <A>(value: A): EventOp<A> =>
  ({ _tag: "Pure", value })

const persist    = (event: DomainEvent): EventOp<undefined> =>
  ({ _tag: "Persist", event, k: () => pure(undefined) })

const readState  = (id: string): EventOp<Option<ProductState>> =>
  ({ _tag: "ReadState", id, k: (s) => pure(s) })

const writeState = (id: string, state: ProductState): EventOp<undefined> =>
  ({ _tag: "WriteState", id, state, k: () => pure(undefined) })

const notify     = (userId: string, message: string): EventOp<undefined> =>
  ({ _tag: "Notify", userId, message, k: () => pure(undefined) })

const emit       = (derived: DomainEvent): EventOp<undefined> =>
  ({ _tag: "Emit", derived, k: () => pure(undefined) })

const isIdempotent = (eventId: string): EventOp<boolean> =>
  ({ _tag: "IsIdempotent", eventId, k: (seen) => pure(seen) })
```

---

## Programs (Pure Business Logic)

Programs compose the smart constructors via `bind`:

```typescript
// Handles a ProductCreated event
function handleProductCreated(event: ProductCreatedEvent): EventOp<void> {
  return bind(
    isIdempotent(event.eventId),     // "Has this been processed?"
    (seen) => {
      if (seen) return pure(undefined) // Yes → skip

      return bind(
        persist(event),              // No → append to journal
        () => bind(
          writeState(                // Update read model
            event.payload.productId,
            buildProductState(event.payload)
          ),
          () => emit(                // Emit derived "ProductListingUpdated" event
            buildProductListingUpdatedEvent(event)
          )
        )
      )
    }
  )
}
```

This is a pure function. It returns a *description* of what should happen — a tree of `EventOp` nodes. Nothing has executed yet. No database has been touched. No network call has been made.

---

## Interpreters

The interpreter walks the `EventOp` tree and executes each node:

### Firebase Interpreter (Production)

```typescript
async function interpret<A>(
  op: EventOp<A>,
  ctx: { db: Database; hub: NotificationHub }
): Promise<A> {
  switch (op._tag) {
    case "Pure":
      return op.value

    case "IsIdempotent": {
      const snap = await ctx.db.ref(`processed_events/${op.eventId}`).once("value")
      const seen = snap.exists()
      return interpret(op.k(seen), ctx)   // Continue with next op
    }

    case "Persist": {
      const batch = ctx.db.ref()
      await Promise.all([
        ctx.db.ref(`event_log/${op.event.eventId}`).set(op.event),
        ctx.db.ref(`processed_events/${op.event.eventId}`).set(true),
      ])
      return interpret(op.k(undefined), ctx)
    }

    case "ReadState": {
      const snap = await ctx.db.ref(`products_current/${op.id}`).once("value")
      const state = snap.exists() ? Option.some(snap.val() as ProductState) : Option.none()
      return interpret(op.k(state), ctx)
    }

    case "WriteState": {
      await ctx.db.ref(`products_current/${op.id}`).set(op.state)
      return interpret(op.k(undefined), ctx)
    }

    case "Notify": {
      ctx.hub.broadcast(op.userId, op.message)
      return interpret(op.k(undefined), ctx)
    }

    case "Emit": {
      const derivedProgram = route(op.derived)   // Dispatch to correct handler
      await interpret(derivedProgram, ctx)        // Execute derived program
      return interpret(op.k(undefined), ctx)
    }
  }
}
```

### In-Memory Interpreter (Tests)

```typescript
type InMemoryCtx = {
  events: Map<string, DomainEvent>
  processed: Set<string>
  states: Map<string, ProductState>
  notifications: Array<{ userId: string; message: string }>
}

async function interpretDryRun<A>(
  op: EventOp<A>,
  ctx: InMemoryCtx
): Promise<A> {
  switch (op._tag) {
    case "Pure":
      return op.value

    case "IsIdempotent":
      return interpretDryRun(op.k(ctx.processed.has(op.eventId)), ctx)

    case "Persist": {
      ctx.events.set(op.event.eventId, op.event)
      ctx.processed.add(op.event.eventId)
      return interpretDryRun(op.k(undefined), ctx)
    }

    case "ReadState":
      return interpretDryRun(
        op.k(ctx.states.has(op.id) ? Option.some(ctx.states.get(op.id)!) : Option.none()),
        ctx
      )

    case "WriteState": {
      ctx.states.set(op.id, op.state)
      return interpretDryRun(op.k(undefined), ctx)
    }

    case "Notify": {
      ctx.notifications.push({ userId: op.userId, message: op.message })
      return interpretDryRun(op.k(undefined), ctx)
    }

    case "Emit": {
      const derivedProgram = route(op.derived)
      await interpretDryRun(derivedProgram, ctx)
      return interpretDryRun(op.k(undefined), ctx)
    }
  }
}
```

**The interpreter is ~60 lines. The test infrastructure is zero.** You run tests by calling `interpretDryRun(handleProductCreated(event), createInMemoryCtx())` and asserting on the resulting `ctx` state.

---

## Testing

```typescript
describe("handleProductCreated", () => {
  function createCtx(): InMemoryCtx {
    return {
      events: new Map(),
      processed: new Set(),
      states: new Map(),
      notifications: [],
    }
  }

  test("persists event and updates product read model", async () => {
    const ctx = createCtx()
    const event = buildProductCreatedEvent({
      productId: "prod_001",
      name: "Test Shirt",
      price: 59900,
    })

    await interpretDryRun(handleProductCreated(event), ctx)

    // The program described these operations; the interpreter executed them
    expect(ctx.events.has(event.eventId)).toBe(true)
    expect(ctx.processed.has(event.eventId)).toBe(true)
    expect(ctx.states.get("prod_001")).toMatchObject({ name: "Test Shirt" })
  })

  test("idempotent: skips duplicate events", async () => {
    const ctx = createCtx()
    ctx.processed.add("evt_seen")  // Pre-mark as processed

    const event = buildProductCreatedEvent({ eventId: "evt_seen" })

    await interpretDryRun(handleProductCreated(event), ctx)

    // Nothing was written (idempotency check short-circuited the program)
    expect(ctx.events.size).toBe(0)
    expect(ctx.states.size).toBe(0)
  })

  test("emits derived ProductListingUpdated event", async () => {
    const ctx = createCtx()
    const event = buildProductCreatedEvent({ productId: "prod_002" })

    await interpretDryRun(handleProductCreated(event), ctx)

    // Two events: ProductCreated + ProductListingUpdated
    expect(ctx.events.size).toBe(2)
    const types = Array.from(ctx.events.values()).map((e) => e._type)
    expect(types).toContain("ProductListingUpdated")
  })
})
```

Test execution time: sub-millisecond. No Firebase process. No emulator. No `beforeAll(async () => firebase.connect())`. Just data structures and a function.

---

## Tradeoffs

**For**: Tests that run in <1ms without infrastructure. Programs that are trivially serializable (you could store them in a database and replay them). Complete separation of "what should happen" from "how it happens."

**Against**: Learning curve. Continuation-passing style is not how most engineers think. Debugging requires understanding that the program is a tree, not a sequence. TypeScript's type inference can struggle with deeply nested generic types (`EventOp<EventOp<EventOp<void>>>`).

**The verdict**: The learning cost is paid once. The test speed and testability benefits are paid back on every test run, forever. For event-driven systems where correctness is critical, this is worth it.
