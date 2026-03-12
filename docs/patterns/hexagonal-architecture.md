# Hexagonal Architecture (Ports & Adapters)

`apps/cf-api` follows hexagonal architecture strictly. This document explains the structure, the port contracts, and how to add new adapters.

---

## The Three Rings

```
┌─────────────────────────────────────────────────────────────────┐
│  Infrastructure (adapters — outer ring)                         │
│   Firebase, GCP Secret Manager, Memcached, HTTP clients         │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Application (ports — middle ring)                        │  │
│  │   Interfaces: OrderRepositoryPort, PricingPort, ...       │  │
│  │                                                           │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │  Domain (pure — inner ring)                         │  │  │
│  │  │   Entities, value objects, business rules, FSMs     │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

**Rule:** Inner rings never import from outer rings. Domain code imports nothing from infrastructure. Application ports define interfaces; infrastructure implements them.

---

## Directory Layout

```
apps/cf-api/src/
  domain/
    order/
      order.entity.ts            ← pure functions, Order type
      order.value-objects.ts     ← OrderId, ShippingAddress branded types
      order.events.ts            ← OrderPlaced, OrderConfirmed domain events
    product/
    cart/
    user/
    billing/
    shared/
      domain-event.ts

  application/
    ports/
      order.repository.port.ts   ← OrderRepositoryPort interface
      cart.repository.port.ts    ← CartRepositoryPort interface
      pricing.port.ts            ← PricingPort interface
      payment.port.ts            ← PaymentPort interface
      event-publisher.port.ts    ← EventPublisherPort interface
      merchant.repository.port.ts
      product.repository.port.ts
      voucher.repository.port.ts
      payout.repository.port.ts
      billing.port.ts

  infrastructure/
    firebase/
      firebase-order.repository.ts     ← implements OrderRepositoryPort
      firebase-product.repository.ts   ← implements ProductRepositoryPort
      firebase-cart.repository.ts
      firebase-payout.repository.ts
      firebase-token.repository.ts
      firebase-voucher.repository.ts
      firebase-user.adapter.ts
      firebase-activity.repository.ts
      firebase-lockout.adapter.ts
    adapters/
      http-pricing.adapter.ts          ← implements PricingPort
      http-payment.adapter.ts          ← implements PaymentPort
      http-event-publisher.adapter.ts  ← implements EventPublisherPort
    auth/
      paseto-verifier.service.ts
    guards/
      auth.middleware.ts
      csrf.middleware.ts
      plan.middleware.ts
    secrets/
      secret-manager.service.ts
    monitoring/
      logger.ts

  features/
    order/
      order.service.ts           ← orchestrates domain + ports
      order.handlers.ts          ← HTTP boundary (Hono routes)
    billing/
    auth/
    product/
    payout/
    store/
```

---

## Port Contracts

### Repository Ports

All repository ports return `Result<T, E>` — never throw. The `E` is typically a `TaggedError` from `@fabric/types`.

```typescript
// application/ports/order.repository.port.ts
interface OrderRepositoryPort {
  findById(id: OrderId): Promise<Result<Order, OrderNotFoundError | RepositoryError>>
  findByUserId(userId: UserId, pagination: PaginationInput): Promise<Result<PaginatedOrders, RepositoryError>>
  save(order: Order): Promise<Result<void, RepositoryError>>
  atomicReserveAndSave(order: Order, stockItems: StockItem[]): Promise<Result<Order, RepositoryError | InsufficientStockError>>
}
```

### Service Ports

```typescript
// application/ports/pricing.port.ts
interface PricingPort {
  calculateCheckout(
    items: ReadonlyArray<CartItem>,
    voucher: VoucherForRoc | undefined,
    address: { country: string; province: string },
    currency: CurrencyCode
  ): Promise<Result<CheckoutCalculation, PricingError>>
}

// application/ports/payment.port.ts
interface PaymentPort {
  initiatePayment(
    orderId: string,
    amountCents: number,
    currency: CurrencyCode,
    userId: string,
    paymentToken: string | undefined
  ): Promise<void>  // fire-and-forget — webhook delivers result
}

// application/ports/event-publisher.port.ts
interface EventPublisherPort {
  publish(event: EventEnvelope): Promise<void>  // fire-and-forget
}
```

---

## Adapters

### Firebase Adapters

Each Firebase adapter is a class that implements the corresponding port:

```typescript
export class FirebaseOrderRepository implements OrderRepositoryPort {
  constructor(private readonly db: Database) {}

  async findById(id: OrderId): Promise<Result<Order, OrderNotFoundError | RepositoryError>> {
    try {
      const snap = await this.db.ref(`orders/${id.value}`).once("value")
      if (!snap.exists()) return Err({ _tag: "OrderNotFoundError", message: `Order ${id.value} not found` })
      return Ok(mapFirebaseRecordToOrder(snap.val()))
    } catch (e) {
      return Err({ _tag: "RepositoryError", message: "Firebase read failed", cause: e })
    }
  }
}
```

**Key patterns in Firebase adapters:**

1. **Transaction null guard** — `transaction()` calls the callback with `null` speculatively. Always check `if (data === null)` and return `undefined` (abort) or the pre-read value:

```typescript
await ref.transaction((data) => {
  if (data === null) return preReadValue  // use pre-read from once("value")
  return { ...data, count: data.count + 1 }
})
```

2. **Soft deletes** — Never hard-delete records. Stamp `deletedAt: now.toISOString()` to preserve audit trail.

3. **Multi-location updates** — Use `db.ref().update({ "/path/a": valueA, "/path/b": valueB })` for atomic multi-path writes. Firebase RTDB applies these atomically.

4. **In-memory filtering** — RTDB has limited query support (one `orderByChild` per query). Complex filters (by status AND by owner) are applied in memory after fetching.

### HTTP Adapters

```typescript
export class HttpPricingAdapter implements PricingPort {
  constructor(private readonly baseUrl: string) {}

  async calculateCheckout(items, voucher, address, currency) {
    const signal = AbortSignal.timeout(5000)
    const response = await fetch(`${this.baseUrl}/checkout/calculate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, voucher, address, currency }),
      signal,
    })
    const body = await response.json()
    if (!body.ok) return Err(body.error)
    return Ok(body.value)
  }
}
```

---

## Wiring (Cold Start)

All wiring happens in `apps/cf-api/src/index.ts` during cold start:

```typescript
// 1. Secrets
const secrets = await loadSecrets()

// 2. Config
const config = loadConfig(secrets)

// 3. Firebase
const { db } = createFirebaseAdmin(config.firebase)

// 4. Repositories (infrastructure → port)
const orderRepo = new FirebaseOrderRepository(db)
const cartRepo = new FirebaseCartRepository(db)
const productRepo = new FirebaseProductRepository(db)
// ...

// 5. Adapters
const pricing = new HttpPricingAdapter(config.pricingServiceUrl)
const payment = new HttpPaymentAdapter(config.paymentServiceUrl)
const eventPublisher = new HttpEventPublisherAdapter(config.eventsServiceUrl)

// 6. Services (inject ports)
const orderService = new OrderService(
  orderRepo, cartRepo, payment, productRepo,
  pricing, voucherRepo, eventPublisher, activity, merchantRepo
)

// 7. Hono app
const app = new Hono()
registerOrderRoutes(app, orderService, verifier)
```

Nothing in the domain or application layer references Firebase, HTTP, or any concrete implementation. The wiring file is the only place infrastructure types appear.

---

## Adding a New Feature

### Step 1: Define domain types

```typescript
// domain/shipment/shipment.entity.ts
export interface Shipment {
  id: ShipmentId
  orderId: OrderId
  trackingNumber: string
  carrier: string
  shippedAt: Temporal.Instant
}
```

### Step 2: Define the port

```typescript
// application/ports/shipment.repository.port.ts
export interface ShipmentRepositoryPort {
  findByOrderId(orderId: OrderId): Promise<Result<Maybe<Shipment>, RepositoryError>>
  save(shipment: Shipment): Promise<Result<void, RepositoryError>>
}
```

### Step 3: Implement the adapter

```typescript
// infrastructure/firebase/firebase-shipment.repository.ts
export class FirebaseShipmentRepository implements ShipmentRepositoryPort {
  constructor(private readonly db: Database) {}
  // ...
}
```

### Step 4: Write the service

```typescript
// features/shipment/shipment.service.ts
export class ShipmentService {
  constructor(
    private readonly shipmentRepo: ShipmentRepositoryPort,
    private readonly orderRepo: OrderRepositoryPort,
    private readonly eventPublisher: EventPublisherPort
  ) {}
}
```

### Step 5: Write handlers

```typescript
// features/shipment/shipment.handlers.ts
export function registerShipmentRoutes(app: Hono, service: ShipmentService, verifier: PasetoVerifierService) {
  app.post("/admin/shipments", requireAuth(verifier), async (c) => { ... })
}
```

### Step 6: Wire in index.ts

```typescript
const shipmentRepo = new FirebaseShipmentRepository(db)
const shipmentService = new ShipmentService(shipmentRepo, orderRepo, eventPublisher)
registerShipmentRoutes(app, shipmentService, verifier)
```

---

## Testing Against Ports (Not Adapters)

Tests inject mock implementations of ports. Services under test never know whether they're talking to Firebase or a Map:

```typescript
const mockShipmentRepo: ShipmentRepositoryPort = {
  findByOrderId: async () => Ok(None()),
  save: async (shipment) => {
    saved.push(shipment)
    return Ok(undefined)
  },
}

const service = new ShipmentService(mockShipmentRepo, mockOrderRepo, mockEventPublisher)
```

This keeps tests fast (no network), deterministic (no RTDB state), and isolated (one test cannot affect another's Firebase state).

---

## Invariants

1. **Domain layer imports zero infrastructure.** No Firebase, no HTTP, no Stripe, no Omise in `domain/`.
2. **Application ports import domain only.** Port interfaces reference domain types — never Firebase types.
3. **Infrastructure imports application and domain.** Adapters map between Firebase records and domain types.
4. **Features import application (services) and domain.** HTTP handlers do not import Firebase.
5. **All errors are `Result<T, E>`.** No throws in domain or application layer.
6. **Port methods are async.** Even if the implementation is synchronous (in-memory mock), the interface is always `Promise<Result<T, E>>`.
