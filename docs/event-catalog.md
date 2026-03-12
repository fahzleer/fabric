# Event Catalog

This document is the authoritative reference for all domain events published and consumed across the Fabric platform. Events flow from `apps/cf-api` through the HTTP event bus to `apps/cf-commerce`, where they are persisted, interpreted, and fanned out via SSE.

---

## Transport

Events travel over HTTP POST `/events` from cf-api → cf-commerce. The envelope schema:

```typescript
interface EventEnvelope {
  event_id: string        // nanoid(), unique per event instance
  event_type: string      // e.g. "ProductCreated"
  aggregate_id: string    // the entity's primary ID
  occurred_at: string     // ISO 8601 UTC
  schema_version: number  // 1 (bump for breaking payload changes)
  payload: unknown        // event-specific JSON object
}
```

Publishing is **fire-and-forget** — `HttpEventPublisherAdapter.publish()` swallows errors and logs a warning. Order placement does not block on event delivery.

---

## Idempotency

cf-commerce marks each processed event in `processed_events/{eventId}` (Firebase RTDB transaction). Duplicate deliveries are silently ignored. The idempotency key is `event_id`.

---

## Event Routing (cf-commerce Router)

| Event Type | Handlers |
|------------|----------|
| `ProductCreated` | Aggregator (update CQRS read model) |
| `ProductUpdated` | Aggregator |
| `ProductArchived` | Aggregator |
| `ProductStockUpdated` | Aggregator |
| `OrderPlaced` | Aggregator + Hub (fan-out via SSE) |
| `OrderConfirmed` | Aggregator + Hub |
| `OrderCancelled` | Aggregator + Hub |

---

## Product Events

### ProductCreated

**Publisher:** `ProductService.createProduct()` → `HttpEventPublisherAdapter`
**Consumer:** cf-commerce `handleProductCreated` Free Monad program
**Firebase write:** `products_current/{productId}` (upsert)

```typescript
// packages/types/src/product.types.ts
interface ProductCreated {
  _type: "ProductCreated"
  _version: 1
  eventId: string
  occurredAt: string         // ISO UTC
  payload: {
    productId: string
    ownerId: string
    name: string
    price: { amount: number; currency: CurrencyCode }
    category: ProductCategory
    status: "draft"          // always draft at creation
    rev: 1
    stock: Record<ProductSize, number>  // display units
    imageUrls: string[]
    tagline?: string
    description?: string
  }
}
```

**Free Monad program steps:**
1. `isIdempotent(eventId)` — check `processed_events/{eventId}` (abort if already processed)
2. `persist(eventId, payload)` — write to `event_log/{eventId}`
3. `writeState(productId, productState)` — upsert `products_current/{productId}`
4. `emit(ProductCreated)` — fan-out to connected SSE subscribers
5. `notify(ownerId, "Your product was created")` — push notification via Hub

---

### ProductUpdated

**Publisher:** `ProductService.updateProduct()`
**Consumer:** cf-commerce `handleProductUpdated`
**Firebase write:** `products_current/{productId}` (patch)

```typescript
interface ProductUpdated {
  _type: "ProductUpdated"
  _version: 1
  payload: {
    productId: string
    ownerId: string
    changedFields: Partial<{
      name: string
      price: { amount: number; currency: CurrencyCode }
      status: ProductStatus
      stock: Record<ProductSize, number>
      tagline: string
      description: string
    }>
    newRev: number           // incremented revision
    previousRev: number
  }
}
```

**Free Monad program:** Reads existing state → applies delta → writes updated state.

---

### ProductArchived

**Publisher:** `ProductService.deleteProduct()`
**Consumer:** cf-commerce (updates `products_current` status to "archived")

```typescript
interface ProductArchived {
  _type: "ProductArchived"
  _version: 1
  payload: {
    productId: string
    ownerId: string
    archivedAt: string
  }
}
```

---

### ProductStockUpdated

**Publisher:** `OrderService.confirmOrder()` (stock decrement after payment)
**Consumer:** cf-commerce (updates `products_current/{productId}.stock`)

```typescript
interface ProductStockUpdated {
  _type: "ProductStockUpdated"
  _version: 1
  payload: {
    productId: string
    updates: Array<{ size: ProductSize; newQuantity: number }>
  }
}
```

---

## Order Events

### OrderPlaced

**Publisher:** `OrderService.placeOrder()`
**Consumer:** cf-commerce Router → Aggregator + Hub

```typescript
interface OrderPlaced {
  _type: "OrderPlaced"
  _version: 1
  payload: {
    orderId: string
    userId: string
    items: Array<{
      productId: string
      productName: string
      size: ProductSize
      quantity: number
      unitPriceCents: number
    }>
    totalAmountInCents: number
    shippingCents: number
    discountCents: number
    voucherCode?: string
    paymentMethod: PaymentMethod
    shippingAddress: ShippingAddress
    placedAt: string
  }
}
```

---

### OrderConfirmed

**Publisher:** `OrderService.confirmOrder()` (called from `/internal/payment-result`)
**Consumer:** cf-commerce Router → Hub (SSE notification to store owner)

```typescript
interface OrderConfirmed {
  _type: "OrderConfirmed"
  _version: 1
  payload: {
    orderId: string
    userId: string
    paymentId: string
    confirmedAt: string
    totalAmountInCents: number
  }
}
```

---

### OrderCancelled

**Publisher:** `OrderService.failOrder()` (called from `/internal/payment-result` on failure)
**Consumer:** cf-commerce Router → Hub

```typescript
interface OrderCancelled {
  _type: "OrderCancelled"
  _version: 1
  payload: {
    orderId: string
    userId: string
    reason: string
    cancelledAt: string
  }
}
```

---

## User Events

User events are published to the activity audit log (`activity_log/{nanoid}`) but **not** forwarded to cf-commerce. They exist for audit purposes only.

| Event | Trigger | Audit Path |
|-------|---------|------------|
| `UserRegistered` | `POST /auth/register` | `activity_log` |
| `UserLoggedIn` | `POST /auth/login` (success) | `activity_log` |
| `UserLoggedOut` | `POST /auth/logout` | `activity_log` |
| `UserLoginFailed` | `POST /auth/login` (fail) | `activity_log` + `login_attempts` |

---

## Cart Events

Cart events are fire-and-forget audit writes to `activity_log`. Not forwarded to cf-commerce.

| Event | Trigger |
|-------|---------|
| `CartCreated` | First item added |
| `ItemAddedToCart` | `CartService.addItem()` |
| `ItemRemovedFromCart` | `CartService.removeItem()` |
| `CartItemQuantityUpdated` | `CartService.updateItemQty()` |
| `CartCleared` | Post order placement |
| `CartSynced` | Web client Dexie → Firebase sync |

---

## Billing Events

Billing events are internal to cf-api. They are not published to cf-commerce.

| Event | Trigger | Effect |
|-------|---------|--------|
| `MerchantOnboarded` | First merchant profile creation | Creates Merchant record with `plan: "free"` |
| `PlanSubscribed` | Stripe `checkout.session.completed` webhook | Updates plan + planStatus |
| `PlanUpgraded` | Stripe subscription update webhook | Increments plan tier |
| `SubscriptionCancelled` | Stripe `customer.subscription.deleted` webhook | Sets `planStatus: "cancelled"`, sets `planExpiresAt` |
| `SubscriptionExpired` | (Future: cron job) | Reverts to `free` plan |
| `BillingPaymentFailed` | Stripe `invoice.payment_failed` webhook | Sets `planStatus: "past_due"` |

---

## Pricing Events (cf-commerce internal)

These events describe stateless pricing decisions. They are never persisted to RTDB; they exist as log entries only.

| Event | Source |
|-------|--------|
| `CheckoutCalculated` | `POST /checkout/calculate` success |
| `VoucherApplied` | Voucher discount applied in pipeline |
| `VoucherRejected` | Voucher failed validation |
| `InventoryReserved` | `POST /inventory/reserve` success |
| `InventoryReservationFailed` | Insufficient stock check |

---

## Payment Events

Payment events flow from cf-commerce back to cf-api via `POST /internal/payment-result`.

| Event | Transport | Handler |
|-------|-----------|---------|
| `PaymentInitiated` | Internal log | `/payment/initiate` handler |
| `PaymentProcessed` | POST `/internal/payment-result` | `OrderService.confirmOrder()` |
| `PaymentFailed` | POST `/internal/payment-result` | `OrderService.failOrder()` |
| `RefundInitiated` | cf-commerce log | Manual admin action |
| `RefundCompleted` | cf-commerce log | Omise gateway callback |

### `/internal/payment-result` payload:

```typescript
{
  orderId: string
  paymentId: string
  success: boolean
  reason?: string        // failure reason
}
```

**Security:** `x-internal-secret` header required (HMAC-SHA256 validated, constant-time compare).

---

## SSE Delivery (Real-Time Notifications)

Hub maintains `Map<userId, callback>`. When cf-commerce processes an event:

1. Router calls `hub.push(userId, event)` for relevant subscribers
2. Hub invokes callback → `controller.enqueue(data: ...)` → SSE frame
3. Client receives `data: {"type": "OrderConfirmed", ...}\n\n`

**Connection lifetime:**
- Client opens `GET /sse/:userId` (cf-commerce)
- Heartbeat every 30s to prevent proxy timeouts
- Client deregisters on disconnect or SSE error
- Server calls `controller.cancel()` on teardown (SIGTERM)

**Delivery guarantee:** At-most-once. If client is disconnected when event fires, the event is lost. Clients should re-fetch state on reconnect.

---

## Event Schema Versioning

- `_version` field on every event type
- Bump `_version` only on **breaking** payload changes
- The cf-commerce Free Monad interpreter checks `schema_version` in the envelope
- Additive changes (new optional fields) do not require a version bump
- Breaking changes require dual-read support in the interpreter for one release window

---

## Adding a New Event Type

1. Define the event type in `packages/types/src/` (e.g., `product.types.ts`)
2. Add publisher call in the relevant cf-api service
3. Add to `Event.ts` in cf-commerce (DomainEvent union type)
4. Add case to `Router.ts` dispatch table
5. Write Free Monad program in `Dsl.ts` or handle in aggregator
6. Add idempotency guard in the program
7. Write unit test with dry-run interpreter
