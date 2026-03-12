# cf-api — Main API Service

**Runtime**: Firebase Functions v2 (Hono 4.7.0 on Bun 1.2.22)
**Port (dev)**: 3010
**Memory**: 512MiB
**Timeout**: 60 seconds
**Min instances**: 1 (always warm)
**Concurrency**: 80 requests per instance
**Region**: `asia-east1` (configurable via `CLOUD_FUNCTION_REGIONS`)

---

## Responsibility

cf-api owns the **transactional write path** and **authentication boundary** for the entire system. Every operation that changes persistent state — user registration, order placement, product mutations, billing events — flows through here. cf-commerce handles separate concerns (event processing, pricing, payment); cf-api orchestrates them.

---

## Middleware Stack

Order matters. Middleware runs top-to-bottom on every request before reaching a route handler. The sequence is not arbitrary.

```
Incoming Request
      ↓
┌─────────────────────────────────┐
│ 1. cors()                       │  ← Reject cross-origin before parsing body
│    origin: config.corsOrigin    │
├─────────────────────────────────┤
│ 2. requestLogger()              │  ← 4 Golden Signals: latency, traffic,
│    structured JSON to Cloud Log │    errors, saturation. Must run early
│                                 │    to capture the full request lifecycle.
├─────────────────────────────────┤
│ 3. attachRequestSignal()        │  ← Attach AbortSignal to Hono context.
│    c.var.signal: AbortSignal    │    Enables async cancellation when the
│                                 │    client drops the connection.
├─────────────────────────────────┤
│ 4. csrf()                       │  ← Double-submit cookie pattern. Rejects
│    double-submit cookie pattern │    cross-origin POST/PUT/PATCH/DELETE.
│                                 │    GET /api/health is exempt.
├─────────────────────────────────┤
│ 5. Security headers             │  ← Defense-in-depth. Cloudflare Worker
│    X-Content-Type-Options       │    already sets some of these; we re-assert
│    X-Frame-Options: DENY        │    at the function boundary.
│    X-XSS-Protection             │
│    Referrer-Policy              │
│    Permissions-Policy           │
│    Strict-Transport-Security    │    max-age=63072000 (2 years)
│    Content-Security-Policy      │
├─────────────────────────────────┤
│ 6. Route handlers               │  ← Per-route middleware (auth, rate limit)
│    throttle(memcached, opts)    │    applied inside route registration.
│    requireAuth(verifier)        │
│    requireRole(...roles)        │
└─────────────────────────────────┘
```

### Per-Route Middleware

`throttle`, `requireAuth`, and `requireRole` are applied at route registration time, not globally. This is intentional: different endpoints have different security requirements.

```typescript
// Login: rate-limited, no auth required
app.post("/auth/login",
  throttle(memcached, { limit: 10, windowMs: 60_000 }),
  loginHandler(authService)
)

// Product creation: auth + role required
app.post("/api/products",
  requireAuth(verifier),       // sets c.var.userId, userRole, userEmail
  requireRole("store_owner"),  // rejects if role !== "store_owner"
  createProductHandler(productService)
)

// Internal webhook: secret header required
app.post("/internal/payment-result",
  requireInternalSecret(config.internalSecret),
  paymentResultHandler(orderService)
)
```

---

## Route Surface

### Auth Routes

```
POST /auth/register      — New account (5 req/min per IP)
POST /auth/login         — Email/password login (10 req/min per IP)
POST /auth/logout        — Invalidate token (auth required)
POST /auth/refresh       — Exchange refresh token for access token
POST /auth/facebook      — Facebook OAuth token exchange
POST /auth/google        — Google OAuth token exchange
```

Token lifecycle: `login` → `{ accessToken, refreshToken }`. Access token expires in 15 minutes. Refresh token expires in 30 days. `refresh` exchanges a valid refresh token for a new access token without re-authenticating. Brute-force lockout triggers after 5 failed login attempts (stored in `/lockout/{email}` in RTDB).

### Product Routes

```
GET    /api/products           — List active products (paginated, filterable)
GET    /api/products/:id       — Product detail (public)
POST   /api/products           — Create product (store_owner)
PATCH  /api/products/:id       — Update product (store_owner, owns product)
```

`GET /api/products` accepts query params: `page`, `perPage`, `category`, `minPrice`, `maxPrice`, `sort` (price_asc|price_desc|name_asc|name_desc|created_desc). Returns `PaginatedProductsDto`.

Product mutations publish `ProductCreated` / `ProductUpdated` events to cf-commerce/events via `HttpEventPublisherAdapter` (fire-and-forget).

### Cart Routes

```
POST   /api/cart               — Add item to cart
GET    /api/cart/:cartId        — Get cart contents
DELETE /api/cart/:cartId/:itemId — Remove item
```

Cart is anonymous by default; `cartId` is a client-generated UUID stored in a cookie. Cart is associated with a user on checkout. Items store `priceAtAdd` to prevent price changes from affecting in-flight carts.

### Order Routes

```
POST   /api/orders/preview     — Dry-run checkout (no payment, no write)
POST   /api/orders             — Place order (auth required)
GET    /api/orders             — List user orders (auth required)
GET    /api/orders/:id         — Order detail (auth required, own orders only)
```

`POST /api/orders` is the most complex operation in the system. See [architecture.md — Request Lifecycle](../architecture.md#request-lifecycle).

### Billing Routes (Stripe — Merchant Subscriptions)

```
POST   /billing/subscribe      — Subscribe to a plan (store_owner)
GET    /billing/status         — Current plan + limits (store_owner)
POST   /billing/portal         — Stripe customer portal session URL
```

Billing is Stripe-only. Merchant subscriptions (`starter`/`professional`/`enterprise`) gate feature access (product count limits, analytics, payout eligibility). Stripe price IDs are loaded from config at cold start.

**Critical distinction**: Stripe handles *merchant billing subscriptions*. Omise handles *customer order payments*. These are completely separate flows with zero overlap in code or data.

### Payment (PromptPay QR)

```
POST   /payment/promptpay/qr   — Generate PromptPay QR code image
```

QR generation only — cf-api produces the QR payload. Actual PromptPay payment confirmation is handled by cf-commerce/payment via the Omise webhook.

### Payout Routes

```
POST   /payout/request         — Request payout (store_owner)
GET    /payout/balance         — Pending balance (store_owner)
GET    /payout/history         — Payout records (store_owner)
```

### Store Routes (Public)

```
GET    /store/:storeSlug       — Public store profile
GET    /store/:storeSlug/products — Store's product listing
```

Read-only. No auth required. Returns data scoped to a single merchant's store.

### Internal Routes (Service-to-Service)

```
POST   /internal/issue-token   — Issue PASETO token for web → API bridge
POST   /internal/payment-result — Payment callback from cf-commerce
```

Protected by `x-internal-secret` header. `INTERNAL_SECRET` must match. These routes are not accessible from the public internet — Cloudflare Worker does not proxy `/internal/**`.

### Health

```
GET    /api/health             — Returns 200 { status: "ok" }
```

CSRF-exempt. Used by Firebase Functions health checks and load balancer probes.

---

## Dependency Injection Wiring

The entire service graph is constructed at module initialization time (once per cold start):

```typescript
// infrastructure
const firebase    = createFirebaseFromEnv()
const memcached   = new MemcachedAdapter({ servers: config.memcachedServers })

// repositories (Firebase RTDB)
const productRepo  = new FirebaseProductRepository(firebase.db)
const orderRepo    = new FirebaseOrderRepository(firebase.db)
const cartRepo     = new FirebaseCartRepository(firebase.db)
const voucherRepo  = new FirebaseVoucherRepository(firebase.db)
const userAdapter  = new FirebaseUserAdapter(firebase.db)
const tokenRepo    = new FirebaseTokenRepository(firebase.db)
const activityRepo = new FirebaseActivityRepository(firebase.db)
const lockoutStore = new FirebaseLockoutAdapter(firebase.db)
const merchantRepo = new FirebaseMerchantRepository(firebase.db)
const payoutRepo   = new FirebasePayoutRepository(firebase.db)

// adapters (HTTP)
const eventPublisher = new HttpEventPublisherAdapter(config.eventsServiceUrl)
const pricing        = new HttpPricingAdapter(config.pricingServiceUrl)
const payment        = new HttpPaymentAdapter(config.paymentServiceUrl)
const stripeAdapter  = new StripeBillingAdapter(config.stripeSecretKey)
const verifier       = new PasetoVerifierService()

// services (orchestration layer)
const authService    = new AuthService(userAdapter, tokenRepo, lockoutStore, activityRepo, config)
const productService = new ProductService(productRepo, eventPublisher, activityRepo)
const cartService    = new CartService(cartRepo, productRepo, activityRepo)
const orderService   = new OrderService(
  orderRepo, cartRepo, payment, productRepo, pricing, voucherRepo, eventPublisher, activityRepo, merchantRepo
)
const billingService = new BillingService(stripeAdapter, stripeAdapter, merchantRepo, config)
const payoutService  = new PayoutService(payoutRepo)
```

No singleton accessors. No global state. Every dependency is passed explicitly. Swapping an implementation for a test double requires changing one constructor argument.

---

## Services

### AuthService

Handles registration, login, logout, token refresh, and OAuth flows.

**Login flow**:
1. Validate `LoginInput` (arktype)
2. Check `lockoutStore.isLocked(email)` → 423 if locked
3. `userAdapter.findByEmail(email)` → 401 if not found
4. `bcrypt.compare(password, user.passwordHash)` → record failure + 401 if wrong
5. On success: clear lockout, generate PASETO access + refresh tokens
6. `tokenRepo.storeRefreshToken(refreshToken, userId, expiresAt)`
7. `activityRepo.track({ eventType: "user_login_success", ... })`
8. Return `{ accessToken, refreshToken, user }`

**Brute-force protection**: 5 failed attempts → write lockout record with `lockedUntil = now + 15min`. The `throttle` middleware (rate limiter) is a separate, coarser defense — 10 req/min regardless of success.

### ProductService

```typescript
class ProductService {
  constructor(
    private repo: ProductRepositoryPort,
    private events: EventPublisherPort,
    private activity: ActivityRepositoryPort
  ) {}

  async create(input: CreateProductInput, actorId: UserId): Promise<Result<Product, ServiceError>>
  async update(id: ProductId, input: UpdateProductInput, actorId: UserId): Promise<Result<Product, ServiceError>>
  async listActive(pagination: PaginationInput, filter: ProductFilterInput): Promise<Result<PaginatedProducts, ServiceError>>
  async findById(id: ProductId): Promise<Result<Product, ServiceError>>
}
```

Every mutation publishes an event and records audit activity. Event publishing is non-blocking (fire-and-forget).

### OrderService

The most complex service. Orchestrates pricing, payment, inventory, and events:

```typescript
async placeOrder(input: PlaceOrderInput, userId: UserId): Promise<Result<Order, OrderError>> {
  // 1. Validate cart exists and belongs to user
  // 2. Call pricing.validateCheckout() — Either<PricingError, CheckoutResult>
  //    If Left: map to OrderError and return early
  // 3. Call payment.initiate(order) — Either<PaymentError, PaymentInitiated>
  //    If Left: map to OrderError and return early
  // 4. Write order to RTDB with status "pending"
  // 5. Fire-and-forget: publish OrderPlaced event to cf-commerce
  // 6. Return Ok(order)
}
```

### BillingService

Wraps Stripe. Manages merchant subscription lifecycle: create customer → subscribe to plan → upgrade → cancel → portal session. Stores `stripeCustomerId` and `stripeSubscriptionId` in `merchants/{userId}` in RTDB.

---

## Configuration

All configuration is loaded at cold start via `loadConfig()`. In production, sensitive values come from GCP Secret Manager via `loadSecrets()`. In development, they come from environment variables directly.

```typescript
interface CfApiConfig {
  pasetoKey: string              // PASETO v3.local symmetric key
  internalSecret: string         // Shared secret for /internal/* routes
  corsOrigin: string             // "*" | "https://yourdomain.com"
  memcachedServers: string       // "host:11211,host2:11211"
  eventsServiceUrl: string       // http://localhost:8082 (dev)
  commerceServiceUrl: string     // http://localhost:8082 (dev)
  pricingServiceUrl: string      // http://localhost:8082 (dev)
  paymentServiceUrl: string      // http://localhost:8082 (dev)
  googleClientId: string
  stripeSecretKey: string
  stripeWebhookSecret: string
  stripePriceStarter: string     // price_xxxx IDs from Stripe dashboard
  stripePriceProfessional: string
  stripePriceEnterprise: string
  stripePortalReturnUrl: string
}
```

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `PASETO_KEY` | ✅ | PASETO v3.local symmetric key (hex) |
| `INTERNAL_SECRET` | ✅ | Shared secret for /internal/* |
| `FIREBASE_PROJECT_ID` | ✅ | Firebase project ID |
| `FIREBASE_DATABASE_URL` | ✅ | RTDB URL |
| `FIREBASE_STORAGE_BUCKET` | ✅ | GCS bucket name |
| `CORS_ORIGIN` | optional | Default `"*"` |
| `MEMCACHED_SERVERS` | optional | Default `"localhost:11211"` |
| `EVENTS_SERVICE_URL` | optional | Default cf-commerce URL |
| `PRICING_SERVICE_URL` | optional | Default cf-commerce URL |
| `PAYMENT_SERVICE_URL` | optional | Default cf-commerce URL |
| `STRIPE_SECRET_KEY` | optional | Required for billing |
| `STRIPE_WEBHOOK_SECRET` | optional | Required for billing webhooks |
| `STRIPE_PRICE_STARTER` | optional | Stripe price ID |
| `STRIPE_PRICE_PROFESSIONAL` | optional | Stripe price ID |
| `STRIPE_PRICE_ENTERPRISE` | optional | Stripe price ID |
| `STRIPE_PORTAL_RETURN_URL` | optional | URL after portal session |
| `GOOGLE_CLIENT_ID` | optional | Google OAuth |
| `FIREBASE_SERVICE_ACCOUNT` | optional | JSON string (prod, on GCP) |
| `CLOUD_FUNCTION_REGIONS` | optional | Default `"asia-east1"` |

---

## Rate Limiting

Implemented via `throttle(memcached, opts)` middleware using Memcached as the sliding-window counter.

```typescript
// Sliding window: N requests per windowMs
throttle(memcached, { limit: 10, windowMs: 60_000 })

// Key: `rate-limit:{ip}:{path}`
// Memcached operation: increment(key) with TTL=windowMs
// If count > limit: 429 Too Many Requests
```

Applied to:
- `POST /auth/login`: 10/min per IP
- `POST /auth/register`: 5/min per IP
- `POST /auth/facebook`, `/auth/google`: 10/min per IP

Rate limits are per-IP, not per-user. A user behind NAT shares the limit with other users on the same IP. This is the known tradeoff for simplicity — per-user rate limiting requires auth context, which creates a chicken-and-egg problem at the auth endpoints.

---

## PASETO Token Structure

```typescript
// AccessTokenPayload
{
  sub: string      // userId
  email: string
  role: UserRole   // "customer" | "store_owner" | "admin"
  iat: number      // issued at (Unix timestamp)
  exp: number      // expires at (Unix timestamp, iat + 15min)
}

// RefreshTokenPayload
{
  sub: string      // userId
  jti: string      // JWT ID (stored in tokenRepo for revocation)
  iat: number
  exp: number      // iat + 30 days
}
```

`requireAuth(verifier)` decrypts the PASETO token with the symmetric key, validates expiry, and sets `c.var.userId`, `c.var.userRole`, `c.var.userEmail` on the Hono context. Downstream handlers read these from context — they never re-verify the token.

---

## Repository Pattern

All repositories implement a port interface and return `Result<T, RepositoryError>`. The calling service never catches exceptions — if the repository call returns `Err(RepositoryError)`, the service propagates it up as a service-level error.

```typescript
interface ProductRepositoryPort {
  findById(id: ProductId): Promise<Result<Product, RepositoryError>>
  findActiveFiltered(
    pagination: PaginationInput,
    filter: ProductFilterInput
  ): Promise<Result<PaginatedProducts, RepositoryError>>
  create(product: Product): Promise<Result<Product, RepositoryError>>
  update(product: Product): Promise<Result<Product, RepositoryError>>
}

class FirebaseProductRepository implements ProductRepositoryPort {
  constructor(private db: Database) {}

  async findById(id: ProductId): Promise<Result<Product, RepositoryError>> {
    try {
      const snap = await this.db.ref(`products_current/${id.value}`).get()
      if (!snap.exists()) return Err(RepositoryError("not_found"))
      return Ok(parseProduct(snap.val()))
    } catch (err) {
      return Err(RepositoryError("database_error", err))
    }
  }
}
```

The `try/catch` lives inside the repository implementation, not in the service or handler. Errors bubble up as values, not as thrown exceptions.

---

## Testing

Tests use Bun's built-in test runner. Infrastructure is replaced with in-memory implementations at the constructor level.

```typescript
// test/product.service.spec.ts
describe("ProductService", () => {
  const activityRepo = new InMemoryActivityRepository()
  const eventPublisher = new NoopEventPublisher()  // fire-and-forget; discard in tests
  const productRepo = new InMemoryProductRepository()
  const service = new ProductService(productRepo, eventPublisher, activityRepo)

  it("creates product and publishes event", async () => {
    const result = await service.create(validInput, testUserId)
    expect(result._tag).toBe("Ok")
    expect(eventPublisher.published).toHaveLength(1)
    expect(eventPublisher.published[0]._type).toBe("ProductCreated")
  })
})
```

No mocking framework. No `jest.fn()`. No `vi.mock()`. Explicit in-memory implementations that you can inspect directly.
