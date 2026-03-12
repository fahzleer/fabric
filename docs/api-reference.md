# API Reference

All HTTP endpoints across cf-api and cf-commerce. All requests use JSON unless noted.

**Base URLs:**
- cf-api (dev): `http://localhost:3010`
- cf-commerce (dev): `http://localhost:8082`
- Production (both): routed via Cloudflare Worker

**Auth:**
Protected routes require `Authorization: Bearer <PASETO_token>`. Obtain tokens via `POST /auth/login` or `POST /internal/issue-token`.

**CSRF:**
Mutating requests from a browser (not Bearer-auth) require an `x-csrf-token` header matching the `csrf_token` cookie. Server Actions in apps/web handle this automatically.

---

## Auth — `/auth/**`

### POST /auth/register
Register a new customer account.

**Body:**
```json
{
  "email": "user@example.com",
  "password": "min8chars",
  "displayName": "Jane Doe"
}
```

**Response 201:**
```json
{
  "userId": "usr_...",
  "email": "user@example.com",
  "role": "customer",
  "accessToken": "v3.local...",
  "refreshToken": "v3.local..."
}
```

**Errors:** `400 InvalidEmailError`, `409 EmailAlreadyExistsError`, `429 RateLimitError`

---

### POST /auth/register/store
Register a new store owner account. Same as `/auth/register` but forces `role = "store_owner"`.

**Body:** Same as `/auth/register`
**Response:** Same as `/auth/register` with `"role": "store_owner"`

---

### POST /auth/login
Email + password login.

**Body:**
```json
{ "email": "user@example.com", "password": "yourpassword" }
```

**Response 200:**
```json
{
  "accessToken": "v3.local...",
  "refreshToken": "v3.local...",
  "user": { "id": "usr_...", "email": "...", "role": "customer" }
}
```

**Errors:** `401 InvalidCredentialsError` (wrong password or account locked), `429 RateLimitError` (10 req/min)

**Lockout:** 5 failed attempts → account locked for 15 minutes (progressive backoff).

---

### POST /auth/login/google
Google OAuth token exchange.

**Body:**
```json
{ "idToken": "<Google ID token from frontend>" }
```

**Response 200:** Same shape as `/auth/login`

---

### POST /auth/login/facebook
Facebook OAuth token exchange.

**Body:**
```json
{ "accessToken": "<Facebook access token from frontend>" }
```

**Response 200:** Same shape as `/auth/login`

---

### POST /auth/refresh
Rotate access + refresh token pair using a valid refresh token.

**Body:**
```json
{ "refreshToken": "v3.local..." }
```

**Response 200:**
```json
{ "accessToken": "v3.local...", "refreshToken": "v3.local..." }
```

**Errors:** `401 TokenExpiredError`, `401 InvalidTokenError` (family revocation — all tokens in family are invalidated on reuse detection)

---

### POST /auth/logout
Revoke the current refresh token.

**Headers:** `Authorization: Bearer <accessToken>`
**Body:** `{ "refreshToken": "v3.local..." }`
**Response:** `204 No Content`

---

## Token — `/token/**`

### POST /token/verify
Verify an access token and return its payload.

**Headers:** `Authorization: Bearer <accessToken>`
**Response 200:**
```json
{
  "userId": "usr_...",
  "email": "user@example.com",
  "role": "customer",
  "exp": 1234567890
}
```

---

## Products — `/api/products`

### GET /api/products
List active products (paginated). Public — no auth required.

**Query params:**
- `page` (default: 1)
- `perPage` (default: 20, max: 100)
- `ownerId` — filter by merchant
- `category` — filter by category slug
- `status` — filter by status (default: `active`)

**Response 200:**
```json
{
  "items": [
    {
      "id": { "value": "prod_..." },
      "name": { "value": "Product Name" },
      "price": { "amount": 299.00, "currency": "THB" },
      "category": "clothing",
      "status": "active",
      "stock": { "S": 10, "M": 5, "L": 0 },
      "images": [{ "url": "https://...", "altText": "...", "isPrimary": true, "order": 0 }],
      "ownerId": "usr_...",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 150,
  "page": 1,
  "perPage": 20
}
```

---

### GET /api/products/:id
Get a single product. Public for active products; auth + ownership required for draft/archived.

**Response 200:** Single product object (same shape as items array above)
**Errors:** `404 ProductNotFoundError`

---

### POST /api/products
Create a product. Requires auth + `store_owner` or `admin` role. Plan limits enforced.

**Headers:** `Authorization: Bearer <token>`
**Body:**
```json
{
  "name": "My Product",
  "description": "Optional description",
  "price": 299.00,
  "priceCurrency": "THB",
  "category": "clothing",
  "stock": { "S": 10, "M": 5, "L": 0 },
  "images": [{ "url": "https://...", "alt": "...", "isPrimary": true, "order": 0 }]
}
```

**Note:** `price` is in display units (THB), NOT cents. ฿299 = `price: 299`.

**Response 201:** Created product object
**Errors:** `402 PlanCapacityError` (free plan 5 products, starter plan 50 products), `403 Forbidden`

---

### PUT /api/products/:id
Update a product. Requires auth + ownership (`ownerId` must match `userId`).

**Headers:** `Authorization: Bearer <token>`
**Body:** Partial product object (any subset of POST body fields)
**Response 200:** Updated product object
**Errors:** `404 ProductNotFoundError`, `403 Forbidden`

---

### DELETE /api/products/:id
Archive a product (soft delete — sets `status: "archived"`). Requires ownership.

**Headers:** `Authorization: Bearer <token>`
**Response:** `204 No Content`

---

## Cart — `/api/carts`

### GET /api/carts/:cartId
Get cart by ID. Auth required; only the cart owner can access.

**Response 200:**
```json
{
  "id": "cart_...",
  "userId": "usr_...",
  "items": [
    {
      "productId": "prod_...",
      "productName": "T-Shirt",
      "size": "M",
      "quantity": 2,
      "unitPrice": { "amount": 299.00, "currency": "THB" }
    }
  ],
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

---

### POST /api/carts/:cartId/items
Add an item to the cart.

**Body:**
```json
{
  "productId": "prod_...",
  "size": "M",
  "quantity": 1
}
```

**Response 200:** Updated cart

---

### PUT /api/carts/:cartId/items/:itemId
Update item quantity in cart.

**Body:** `{ "quantity": 3 }`
**Response 200:** Updated cart

---

### DELETE /api/carts/:cartId/items/:itemId
Remove an item from the cart.

**Response 200:** Updated cart

---

## Orders — `/api/orders`

### POST /api/orders
Place an order (checkout). Auth required.

**Body:**
```json
{
  "cartId": "local",
  "shippingAddress": {
    "street": "123 Main St",
    "city": "Bangkok",
    "province": "Bangkok",
    "country": "TH",
    "postalCode": "10100",
    "recipientName": "Jane Doe",
    "phone": "0812345678"
  },
  "paymentToken": "<Omise card token from Omise.js>",
  "paymentMethod": "card",
  "voucherCode": "SAVE10"
}
```

**`cartId`:** Use `"local"` for the Dexie-backed web cart (resolved by `userId`). Use a real cart ID otherwise.

**`paymentMethod`:** `"card"` | `"promptpay"` | `"crypto"`

**Response 201:** Order object with `status: "pending"` (card) or `status: "confirmed"` (crypto)

**Errors:** `400 EmptyOrderError`, `400 PriceChangedError` (cart price stale), `422 InsufficientStockError`

---

### GET /api/orders
Get the authenticated user's orders (paginated).

**Query:** `page`, `perPage`
**Response 200:** `{ "orders": Order[], "total": number }`

---

### GET /api/orders/:orderId
Get a specific order. Auth required; only the order owner can access.

**Response 200:** Order object
**Errors:** `404 OrderNotFoundError`, `403 Forbidden`

---

## Store — `/store/**`

### GET /store/:slug
Get public store profile by slug.

**Response 200:**
```json
{
  "userId": "usr_...",
  "storeName": "My Shop",
  "storeSlug": "my-shop",
  "productCount": 12
}
```

**Errors:** `404` if slug not found

---

### GET /store/:slug/products
Get all active products for a store (paginated).

**Query:** `page`, `perPage`
**Response 200:** Same as `GET /api/products` but filtered to this store

---

## Merchant Billing — `/merchant/**`

All merchant routes require `Authorization: Bearer <token>` with `role = "store_owner"`.

### POST /merchant/onboard
Create merchant profile. Idempotent — returns existing profile if already onboarded.

**Body:**
```json
{ "storeName": "My Shop" }
```

**Response 201:**
```json
{
  "userId": "usr_...",
  "storeName": "My Shop",
  "storeSlug": "my-shop",
  "plan": "free",
  "planStatus": "active"
}
```

---

### GET /merchant/billing/status
Get the merchant's current billing status and plan limits.

**Response 200:**
```json
{
  "plan": "starter",
  "planStatus": "active",
  "limits": { "maxProducts": 50, "maxOrdersPerMonth": 500 },
  "productCount": 12,
  "productCapacityUsed": 24,
  "planExpiresAt": null,
  "hasStripeAccount": true,
  "storeSlug": "my-shop",
  "storeName": "My Shop",
  "onboarded": true
}
```

**Errors:** `404 MerchantNotFoundError` (not yet onboarded)

---

### POST /merchant/billing/subscribe
Subscribe to a paid plan via Stripe.

**Body:** `{ "planId": "starter" | "professional" | "enterprise" }`

**Response 200:**
```json
{ "plan": "starter", "planStatus": "active" }
```

**Errors:** `400 BillingNotConfiguredError` (Stripe keys missing), `402 AlreadySubscribedError`

---

### POST /merchant/billing/cancel
Cancel the current Stripe subscription (at period end).

**Response 200:** `{ "planStatus": "cancelled" }`

---

### GET /merchant/billing/portal
Get a Stripe Customer Portal URL for the merchant to manage their billing.

**Response 200:** `{ "url": "https://billing.stripe.com/session/..." }`

---

### GET /merchant/analytics/summary
Get merchant analytics counters.

**Response 200:**
```json
{
  "completedOrderCount": 47,
  "totalRevenueCents": 1234500,
  "productCount": 12,
  "plan": "starter",
  "planStatus": "active"
}
```

---

## Payouts — `/merchant/payouts`

### GET /merchant/payouts/balance
Get available payout balance.

**Response 200:**
```json
{
  "totalRevenueCents": 1234500,
  "paidOutCents": 500000,
  "platformFeePct": 0.03,
  "availableBalanceCents": 697265
}
```

**Formula:** `availableBalance = totalRevenue × (1 - platformFeePct) - paidOut`

---

### GET /merchant/payouts
List payout request history (newest first).

**Response 200:** `{ "payouts": PayoutRequest[] }`

---

### POST /merchant/payouts/request
Request a payout.

**Body:**
```json
{
  "amountCents": 50000,
  "bankInfo": "Kasikorn Bank, account 1234567890"
}
```

**Minimum:** ฿100 (10,000 cents)
**Response 201:** `PayoutRequest` object
**Errors:** `422 InsufficientBalanceError`

---

## Admin Payouts — `/admin/payouts`

Requires `role = "admin"`.

### GET /admin/payouts
List all pending payout requests across all merchants.

---

### PATCH /admin/payouts/:requestId/approve
Approve a payout request. Atomically increments `paidOutCents`.

**Body:** `{ "ownerUserId": "usr_..." }`
**Response 200:** `{ "message": "Payout approved" }`

---

### PATCH /admin/payouts/:requestId/reject
Reject a payout request with a reason.

**Body:** `{ "ownerUserId": "usr_...", "reason": "Incorrect bank details" }`
**Response 200:** `{ "message": "Payout rejected" }`

---

## Internal — `/internal/**`

Internal routes are server-to-server only. All require `x-internal-secret: <INTERNAL_SECRET>` header. Never exposed directly to browser clients.

### POST /internal/issue-token
Issue a PASETO access token for a given user. Used by apps/web Server Actions to bridge better-auth sessions to cf-api calls.

**Body:**
```json
{ "userId": "usr_...", "email": "user@example.com", "role": "store_owner" }
```

**Response 200:** `{ "accessToken": "v3.local...", "expiresIn": 3600 }`

---

### POST /internal/payment-result
Called by cf-commerce after a payment charge completes. Updates order status.

**Body:**
```json
{
  "orderId": "order_...",
  "success": true,
  "paymentId": "chrg_..."
}
```

**Response 200:** `{ "message": "Order confirmed" }` or `{ "message": "Order failed" }`

---

## PromptPay — `/payment/promptpay/**` (cf-api)

### POST /payment/promptpay/create
Create a PromptPay QR charge. Internal only.

**Headers:** `x-internal-secret: <secret>`
**Body:** `{ "orderId": "...", "amountCents": 50000, "currency": "THB", "userId": "usr_..." }`
**Response 201:** `{ "chargeId": "chrg_...", "qrImageUrl": "https://..." }`

---

## Webhooks — `/webhooks/**`

### POST /webhooks/stripe
Stripe webhook handler. Requires `stripe-signature` header (HMAC-SHA256).

Events handled:
- `customer.subscription.updated` → updates plan + status in RTDB
- `customer.subscription.deleted` → sets `planStatus: "cancelled"`
- `invoice.payment_succeeded` → confirms plan as active
- `invoice.payment_failed` → sets `planStatus: "past_due"`

---

## cf-commerce: Pricing — `/checkout/**`, `/pricing/**`, `/inventory/**`, `/voucher/**`

### POST /checkout/calculate
Full checkout pipeline: validate items → apply voucher → calculate shipping → compute VAT.

**Body:**
```json
{
  "items": [
    { "productId": "prod_...", "productName": "T-Shirt", "priceCents": 29900, "quantity": 2, "size": "M" }
  ],
  "voucher": { "_tag": "Right", "right": { "code": "SAVE10", ... } },
  "shippingAddress": { "country": "TH", "province": "Bangkok" },
  "currency": "THB"
}
```

**Response 200:**
```json
{
  "subtotalCents": 59800,
  "discountCents": 5980,
  "shippingCents": 10000,
  "taxCents": 4466,
  "totalCents": 68286,
  "currency": "THB",
  "lines": [{ "productId": "prod_...", "unitCents": 29900, "quantity": 2 }]
}
```

**Errors:** 13-variant `PricingError` ADT (see `docs/error-codes.md`)

---

### POST /inventory/reserve
Reserve stock for a list of items (atomic check-and-decrement).

**Body:** `{ "items": [{ "productId": "...", "size": "M", "quantity": 2 }] }`
**Response 200:** `{ "reserved": true }` or **422** with `InsufficientStock` error

---

### POST /voucher/apply
Validate and apply a voucher code.

**Body:** `{ "code": "SAVE10", "subtotalCents": 59800 }`
**Response 200:** `{ "discountCents": 5980, "voucher": { ... } }`
**Errors:** `VoucherNotFound`, `VoucherExpired`, `VoucherExhausted`, `OrderBelowMinimum`

---

## cf-commerce: Events — `/events/**`, `/sse/**`, `/products/**`

### POST /events
Ingest a domain event. Called by cf-api fire-and-forget. No auth (secured by network topology — only cf-api → cf-commerce).

**Body:** Domain event object (see `docs/event-catalog.md`)
**Response 200:** `{ "processed": true }`

---

### GET /products
Get current product read model (products_current in RTDB).

**Response 200:** `{ "products": ProductState[] }`

---

### GET /products/:id
Get single product from read model.

**Response 200:** `ProductState` or **404**

---

### GET /sse/:userId
Server-Sent Events stream. Client subscribes to receive real-time notifications.

**Response:** `text/event-stream`
```
event: notification
data: {"message": "Product 'T-Shirt' created"}

event: heartbeat
data: {"timestamp": "2024-01-01T00:00:00Z"}
```

Connections are closed by the server after 2 minutes to work within Firebase Functions timeout. The client should reconnect automatically.

---

## cf-commerce: Payment — `/payment/**`

### POST /payment/initiate
Initiate a card payment. Called by cf-api `OrderService.placeOrder()`. Internal.

**Headers:** `x-internal-secret: <secret>`
**Body:** `{ "orderId": "...", "amountCents": 68286, "currency": "THB", "userId": "...", "token": "<Omise card token>" }`
**Response 200:** `{ "paymentId": "chrg_..." }`

---

### POST /payment/process
Process a payment result (used in test/mock scenarios).

---

### GET /payment/promptpay/:chargeId/status
Poll PromptPay charge status. Debounced (3-second cache).

**Response 200:** `{ "status": "pending" | "successful" | "failed", "chargeId": "chrg_..." }`

---

### POST /payment/omise/webhook
Omise webhook handler. Validates HMAC-SHA256 signature.

Events handled: `charge.complete` → forwards to cf-api `/internal/payment-result`

---

## Health Checks

| Endpoint | Service | Notes |
|----------|---------|-------|
| `GET /api/health` | cf-api | Returns `{ "status": "ok", "timestamp": "..." }` |
| `GET /health` | cf-commerce | Returns `{ "status": "ok" }` |
| `GET /api/health` | apps/web | Next.js route handler — always returns 200 |
