# Domain Model

This document is the authoritative reference for all domain entities, value objects, business rules, and lifecycle state machines in the Fabric platform. All domain code lives in `packages/types/src/` and `apps/cf-api/src/domain/`.

---

## Foundational Types (`packages/types/src/kernel.ts`)

### Maybe\<T\>
Optional value without `null` or `undefined`.

```typescript
type Maybe<T> = { _tag: "Some"; value: T } | { _tag: "None" }
```

Usage pattern:
```typescript
if (isSome(merchant.stripeCustomerId)) {
  // merchant.stripeCustomerId.value is string
}
```

### Result\<T, E\>
Explicit error handling without exceptions.

```typescript
type Result<T, E> = { _tag: "Ok"; value: T } | { _tag: "Err"; error: E }
```

**Rule:** All service methods and repository methods return `Result<T, E>`. No throws in domain or application layer. HTTP handlers convert errors to status codes.

### BrandedId\<TBrand\>
Nominal string wrapper to prevent accidental ID mixing at compile time.

```typescript
type ProductId = BrandedId<"ProductId">
// ProductId and OrderId are incompatible types even though both hold strings
```

---

## User

**Entity:** `apps/cf-api/src/domain/user/`
**Firebase path:** `users/{userId}`
**PostgreSQL:** `"user"` table (better-auth, apps/web only)

### Value Objects

| Type | Constraints | Source |
|------|------------|--------|
| `UserId` | `BrandedId<"UserId">` | Generated on creation |
| `Email` | Valid email format | Validated at boundary |
| `DisplayName` | 2–50 characters | Validated at boundary |
| `UserRole` | `"customer" \| "admin" \| "store_owner"` | Set server-side only |

### Business Rules

- `passwordHash` is `Maybe<string>` — `None` for OAuth-only accounts (Google, Facebook)
- Attempting password login on an OAuth account returns `InvalidCredentialsError`
- Role is stored in **both** Firebase RTDB (`users/{userId}.role`) and PostgreSQL (`"user".role`)
- When upgrading a user to `store_owner`, update **both** stores. The PASETO token carries the Firebase role; the better-auth session carries the PostgreSQL role
- 5 failed logins → account locked for 15 minutes (progressive backoff via `lockout/{email_base64}`)

---

## Product

**Entity:** `apps/cf-api/src/domain/product/`
**Firebase paths:**
- `product_current/{productId}` — current revision (CQRS read model)
- `product_revisions/{productId}_{rev}` — full revision history

### Value Objects

| Type | Constraints | Notes |
|------|------------|-------|
| `ProductId` | `BrandedId<"ProductId">`, UUID | `crypto.randomUUID()` at creation |
| `ProductName` | 2–120 characters | Validates at boundary |
| `ProductPrice` | `{ amount: number; currency: CurrencyCode }` | `amount` is in display units, NOT cents |
| `ProductSize` | `"XS" \| "S" \| "M" \| "L" \| "XL" \| "XXL" \| "XXXL" \| "ONE_SIZE"` | |
| `ProductStatus` | FSM: `"draft" → "active" → "archived"` | See lifecycle below |
| `ProductCategory` | String slug | No validation — extensible |
| `StockQuantity` | Non-negative integer | Per-size quantity |
| `ProductImage` | `{ url; altText; isPrimary; order }` | First `isPrimary=true` is the product card image |

### Product Price — Critical

`makeProductPriceFromCents(10000, "THB")` returns `{ amount: 100, currency: "THB" }` — **infallible, no error union**.

```typescript
// ✅ Correct
const price = makeProductPriceFromCents(29900, "THB")
// price.amount === 299.00 (display THB, NOT cents)

// ❌ Wrong — this is NOT how price is stored
price.cents  // doesn't exist
```

When creating a product via `POST /api/products`, the `price` field is **in display units** (฿299 = `price: 299`). The schema field name is `price`, **not** `priceInCents`.

### Product Lifecycle FSM

```
     draft
       │ publishProduct()
       ▼
     active  ──────────────────► archived
       │                           │
       └─────── archiveProduct() ──┘
```

- `draft → active`: product is visible in the public catalog
- `active → archived`: soft delete — product disappears from the public API
- `archived → active`: re-activation (via update with `status: "active"`)
- **Immutable constraint**: price and core fields are immutable once `active`. Create a new revision instead.

### Product Immutability

Products use an **append-only event log + versioned revisions** pattern:
- Each mutation creates a new `rev` (incremented integer)
- The event log stores the full mutation history
- `products_current/{productId}` is a materialized view of the latest state, maintained by the cf-commerce event interpreter

---

## Cart

**Entity:** `apps/cf-api/src/domain/cart/`
**Firebase path:** `carts/{userId}/items/{productId}_{size}`
**Client-side:** Dexie IndexedDB (`fabric-cart` database) in apps/web

### Value Objects

| Type | Constraints |
|------|------------|
| `CartId` | `BrandedId<"CartId">` |
| `CartItemQuantity` | Integer, 1–99 |

### Business Rules

- A cart belongs to one user (`userId` is the cart key in RTDB)
- Cart items store a **price snapshot** (`unitPrice`) at the time of adding to cart
- At order placement, prices are re-validated against current product prices
  - If price changed: `PriceChangedError` — user must refresh their cart
- Web client uses `cartId = "local"` for the Dexie cart; `OrderService.placeOrder` resolves this by `userId`
- Cart is cleared (not deleted) after successful order placement

---

## Order

**Entity:** `apps/cf-api/src/domain/order/`
**Firebase path:** `orders/{orderId}`

### Value Objects

| Type | Constraints |
|------|------------|
| `OrderId` | `BrandedId<"OrderId">`, UUID |
| `ShippingAddress` | `{ street, city, province, country, postalCode, recipientName, phone }` |
| `PaymentMethod` | `"card" \| "crypto" \| "promptpay"` |

### Order Status FSM

```
             pending
            /       \
     confirmed      cancelled
        |
      shipped
        |
     delivered
```

Transitions:
- `pending → confirmed`: card payment succeeded (cf-commerce payment-result callback)
- `pending → cancelled`: card payment failed
- `crypto` orders skip `pending` and go directly to `confirmed` (x402 pre-payment)
- `confirmed → shipped`: admin action (not yet implemented in handlers)
- `shipped → delivered`: admin action (not yet implemented)

**`transitionOrderStatus(order, newStatus)`**: pure function returning `Result<Order, InvalidStatusTransitionError>`. Duplicate callbacks (same transition) return `Err` gracefully — `OrderService` logs and skips them.

### Business Rules

- `totalAmountInCents`, `shippingCents`, `discountCents` are frozen at order placement
- Price validation happens at placement: each cart item is re-fetched to catch price changes
- Revenue attribution: on `confirmOrder()`, each product's `ownerId` is looked up and `merchantRepo.recordCompletedOrder()` is called per merchant (grouped by owner, atomic counter update)

---

## Merchant / Billing

**Entity:** `apps/cf-api/src/domain/billing/`
**Firebase path:** `merchants/{userId}`

### Plan Tiers

| PlanId | Products | Orders/mo | Analytics | Custom Domain | Price |
|--------|----------|-----------|-----------|---------------|-------|
| `free` | 5 | 50 | ✗ | ✗ | ฿0 |
| `starter` | 50 | 500 | ✓ | ✗ | ฿990/mo |
| `professional` | 500 | Unlimited | ✓ | ✓ | ฿2,990/mo |
| `enterprise` | Unlimited | Unlimited | ✓ | ✓ | Custom |

### Value Objects / Interfaces

```typescript
interface Merchant {
  userId: string
  storeName: string
  email: string
  plan: "free" | "starter" | "professional" | "enterprise"
  planStatus: "active" | "trialing" | "past_due" | "cancelled"
  stripeCustomerId: Maybe<string>
  stripeSubscriptionId: Maybe<string>
  productCount: number        // atomic counter, updated on product create/delete
  completedOrderCount: number // atomic counter, updated by OrderService.confirmOrder()
  totalRevenueCents: number   // atomic counter, updated by OrderService.confirmOrder()
  createdAt: string
  updatedAt: string
  planExpiresAt: Maybe<string>
  storeSlug: Maybe<string>    // URL-safe, e.g. "my-shop"
}
```

### Business Rules

- `canAddProduct(merchant)`: returns `false` when `plan.maxProducts !== -1 && productCount >= maxProducts`
- `isSubscriptionActive(merchant)`: `planStatus === "active" || planStatus === "trialing"`
- `isPlanSufficient(userPlan, requiredPlan)`: compares `PLAN_RANK` (free=0, starter=1, professional=2, enterprise=3)
- Stripe customer is provisioned **lazily** — only created on first paid subscription, not on onboarding
- `storeSlug` is generated from `storeName` on first onboard, slugified and collision-checked
- Platform fee: 3% of `totalRevenueCents` is retained before payout (set as `PLATFORM_FEE_PCT = 0.03` in payout service)

---

## Payout

**Firebase path:** `payouts/{payoutId}`

### States

```
pending → approved → (manually transferred)
        ↘
         rejected
```

### Business Rules

- Minimum payout: ฿100 (10,000 cents)
- Available balance = `totalRevenueCents × (1 - 0.03) - paidOutCents`
- On approve: `paidOutCents` is incremented atomically via Firebase transaction
- `bankInfo` is a free-text field — production should replace with structured KYC-verified bank data
- Admin approval is manual; no automated bank transfer integration yet

---

## Voucher

**Firebase path:** `vouchers/{code}`

### Discount Types

| Type | Behavior |
|------|----------|
| `PercentOff` | Discount = `subtotal × (discountPct / 100)` |
| `FixedOff` | Discount = `discountAmount` (in cents) |
| `FreeShipping` | Discount = shipping amount |
| `BuyXGetY` | Buy `discountBuy` items, get `discountGet` free |

### Validation Pipeline (in order)

1. Voucher must exist in RTDB
2. `isActive === true`
3. `currentUsages < maxUsages` (or `maxUsages === 0` for unlimited)
4. `validUntilEpoch` >= now
5. `subtotalCents >= minOrderCents`
6. Discount calculation must produce `discountCents > 0`

Any failure short-circuits to the corresponding `PricingError` variant.

---

## Token / Auth

**Firebase paths:**
- `refresh_tokens/{jti}` — active refresh tokens
- `token_blacklist/{jti}` — revoked token JTIs

### Token Payload

```typescript
// AccessTokenPayload
{
  userId: string
  email: string
  role: UserRole
  iat: number   // issued at (PASETO adds automatically)
  exp: number   // expires at (15 minutes for access tokens)
}

// RefreshTokenPayload
{
  userId: string
  jti: string          // unique token ID for the refresh token
  tokenFamily: string  // family ID for replay detection
  iat: number
  exp: number          // 7 days for refresh tokens
}
```

### Token Rotation Rules

- Access token TTL: 15 minutes
- Refresh token TTL: 7 days
- **Token family rotation**: each `POST /auth/refresh` issues a new access+refresh pair and revokes the old refresh token
- **Replay detection**: if a revoked refresh token is used, the entire token family is invalidated (all sessions for that user)

---

## Inventory (Admin)

**Firebase path:** `inventory_receipts/{receiptId}`
**PostgreSQL (admin):** `inventory_balance` view, `stock_audit`, `shrinkage_charge` tables

The inventory system is admin-only and uses PostgreSQL (not RTDB) for its audit calculations. The RTDB `inventory_receipts` path holds raw receipt events; PostgreSQL aggregates them into balance views.

### Audit Types

| Type | Coverage | Frequency |
|------|----------|-----------|
| `spot_10pct` | 10% random SKUs | Monthly |
| `full_50pct` | 50% of SKUs | Each cycle |
| `full_100pct` | All SKUs | Every 2–3 months |

### Shrinkage Formula

`variance_units = last_counted_quantity - expected_on_hand`

Negative variance = shrinkage. `shrinkage_baht = |variance_units| × unit_price_baht`

---

## CurrencyCode

Supported ISO 4217 currencies:

```typescript
type CurrencyCode = "THB" | "USD" | "EUR" | "GBP" | "JPY" | "SGD"
```

The checkout pipeline additionally validates: `"THB" | "USD" | "EUR" | "SGD"` (subset — JPY and GBP not yet in the shipping rate table).

---

## Aggregate Rules Summary

| Entity | Max | Notes |
|--------|-----|-------|
| Cart items | 99 per item | `CartItemQuantity` max |
| Products per merchant | 5 / 50 / 500 / unlimited | By plan tier |
| Product name | 120 chars | `ProductName` |
| Display name | 50 chars | `DisplayName` |
| Voucher code | Any string | No format constraint in domain |
| Payout bank info | 200 chars | String field |
| Payout rejection reason | 500 chars | String field |
