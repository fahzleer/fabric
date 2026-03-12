# System Architecture

## The Central Tension

Every distributed system is a negotiation between three properties you cannot simultaneously maximize: consistency, availability, and partition tolerance (CAP). The literature will tell you to "pick two." The reality is you pick *which* two *per operation type*, and that choice is the core architectural decision.

Fabric's answer:

- **Write path** (place order, charge card): Strong consistency. One writer at a time. Accept higher latency.
- **Read path** (list products, get cart state): Eventual consistency. Reads from a pre-computed read model. Accept stale-by-milliseconds.
- **Event fan-out** (notify clients of state changes): At-least-once delivery. Idempotent handlers. Accept duplicate processing.

This is not CQRS as a cargo cult. It is CQRS because the access patterns *require* different models.

---

## Request Lifecycle

### Public Storefront Request

```
Browser → Cloudflare Worker → cf-api (GET /api/products)
                ↓
        productRepo.findActiveFiltered()
                ↓
        Firebase RTDB → products_current/{productId}
                ↓
        Response: PaginatedProductsDto[]
```

Cold-start budget: 512MiB, min-instances=1 keeps cf-api warm. P50 response: <80ms. No cache invalidation complexity because the read model (`products_current`) is updated by the event interpreter in cf-commerce whenever a ProductCreated/Updated event is processed.

### Order Placement

```
Browser
  → Worker → cf-api (POST /api/orders)
      ↓
  requireAuth(verifier)         ← PASETO token check
      ↓
  cartRepo.getCart(cartId)      ← Verify cart exists
      ↓
  pricing.validateCheckout()    ← HTTP → cf-commerce/pricing
      │                            Either<PricingError, CheckoutResult>
      │                            Stateless. cf-api sends stock data.
      ↓
  payment.initiate(order)       ← HTTP → cf-commerce/payment
      │                            Returns PaymentInitiated or PaymentError
      ↓
  orderRepo.create(order)       ← Write to RTDB /orders/{orderId}
      ↓
  eventPublisher.publish(       ← Fire-and-forget HTTP → cf-commerce/events
    OrderPlaced { orderId, ... }
  )
      ↓
  Response: { orderId, status: "pending" }
```

The payment gateway confirmation arrives asynchronously. cf-commerce/payment POSTs to `/internal/payment-result` after the charge completes. cf-api updates the order status. The client sees this via SSE.

### Merchant Portal Request

```
Browser (merchant dashboard)
  → web (Next.js Server Action)
      ↓
  auth.api.getSession()             ← better-auth, reads PostgreSQL
      ↓
  issueToken(userId, email, role)   ← POST /internal/issue-token to cf-api
      │                               Guarded by INTERNAL_SECRET header
      │                               Returns PASETO v3.local token
      ↓
  merchantApi.getProducts(token)    ← GET /api/products (cf-api, authenticated)
      ↓
  Response: MerchantProduct[]
```

This dual-auth bridge is the deliberate seam between the web session world (better-auth, PostgreSQL, httpOnly cookies) and the API world (PASETO, stateless, Bearer tokens). The web app is the only service allowed to cross this boundary.

---

## Service Dependency Graph

```
apps/worker
  ├── → cf-api            (routes: /api/**, /auth/**)
  └── → cf-commerce       (routes: /checkout/**, /payment/**)

apps/web
  ├── → cf-api            (POST /internal/issue-token, authenticated API calls)
  └── → PostgreSQL        (better-auth sessions via Drizzle)

apps/cf-api
  ├── → cf-commerce       (POST /checkout/calculate — pricing)
  ├── → cf-commerce       (POST /payment/initiate — payment)
  ├── → cf-commerce       (POST /events — event publishing)
  ├── → Firebase RTDB     (all business data)
  ├── → Memcached         (rate limiting)
  ├── → Stripe            (merchant billing subscriptions)
  └── → GCP Secret Manager (prod secrets at cold start)

apps/cf-commerce
  ├── → Firebase RTDB     (event log, product read model)
  └── → Omise             (payment gateway, prod only)

packages/*
  └── consumed by cf-api, cf-commerce, web (no external calls)
```

There are no circular dependencies. cf-commerce never calls cf-api (the `payment-result` callback is the one exception — cf-commerce calls back to `/internal/payment-result` on cf-api after payment completes).

---

## Data Architecture

### Firebase Realtime Database — Path Design

RTDB is a giant JSON tree. Your path structure *is* your index. There are no secondary indexes, no ad-hoc queries, no JOINs. Design paths for your access patterns, not your domain model.

```
/
├── event_log/
│   └── {eventId}/                  ← Append-only event journal
│       ├── _type: "ProductCreated"
│       ├── _version: 1
│       ├── eventId: "evt_..."
│       ├── occurredAt: ISO-8601
│       └── payload: { ... }
│
├── processed_events/
│   └── {eventId}: true             ← Idempotency guard
│
├── products_current/
│   └── {productId}/                ← Materialized read model
│       ├── id, name, price, ...
│       └── (denormalized — contains everything needed for listing)
│
├── users/
│   └── {userId}/
│       ├── email, displayName, role
│       ├── passwordHash (bcrypt)
│       └── createdAt
│
├── carts/
│   └── {cartId}/
│       └── items/
│           └── {itemId}: { productId, quantity, price }
│
├── orders/
│   └── {orderId}/
│       ├── userId, cartId
│       ├── status: "pending" | "confirmed" | ...
│       ├── paymentMethod: "card" | "promptpay"
│       ├── items: [{ productId, quantity, priceAtOrder }]
│       └── shippingAddress: { ... }
│
├── vouchers/
│   └── {code}/
│       ├── discountType: "fixed" | "percentage"
│       ├── value, minOrderValue
│       ├── expiresAt, usageLimit, usageCount
│       └── isActive
│
├── merchants/
│   └── {userId}/
│       ├── storeSlug, storeName
│       ├── stripeCustomerId, stripeSubscriptionId
│       └── planId: "free" | "starter" | "professional" | "enterprise"
│
├── payouts/
│   └── {payoutId}/
│       ├── merchantId, amountCents, currency
│       └── status: "pending" | "processing" | "completed"
│
├── activity_log/
│   └── {timestamp}/                ← Audit trail (denormalized by time)
│       ├── eventType, userId, ipAddress, userAgent
│       └── eventData: { ... }
│
└── lockout/
    └── {email}/
        ├── failedAttempts, lockedUntil
        └── lastAttemptAt
```

### PostgreSQL Schema (apps/web — better-auth only)

```sql
-- better-auth manages these tables
"user" (
  id          TEXT PRIMARY KEY,
  email       TEXT UNIQUE,
  name        TEXT,
  role        TEXT DEFAULT 'customer',   -- "customer" | "store_owner" | "admin"
  createdAt   TIMESTAMP,
  updatedAt   TIMESTAMP
)

"session" (
  id          TEXT PRIMARY KEY,
  userId      TEXT REFERENCES "user"(id),
  token       TEXT UNIQUE,
  expiresAt   TIMESTAMP,
  ...
)

"account" (
  id          TEXT PRIMARY KEY,
  userId      TEXT REFERENCES "user"(id),
  provider    TEXT,                       -- "google" | "facebook"
  ...
)
```

**Why two databases?** PostgreSQL for sessions because better-auth needs referential integrity between session → user. RTDB for business data because Firebase's real-time fan-out is essential for SSE product updates. These concerns don't intersect — the dual-database boundary is the web app itself.

---

## Cold Start Architecture (cf-api)

Firebase Functions v2 cold starts are the tax you pay for serverless. Fabric's cold start sequence is:

```typescript
// 1. Load secrets (GCP Secret Manager in prod, env vars in dev)
const secrets = await loadSecrets(requiredSecretNames)

// 2. Build typed config
const config = loadConfig(secrets)

// 3. Initialize infrastructure singletons (happen once, reused across requests)
const firebase = createFirebaseFromEnv()
const memcached = new MemcachedAdapter({ servers: config.memcachedServers })

// 4. Wire repositories (depend on firebase.db)
const productRepo = new FirebaseProductRepository(firebase.db)
const orderRepo   = new FirebaseOrderRepository(firebase.db)
// ... 8 more repositories

// 5. Wire adapters (depend on config)
const eventPublisher = new HttpEventPublisherAdapter(config.eventsServiceUrl)
const pricing        = new HttpPricingAdapter(config.pricingServiceUrl)
const payment        = new HttpPaymentAdapter(config.paymentServiceUrl)
const stripeAdapter  = new StripeBillingAdapter(config.stripeSecretKey)

// 6. Wire services (depend on repositories + adapters)
const productService = new ProductService(productRepo, eventPublisher, activityRepo)
const orderService   = new OrderService(orderRepo, cartRepo, payment, productRepo, pricing, ...)
// ... etc

// 7. Build Hono app and register all routes
const app = new Hono()
app.use("*", cors(), requestLogger(), attachRequestSignal(), csrf(), securityHeaders())
registerAuthRoutes(app, authService, verifier, memcached)
registerProductRoutes(app, productService, verifier)
// ... etc

// 8. Export Firebase Function handler
export const cfApi = onRequest({ ... }, (req, res) => app.fetch(req, res))

// 9. Register graceful shutdown
registerCleanup("firebase", () => deleteApp(firebase.app))
registerCleanup("memcached", () => memcached.end())
setupGracefulShutdown()
```

The pattern here is pure dependency injection without a DI framework. Every dependency is explicit, traceable from the root, and mockable in tests by replacing the constructor argument. There are no singletons accessed via globals, no ambient contexts, no magic.

---

## Cross-Cutting Concerns

### Security Layer (Defense in Depth)

Security is not a single checkpoint — it is layers, each assuming the previous layer was bypassed.

```
Internet
  ↓
[Cloudflare Worker]
  ├── Security headers (X-Frame-Options, HSTS, CSP, Referrer-Policy)
  ├── x-forwarded-for, x-cf-country forwarded for downstream rate limiting
  └── 503 on upstream failure (no raw error leakage)
  ↓
[cf-api middleware stack — order matters]
  ├── CORS (allow/reject by origin before request body is parsed)
  ├── requestLogger (4 golden signals, structured JSON to Cloud Logging)
  ├── attachRequestSignal (AbortSignal for cancellation propagation)
  ├── csrf (double-submit cookie; rejects cross-origin mutations)
  ├── Security headers (defense-in-depth re-assertion at the function level)
  └── Route handlers
        ├── throttle(memcached, {limit, windowMs})  ← sliding-window rate limit
        ├── requireAuth(verifier)                    ← PASETO v3.local verification
        ├── requireRole("store_owner")               ← role enforcement
        └── handler logic
```

Each layer is independently testable. The CSRF middleware doesn't know about rate limiting. The rate limiter doesn't know about auth. The auth middleware doesn't know about business logic.

### Observability

**4 Golden Signals** (Google SRE):
1. **Latency** — `requestLogger` records `durationMs` per request
2. **Traffic** — Request count per endpoint, structured to Cloud Logging
3. **Errors** — 4xx/5xx logged with stack trace, `severity: ERROR`
4. **Saturation** — GCP function memory/CPU metrics via Cloud Monitoring

**Activity Audit Trail** — Every mutating action records:
```typescript
{
  eventType: "user_login_failed" | "product_created" | "order_placed" | ...,
  userId: string | null,
  ipAddress: string,
  userAgent: string,
  eventData: Record<string, unknown>,
  timestamp: ISO-8601
}
```

Stored at `activity_log/{timestamp}` in RTDB. Queryable by time range. Not your SIEM, but enough for incident response and compliance.

### Idempotency

The events subsystem in cf-commerce receives events via HTTP POST. Network is unreliable; retries are expected; duplicate processing is catastrophic for inventory and payment.

Guard pattern:
```typescript
// Interpreter checks before executing
const seen = await db.ref(`processed_events/${event.eventId}`).get()
if (seen.exists()) return  // Skip duplicate

await executeProgram(event)

// Mark as processed (atomic with the operation where possible)
await db.ref(`processed_events/${event.eventId}`).set(true)
```

The `eventId` is a UUID assigned at event creation. Identical operations on the same `eventId` are safe to replay.

---

## Failure Modes

### cf-api → cf-commerce (pricing call) fails

`HttpPricingAdapter.validateCheckout()` returns `Either.left(PricingError)` on HTTP failure. `OrderService` propagates the error up. The client receives `400 { error: "pricing_service_unavailable" }`. No order is created.

### cf-api → cf-commerce (event publish) fails

Event publishing is **fire-and-forget**. The call is not awaited in the critical path. If it fails, the order is still created. The read model (`products_current`) will lag until the next successful publish, which is acceptable — eventual consistency.

The missing event creates a consistency gap. This is a known limitation. Production hardening would add an outbox pattern (write event to RTDB alongside the order, a background job picks it up). Not implemented.

### cf-commerce → cf-api (payment result callback) fails

After charging a card, `interpretPaymentCommands` POSTs to `/internal/payment-result`. This has **one retry** on failure. If both attempts fail, the order remains in `"pending"` status and the payment is recorded in Omise but not in RTDB.

Resolution: manual reconciliation via Omise dashboard + direct RTDB write. Webhook-based reconciliation is the production-grade fix.

### Firebase RTDB unavailable

RTDB is a Google-managed service with 99.95% SLA. Cold hard reality: if RTDB is down, cf-api and cf-commerce are down. No fallback. The architecture trades operational complexity (no caching layer, no replica) for simplicity. At the scale this system targets (<100k MAU), this is the correct tradeoff.

---

## Architecture Decision Records (ADRs)

### ADR-001: Two Cloud Functions, Not Microservices

**Decision**: Merge Events + Pricing + Payment into a single cf-commerce Cloud Function instead of three separate services.

**Context**: True microservices require service meshes, distributed tracing, contract testing, and independent deployment pipelines. For a team of 2-5 engineers, this overhead exceeds the benefit. The three subsystems have zero shared mutable state and communicate via pure HTTP within the same function.

**Consequence**: You cannot scale pricing independently of events. In practice, pricing is stateless and instantaneous; it does not need independent scaling. If this changes, the split is a refactor, not a rewrite — the subsystems are already isolated within the codebase.

### ADR-002: Firebase RTDB as the Primary Store

**Decision**: Firebase Realtime Database for all business data, not PostgreSQL or a document store.

**Context**: The system needs real-time push (SSE product updates), sub-100ms reads for the product catalog, and geo-redundancy without operational overhead.

**Consequence**: No ad-hoc queries. No aggregations at the database level. All business queries must be designed into path structure upfront. Reporting and analytics run against a separate read model or an export to BigQuery.

### ADR-003: PASETO v3.local Over JWT

**Decision**: Use PASETO v3.local symmetric tokens instead of RS256 JWT.

**Context**: JWT's algorithm agility is a documented attack vector (alg:none, RS256/HS256 confusion). PASETO has exactly one algorithm per version/purpose combination — no choices to get wrong. v3.local uses AES-256-CTR + HMAC-SHA384, which is FIPS-compliant.

**Consequence**: PASETO tokens are not verifiable by third-party services that expect JWT. All verification happens inside cf-api via `PasetoVerifierService`. This is acceptable — we control all API consumers.

### ADR-004: Free Monad for the Events DSL

**Decision**: Represent event-handling programs as a Free Monad DSL (`EventOp<A>`) rather than direct Firebase calls.

**Context**: Testability. If programs are pure descriptions of what *should* happen, you can test them without Firebase, without network, without any infrastructure. The Firebase interpreter is swapped for an in-memory interpreter in tests. The program is identical in both environments.

**Consequence**: Additional complexity. New contributors need to understand Free Monads before touching the events subsystem. The tradeoff is paid once (learning curve) and recovered continuously (fast, deterministic tests with no mocking). This is worth it.

### ADR-005: Stateless Pricing

**Decision**: The pricing service receives all necessary data in the request payload. It makes no database calls.

**Context**: Pricing logic is a pure function: `(cart, stock, voucher, address) → Either<PricingError, Price>`. Pulling stock data from the database inside pricing would introduce a network call on the critical path, require a database dependency in cf-commerce/pricing, and make tests require a database fixture. None of these are acceptable.

**Consequence**: cf-api must fetch stock quantities and pass them to pricing. If the stock data in cf-api's read model is stale by milliseconds, there is a small window where pricing could approve a purchase for out-of-stock inventory. The inventory reservation step (`POST /inventory/reserve`) performs the authoritative check.
