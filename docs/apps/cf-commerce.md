# cf-commerce — Commerce Function

**Runtime**: Firebase Functions v2 (Hono 4.7.0 on Bun 1.2.22)
**Port (dev)**: 8082
**Memory**: 512MiB
**Timeout**: 120 seconds (SSE connections require extended timeout)
**Min instances**: 0 (scales to zero; pricing and payment are synchronous calls from cf-api)
**Concurrency**: 80

---

## What Lives Here

cf-commerce packages three architecturally distinct subsystems into a single Cloud Function:

| Subsystem | Pattern | Purpose |
|---|---|---|
| Events | CQRS + Free Monad DSL | Receive domain events, update read models, fan-out SSE |
| Pricing | Railway Oriented Programming | Validate checkout, apply vouchers, calculate totals |
| Payment | Command Pattern | Charge cards, record payments, notify results |

They share a process boundary but nothing else. No shared mutable state. No shared database connection pools. No shared configuration beyond `INTERNAL_SECRET` and `FIREBASE_*` env vars.

---

## Subsystem 1: Events (CQRS via Free Monad)

### The Problem with Direct Firebase Calls

The naive approach to event handling looks like this:

```typescript
// ❌ Don't do this
async function handleProductCreated(event: ProductCreatedEvent) {
  await db.ref(`products_current/${event.payload.productId}`).set(event.payload)
  await db.ref(`processed_events/${event.eventId}`).set(true)
  notifyConnectedClients(event.payload.sellerId, "product_created")
}
```

This is untestable without Firebase. You cannot run this logic in a unit test without either hitting a real database or setting up a complex mock. At scale, you will have hundreds of these handlers and the test suite will be a Firebase emulator dependency chain.

### The Free Monad Solution

A **Free Monad** separates the *description* of a program from its *execution*. The program is a pure data structure — a tree of operations — that an interpreter walks and executes.

```typescript
// The DSL: every possible operation as a discriminated union
type EventOp<A> =
  | { readonly _tag: "Pure";       readonly value: A }
  | { readonly _tag: "Persist";    readonly event: DomainEvent;              readonly k: (_: undefined) => EventOp<A> }
  | { readonly _tag: "ReadState";  readonly id: string;                      readonly k: (_: Option<ProductState>) => EventOp<A> }
  | { readonly _tag: "WriteState"; readonly id: string; state: ProductState; readonly k: (_: undefined) => EventOp<A> }
  | { readonly _tag: "Notify";     readonly userId: string; message: string; readonly k: (_: undefined) => EventOp<A> }
  | { readonly _tag: "Emit";       readonly derived: DomainEvent;            readonly k: (_: undefined) => EventOp<A> }
  | { readonly _tag: "IsIdempotent"; readonly eventId: string;               readonly k: (_: boolean) => EventOp<A> }

// bind: monadic sequencing — thread the result of one operation into the next
const bind = <A, B>(op: EventOp<A>, f: (a: A) => EventOp<B>): EventOp<B> => {
  // traverses the tree, attaches f at every Pure leaf
}
```

### Programs (Pure, No Side Effects)

Programs are pure descriptions. They cannot fail. They cannot touch Firebase. They are just data.

```typescript
// Handles a ProductCreated event: persist it, update the read model
function handleProductCreated(event: ProductCreatedEvent): EventOp<void> {
  return bind(
    isIdempotent(event.eventId),
    (seen) => seen
      ? pure(undefined)               // Already processed — skip
      : bind(
          persist(event),             // Append to event_log
          () => bind(
            writeState(event.payload.productId, buildProductState(event.payload)),
            () => emit(buildProductListingUpdatedEvent(event))  // Derived event
          )
        )
  )
}

// Handles an OrderPlaced event
function handleOrderPlaced(event: OrderPlacedEvent): EventOp<void> {
  return bind(
    isIdempotent(event.eventId),
    (seen) => seen ? pure(undefined) : bind(
      persist(event),
      () => notify(event.payload.userId, `Order ${event.payload.orderId} confirmed`)
    )
  )
}
```

### Interpreters (Side Effects Happen Here)

**Production Interpreter** (Firebase):

```typescript
async function interpret<A>(op: EventOp<A>, ctx: FirebaseContext): Promise<A> {
  switch (op._tag) {
    case "Pure":
      return op.value

    case "IsIdempotent": {
      const snap = await ctx.db.ref(`processed_events/${op.eventId}`).get()
      return interpret(op.k(snap.exists()), ctx)
    }

    case "Persist": {
      await ctx.db.ref(`event_log/${op.event.eventId}`).set(op.event)
      await ctx.db.ref(`processed_events/${op.event.eventId}`).set(true)
      return interpret(op.k(undefined), ctx)
    }

    case "ReadState": {
      const snap = await ctx.db.ref(`products_current/${op.id}`).get()
      return interpret(op.k(snap.exists() ? Option.some(snap.val()) : Option.none()), ctx)
    }

    case "WriteState": {
      await ctx.db.ref(`products_current/${op.id}`).set(op.state)
      return interpret(op.k(undefined), ctx)
    }

    case "Notify": {
      ctx.hub.broadcast(op.userId, op.message)  // SSE fan-out
      return interpret(op.k(undefined), ctx)
    }

    case "Emit": {
      await interpret(route(op.derived), ctx)   // Recursively handle derived event
      return interpret(op.k(undefined), ctx)
    }
  }
}
```

**In-Memory Interpreter** (tests):

```typescript
async function interpretDryRun<A>(op: EventOp<A>, ctx: InMemoryContext): Promise<A> {
  switch (op._tag) {
    case "Persist": {
      ctx.events.set(op.event.eventId, op.event)      // Map instead of RTDB
      ctx.processed.add(op.event.eventId)
      return interpretDryRun(op.k(undefined), ctx)
    }
    case "WriteState": {
      ctx.states.set(op.id, op.state)                 // Map instead of RTDB
      return interpretDryRun(op.k(undefined), ctx)
    }
    // ...
  }
}
```

Tests run against the in-memory interpreter. The program is identical. The only thing that changes is the interpreter. This is the entire point.

### SSE Fan-Out

`GET /sse/:userId` upgrades the HTTP connection to Server-Sent Events. The `Hub` maintains a `Map<userId, Set<SSEConnection>>`. When a `Notify` operation executes, the interpreter calls `hub.broadcast(userId, message)` which writes to all active SSE connections for that user.

```typescript
// SSE endpoint
app.get("/sse/:userId", async (c) => {
  const userId = c.req.param("userId")
  return stream(c, async (stream) => {
    const connection = hub.add(userId, stream)
    try {
      await stream.onAbort  // Wait for client disconnect
    } finally {
      hub.remove(userId, connection)
    }
  })
})
```

SSE connections are cleaned up automatically when the client disconnects (AbortSignal). The hub is in-memory — connections are lost on cold start. This is acceptable; clients are expected to reconnect and re-establish SSE subscriptions.

### Event Routes

```
POST  /events              — Receive a domain event from cf-api
GET   /products            — List active products (from products_current read model)
GET   /products/:id        — Single product detail
GET   /sse/:userId         — SSE real-time stream
GET   /health              — Health check
```

---

## Subsystem 2: Pricing (Railway Oriented Programming)

### The Problem with Imperative Validation

```typescript
// ❌ Imperative validation: error handling is scattered, flow is hard to follow
async function calculateCheckout(cart: Cart): Promise<CheckoutResult> {
  if (cart.items.length === 0) throw new Error("Cart is empty")
  for (const item of cart.items) {
    if (item.price <= 0) throw new Error("Invalid price")
    if (item.quantity === 0) throw new Error("Zero quantity")
  }
  const subtotal = cart.items.reduce(...)
  if (subtotal < minimumOrder) throw new Error("Below minimum")
  // ... 6 more validation steps, each with a throw
}
```

This function has 8+ exit points. Error types are strings. The caller has no idea what can go wrong. Testing requires catching exceptions.

### Railway Oriented Programming

Conceptually: imagine a railway with two tracks — success (right) and failure (left). Every step in the pipeline either stays on the success track (continues) or switches to the failure track (short-circuits with a typed error). The failure track carries a discriminated union of every possible error.

```typescript
type PricingError =
  | { _tag: "EmptyCart" }
  | { _tag: "InvalidPrice";             productId: string; price: number }
  | { _tag: "ZeroQuantity";             productId: string }
  | { _tag: "InsufficientStock";        productId: string; requested: number; available: number }
  | { _tag: "StockLockFailed";          productId: string }
  | { _tag: "VoucherExpired";           code: string; expiredAt: string }
  | { _tag: "VoucherExhausted";         code: string }
  | { _tag: "VoucherNotFound";          code: string }
  | { _tag: "OrderBelowMinimum";        minimum: number; actual: number }
  | { _tag: "InvalidDiscount";          reason: string }
  | { _tag: "UndeliverableAddress";     province: string }
  | { _tag: "ShippingCalculationFailed" }
  | { _tag: "InvalidCurrency";          currency: string }
```

The pipeline uses `Either<PricingError, T>` from the `effect` library, chained via `pipe + Either.flatMap`:

```typescript
// Either.left  = PricingError (failure track)
// Either.right = success value

const checkoutFlow = (req: CheckoutRequest): Either<PricingError, CheckoutResult> =>
  pipe(
    Either.right(req),
    Either.flatMap(validateNotEmpty),        // Either<EmptyCart, Req>
    Either.flatMap(validateItemPrices),      // Either<InvalidPrice|ZeroQuantity, Req>
    Either.flatMap(calculateSubtotal),       // Either<InsufficientStock, Req & { subtotal }>
    Either.flatMap(applyVoucher),            // Either<Voucher*, Req & { subtotal, discount }>
    Either.flatMap(addShipping),             // Either<Shipping*, Req & { ... , shipping }>
    Either.flatMap(validateCurrency),        // Either<InvalidCurrency, CheckoutResult>
  )
```

Every step is a pure function: `(T) => Either<PricingError, T>`. No async. No database calls. No side effects. The entire pricing pipeline can be tested with zero infrastructure.

**Why is pricing stateless?** cf-api passes stock quantities in the request body. Pricing never touches a database. This design decision (ADR-005) keeps pricing instantaneous and eliminates a network roundtrip inside the calculation.

### Pricing Routes

```
POST  /checkout/calculate    — Full checkout: subtotal + voucher + shipping
POST  /pricing/validate      — Price validation only (no shipping)
POST  /inventory/reserve     — Authoritative stock reservation check
POST  /voucher/apply         — Apply voucher code to a subtotal
POST  /pos/calculate         — Point-of-sale calculation (in-store)
```

---

## Subsystem 3: Payment (Command Pattern)

### The Problem with Monolithic Payment Functions

Payment logic is the most dangerous code in the system. A bug in payment logic can charge customers the wrong amount, fail to record a successful charge, or leave an order in an inconsistent state. The code must be testable *without* a payment gateway.

### Separation: Logic vs Execution

```
processPaymentLogic(order, request)
  → pure function
  → returns List[PaymentCommand]
  → no side effects, no network calls, no database calls

interpretPaymentCommands(commands, gateway)
  → executes the commands against a real (or mock) gateway
  → side effects happen here and only here
```

### PaymentCommand ADT

```typescript
type PaymentCommand =
  | {
      _tag: "ChargeCard"
      orderId: string
      amountCents: number
      currency: string
      token: string        // Omise card token
    }
  | {
      _tag: "RecordPayment"
      orderId: string
      paymentId: string
      amountCents: number
    }
  | {
      _tag: "NotifySuccess"
      orderId: string
      paymentId: string
    }
  | {
      _tag: "NotifyFailure"
      orderId: string
      reason: string
    }
  | {
      _tag: "RefundPayment"
      paymentId: string
      amountCents: number
    }
```

### Pure Logic Layer

```typescript
function processPaymentLogic(
  order: Order,
  request: PaymentRequest
): List<PaymentCommand> {
  if (order.status !== "pending") {
    return [{ _tag: "NotifyFailure", orderId: order.id, reason: "order_not_pending" }]
  }

  if (order.amountCents <= 0) {
    return [{ _tag: "NotifyFailure", orderId: order.id, reason: "invalid_amount" }]
  }

  return [
    { _tag: "ChargeCard", orderId: order.id, amountCents: order.amountCents,
      currency: order.currency, token: request.cardToken },
    // RecordPayment and NotifySuccess are emitted after ChargeCard succeeds (in interpreter)
  ]
}
```

The logic layer decides *what* to do. The interpreter decides *how* to do it.

### Interpreter

```typescript
async function interpretPaymentCommands(
  commands: List<PaymentCommand>,
  gateway: PaymentGatewayPort
): Promise<void> {
  for (const cmd of commands) {
    switch (cmd._tag) {
      case "ChargeCard": {
        const result = await gateway.charge({
          orderId: cmd.orderId,
          amountCents: cmd.amountCents,
          currency: cmd.currency,
          token: cmd.token,
        })

        if (result._tag === "Ok") {
          // Continue with RecordPayment + NotifySuccess
          await interpretPaymentCommands([
            { _tag: "RecordPayment", orderId: cmd.orderId, paymentId: result.value.paymentId, amountCents: cmd.amountCents },
            { _tag: "NotifySuccess", orderId: cmd.orderId, paymentId: result.value.paymentId },
          ], gateway)
        } else {
          await interpretPaymentCommands([
            { _tag: "NotifyFailure", orderId: cmd.orderId, reason: result.error.message },
          ], gateway)
        }
        break
      }

      case "NotifySuccess": {
        // POST /internal/payment-result to cf-api (1 retry on failure)
        await notifyCfApi({ orderId: cmd.orderId, paymentId: cmd.paymentId, status: "success" })
        break
      }

      // ... other cases
    }
  }
}
```

### Payment Gateways

`PAYMENT_GATEWAY` env var selects the gateway:

| Value | Implementation | Behavior |
|---|---|---|
| `"omise"` | `OmisePaymentGateway` | Real Omise API (fetch-based, no SDK) |
| `"mock"` (default) | `MockPaymentGateway` | In-process, 95% success rate, random delay |

The gateway port:

```typescript
interface PaymentGatewayPort {
  charge(req: ChargeRequest): Promise<Result<ChargeSuccess, PaymentError>>
  refund(paymentId: string, amountCents: number): Promise<Result<RefundSuccess, PaymentError>>
}
```

`OmisePaymentGateway` uses `fetch` directly — no Omise SDK dependency. This avoids SDK version lock-in and the SDK's error handling quirks.

**PromptPay**: Separate adapter (`PromptPayAdapter` / `MockPromptPayAdapter`). PromptPay QR generation uses the Omise PromptPay API. cf-api calls `POST /payment/promptpay/qr` on cf-commerce to generate the QR code. Payment confirmation arrives via Omise's webhook at `POST /payment/omise/webhook`.

### Payment Routes

```
POST  /payment/initiate              — Initialize payment (returns gateway-specific payload)
POST  /payment/process               — Process payment (charge card)
GET   /payment/promptpay/...         — PromptPay QR and status endpoints
POST  /payment/omise/webhook         — Omise payment notification webhook
```

### cf-api Callback

After `NotifySuccess` or `NotifyFailure`, the payment interpreter posts back to cf-api:

```typescript
// POST /internal/payment-result
// Headers: x-internal-secret: INTERNAL_SECRET
{
  orderId: string,
  status: "success" | "failure",
  paymentId?: string,
  reason?: string
}
```

One retry on failure. No exponential backoff. If both attempts fail, the order stays in `"pending"` status — a known gap requiring manual resolution. See [architecture.md — Failure Modes](../architecture.md#failure-modes).

---

## Configuration

```typescript
interface CfCommerceConfig {
  internalSecret: string          // For /internal/* validation
  corsOrigin: string
  apiServiceUrl: string           // cf-api URL for payment callbacks
  paymentGateway: "omise" | "mock"
  omiseSecretKey?: string         // Required if paymentGateway = "omise"
  omiseWebhookSecret?: string
}
```

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `INTERNAL_SECRET` | ✅ | Shared secret with cf-api |
| `FIREBASE_PROJECT_ID` | ✅ | Firebase project |
| `FIREBASE_DATABASE_URL` | ✅ | RTDB URL |
| `CORS_ORIGIN` | optional | Default `"*"` |
| `API_SERVICE_URL` | optional | cf-api URL (for payment callbacks) |
| `PAYMENT_GATEWAY` | optional | `"omise"` or `"mock"` (default `"mock"`) |
| `OMISE_SECRET_KEY` | conditional | Required if `PAYMENT_GATEWAY=omise` |
| `OMISE_WEBHOOK_SECRET` | optional | Webhook signature verification |

---

## Testing

### Events (Free Monad)

```typescript
// test/events/Interpreter.spec.ts
describe("handleProductCreated", () => {
  it("persists event and writes state on first call", async () => {
    const ctx = createInMemoryContext()
    const event = buildProductCreatedEvent({ productId: "prod_1" })

    await interpretDryRun(handleProductCreated(event), ctx)

    expect(ctx.events.has(event.eventId)).toBe(true)
    expect(ctx.states.has("prod_1")).toBe(true)
  })

  it("skips duplicate events (idempotency)", async () => {
    const ctx = createInMemoryContext()
    ctx.processed.add("evt_duplicate")
    const event = buildProductCreatedEvent({ eventId: "evt_duplicate" })

    await interpretDryRun(handleProductCreated(event), ctx)

    // Nothing was written
    expect(ctx.events.size).toBe(0)
  })
})
```

No Firebase. No network. Pure in-memory. Sub-millisecond test execution.

### Payment (Command Pattern)

```typescript
// test/payment/interpreter.spec.ts
describe("interpretPaymentCommands", () => {
  it("charges card and notifies success", async () => {
    const gateway = new MockPaymentGateway({ successRate: 1.0 })  // Always succeed
    const commands: PaymentCommand[] = [
      { _tag: "ChargeCard", orderId: "ord_1", amountCents: 5000, currency: "THB", token: "tok_test" }
    ]

    await interpretPaymentCommands(commands, gateway)

    expect(gateway.charges).toHaveLength(1)
    expect(gateway.charges[0].amountCents).toBe(5000)
  })
})
```

### Pricing (Pure Functions)

```typescript
// test/pricing/checkout.spec.ts
describe("checkoutFlow", () => {
  it("returns EmptyCart for empty cart", () => {
    const result = checkoutFlow({ items: [], ... })
    expect(Either.isLeft(result)).toBe(true)
    expect((Either.getLeft(result) as any)._tag).toBe("EmptyCart")
  })

  it("applies percentage voucher correctly", () => {
    const result = checkoutFlow({ items: [{ price: 1000, quantity: 2 }], voucher: "SAVE10", ... })
    expect(Either.isRight(result)).toBe(true)
    expect(Either.getRight(result).discount).toBe(200)  // 10% of 2000
  })
})
```

No network. No database. Pure function in, Either out.
