# Firebase Realtime Database Schema

Complete reference for all RTDB paths used by `apps/cf-api` and `apps/cf-commerce`. The data model is document-oriented with manual indexing for query support.

Firebase RTDB project: configured via `FIREBASE_DATABASE_URL` env var.

---

## Path Index

| Path | Owner | Access |
|------|-------|--------|
| `/users/{userId}` | cf-api | User or admin |
| `/users_by_email/{emailBase64}` | cf-api | Server-only |
| `/product_current/{productId}` | cf-api | Public read |
| `/product_revisions/{productId}_{rev}` | cf-api | Server-only |
| `/products_current/{productId}` | cf-commerce | Public read (CQRS) |
| `/carts/{userId}/...` | cf-api | User only |
| `/orders/{orderId}` | cf-api | User (own) or admin |
| `/merchants/{userId}` | cf-api | User (own) or admin |
| `/vouchers/{code}` | cf-api | Public read, admin write |
| `/payouts/{requestId}` | cf-api | Admin only |
| `/refresh_tokens/{jti}` | cf-api | Server-only |
| `/token_blacklist/{jti}` | cf-api | Server-only |
| `/login_attempts/{emailBase64}` | cf-api | Server-only |
| `/activity_log/{nanoid}` | cf-api | Admin read, server write |
| `/event_log/{eventId}` | cf-commerce | Server-only |
| `/processed_events/{eventId}` | cf-commerce | Server-only |
| `/inventory_receipts/{receiptId}` | cf-commerce | Admin |

---

## `/users/{userId}`

Firebase User record. Server-side auth data.

```typescript
interface FirebaseUserRecord {
  id: string                    // same as path key (userId)
  email: string
  passwordHash: string | null   // null for OAuth-only accounts
  role: "customer" | "store_owner" | "admin"
  displayName: string
  emailVerifiedAt: string | null  // ISO timestamp
  createdAt: string             // ISO timestamp
  updatedAt: string
  deletedAt?: string            // soft delete (stamp, do not delete)
  authMethod?: "email" | "facebook" | "google"
}
```

**Indexes (Firebase RTDB `indexOn`):**
- None (queried only by ID or via `users_by_email` secondary index)

**Access rules:**
```json
"users": {
  "$userId": {
    ".read": "auth.uid === $userId || root.child('users').child(auth.uid).child('role').val() === 'admin'",
    ".write": "auth.uid === $userId || root.child('users').child(auth.uid).child('role').val() === 'admin'"
  }
}
```

---

## `/users_by_email/{emailBase64}`

Secondary index for email-to-userId lookup. Key is `base64(email.toLowerCase())`.

```typescript
interface FirebaseUserByEmailRecord {
  userId: string
}
```

**Why base64?** Firebase path keys cannot contain `.` or `@` — email addresses are base64-encoded to create valid keys.

---

## `/product_current/{productId}`

Current (latest) revision of a product. The merchant-writable copy. Updated atomically with `product_revisions`.

```typescript
interface FirebaseProductRecord {
  id: string
  ownerId: string               // userId of store_owner
  name: string
  price: number                 // in CENTS (not display units)
  currency: string              // "THB", "USD", etc.
  category: string              // slug
  status: "draft" | "active" | "archived"
  rev: number                   // incremented on each update
  stock: Record<string, number> // { "M": 10, "L": 5, ... }
  imageUrls: string[]           // ordered; first is primary
  tagline?: string
  description?: string
  createdAt: string             // ISO timestamp
  updatedAt: string
}
```

**Indexes:**
```json
"product_current": {
  ".indexOn": ["status", "ownerId", "category", "createdAt"]
}
```

**Access:**
- Public read: all users (unauthenticated)
- Write: `store_owner` or `admin` only

**Note:** `product_current.price` is in cents (raw storage). `ProductPrice.amount` (domain type) is in display units. The domain layer converts via `makeProductPriceFromCents()`.

---

## `/product_revisions/{productId}_{rev}`

Append-only revision history. Each save increments `rev` and writes both this path and `product_current` atomically (Firebase multi-location update).

```typescript
// Same schema as FirebaseProductRecord
// Key format: "${productId}_${rev}"  e.g. "abc-123_3"
```

**Access:** Server-only (no client-facing API exposes revisions).

---

## `/products_current/{productId}`

CQRS read model maintained by `apps/cf-commerce` event interpreter. This is the eventual-consistent projection of product state — updated when cf-commerce processes a `ProductCreated` or `ProductUpdated` event.

```typescript
interface FirebaseProductsCurrentRecord {
  productId: string
  ownerId: string
  name: string
  price: number     // in cents
  currency: string
  category: string
  status: "draft" | "active" | "archived"
  rev: number
  lastEventAt: string
}
```

**Access:**
- Public read
- No write (server-only — written by cf-commerce interpreter only)
- Not to be confused with `product_current` (different path, different purpose)

---

## `/carts/{userId}/meta`

Cart metadata.

```typescript
interface FirebaseCartMeta {
  id: string      // CartId branded value
  userId: string
  createdAt: string
  updatedAt: string
  deletedAt?: string
}
```

## `/carts/{userId}/items/{productId}_{size}`

Cart item. Key format: `${productId}_${size}` (e.g., `abc-123_M`).

```typescript
interface FirebaseCartItemRecord {
  productId: string
  size: string
  qty: number
  priceCents: number    // unit price in cents (snapshot at add time)
  currency: string
  productName: string
  productImageUrl?: string
  addedAt: string       // ISO timestamp
}
```

**Anonymous carts:** Stored at `/carts/anon_{cartId}/...` for pre-login sessions.

**Access:** User owns their cart path (`auth.uid === $userId`).

---

## `/orders/{orderId}`

Order record. Written by `FirebaseOrderRepository.atomicReserveAndSave()`.

```typescript
interface FirebaseOrderRecord {
  id: string
  userId: string
  cartId: string
  status: "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled" | "refunded"
  items: Record<string, FirebaseOrderItem>  // key: "${productId}_${size}"
  totalAmountInCents: number
  shippingCents: number
  discountCents: number
  currency: string
  shippingAddress: {
    recipientName: string
    street: string
    district?: string
    city: string
    province?: string
    postalCode: string
    country: string
    phoneNumber: string
  }
  voucherCode?: string
  paymentMethod: "card" | "crypto" | "promptpay"
  paymentId?: string        // set after payment gateway assigns ID
  placedAt: string          // ISO timestamp
  updatedAt: string
  confirmedAt?: string
  shippedAt?: string
  deliveredAt?: string
  cancelledAt?: string
  trackingNumber?: string
}

interface FirebaseOrderItem {
  productId: string
  productName: string
  size: string
  quantity: number
  unitPriceCents: number
}
```

**Indexes:**
```json
"orders": {
  ".indexOn": ["userId", "cartId", "status", "placedAt"]
}
```

**Access:**
- Admin: all orders
- User: own orders only (`auth.uid === order.userId`)

---

## `/merchants/{userId}`

Merchant/billing record. One per store owner.

```typescript
interface FirebaseMerchantRecord {
  userId: string
  storeName: string
  email: string
  plan: "free" | "starter" | "professional" | "enterprise"
  planStatus: "active" | "trialing" | "past_due" | "cancelled"
  stripeCustomerId: string | null      // null until first paid subscription
  stripeSubscriptionId: string | null
  productCount: number                 // atomic counter: incremented on create, decremented on delete
  completedOrderCount: number          // atomic counter: incremented by confirmOrder()
  totalRevenueCents: number            // atomic counter: incremented by confirmOrder()
  paidOutCents: number                 // atomic counter: incremented on payout approval
  storeSlug: string | null             // URL-safe slug (e.g. "my-shop")
  createdAt: string
  updatedAt: string
  planExpiresAt: string | null         // set on cancellation (grace period end)

  // Payout requests sub-collection
  payoutRequests?: Record<string, FirebaseMerchantPayoutRequest>
}

interface FirebaseMerchantPayoutRequest {
  id: string
  status: "pending" | "approved" | "rejected"
  amountCents: number
  bankInfo: string            // free text (max 200 chars)
  requestedAt: string
  approvedAt?: string
  rejectedAt?: string
  approvedBy?: string         // admin userId
  rejectedBy?: string
  adminNote?: string          // rejection reason
}
```

**Access:** Owner or admin only.

---

## `/vouchers/{code}`

Voucher definitions. Code is the path key (any string, typically uppercase alphanumeric).

```typescript
interface FirebaseVoucherRecord {
  code: string
  isActive: boolean
  discountTag: "PercentOff" | "FixedOff" | "FreeShipping" | "BuyXGetY"
  discountPct?: number         // 0–100, for PercentOff
  discountAmount?: number      // in cents, for FixedOff
  discountBuy?: number         // for BuyXGetY: buy N
  discountGet?: number         // for BuyXGetY: get M free
  minOrderCents: number        // 0 for no minimum
  maxUsages: number            // 0 for unlimited
  currentUsages: number        // atomic counter
  validUntilEpoch: number      // Unix timestamp in seconds
  createdAt: string
}
```

**Access:**
- Public read (voucher codes are user-entered, but values must be readable to validate)
- Admin write only

**Atomicity:** `atomicCheckAndUseVoucher()` uses Firebase transaction to increment `currentUsages` and check limits simultaneously — prevents race conditions.

---

## `/refresh_tokens/{jti}`

Active refresh tokens. JTI is the unique token ID (UUID).

```typescript
interface FirebaseRefreshTokenRecord {
  jti: string
  userId: string
  tokenFamily: string          // groups tokens from the same login session
  tokenHash: string            // SHA-256 hash of the refresh token string
  issuedAt: string             // ISO timestamp
  expiresAt: string            // ISO timestamp (7 days from issuedAt)
  revokedAt?: string           // set when token is used (rotated out)
}
```

**Access:** Server-only (no security rules needed — RTDB rules block all client access).

---

## `/token_blacklist/{jti}`

Blacklisted refresh token JTIs. Written when a refresh token is used (one-time) or when a family is revoked (replay attack).

```typescript
interface FirebaseTokenBlacklistRecord {
  jti: string
  blacklistedAt: string        // ISO timestamp
  expiresAt: string            // for future cleanup (TTL not enforced automatically)
}
```

**Cleanup:** No TTL enforcement yet. This list grows indefinitely. A periodic cleanup job should delete entries where `expiresAt < now`.

---

## `/login_attempts/{emailBase64}`

Brute-force lockout tracking. Key is `base64(email.toLowerCase())`.

```typescript
interface FirebaseLoginAttemptRecord {
  email: string
  failureCount: number
  firstAttemptAt: string       // ISO timestamp (window start)
  lockedUntil?: string         // ISO timestamp (set when threshold exceeded)
}
```

**Policy:** 5 failures within 15 minutes → locked for 15 minutes. Cleared on successful login.

**Access:** Server-only.

---

## `/activity_log/{nanoid}`

Append-only audit trail. Key is a nanoid (URL-safe random ID).

```typescript
interface FirebaseActivityLogRecord {
  id: string
  userId?: string              // present for user-initiated events
  eventType: string            // e.g. "order_placed", "cart_item_added", "login_failed"
  eventData: Record<string, unknown>
  timestamp: string            // ISO timestamp
}
```

**Access:** Admin read, server write only.

---

## `/event_log/{eventId}`

Persistent event log maintained by cf-commerce. All domain events are appended here.

```typescript
interface FirebaseEventLogRecord {
  eventId: string
  eventType: string            // "ProductCreated", "OrderPlaced", etc.
  aggregateId: string          // entity ID (productId, orderId)
  occurredAt: string           // ISO timestamp
  schemaVersion: number
  payload: Record<string, unknown>
}
```

**Access:** Server-only (cf-commerce).

---

## `/processed_events/{eventId}`

Idempotency registry. cf-commerce marks each processed event here (Firebase transaction) to prevent duplicate processing.

```typescript
interface FirebaseProcessedEventRecord {
  eventId: string
  processedAt: string          // ISO timestamp
}
```

**Access:** Server-only (cf-commerce).

---

## `/inventory_receipts/{receiptId}`

Append-only inventory receipt events. Used by the inventory management system.

```typescript
interface FirebaseInventoryReceiptRecord {
  id: string
  productId: string
  storeId: string
  type: "restock" | "sale" | "return" | "adjustment"
  quantity: number             // positive for restock/return, negative for sale/shrinkage
  unitCostBaht?: number        // cost per unit at time of receipt
  lotId?: string               // lot tracking (for expiry, quality control)
  receivedAt: string           // ISO timestamp
  recordedBy: string           // userId of staff who recorded
}
```

**Access:** Admin only.

---

## Firebase Security Rules Summary

Key rules from `database.rules.json`:

```json
{
  "rules": {
    "users": {
      "$userId": {
        ".read": "auth.uid === $userId || isAdmin()",
        ".write": "auth.uid === $userId || isAdmin()"
      }
    },
    "product_current": {
      ".read": true,
      "$productId": {
        ".write": "isStoreOwner() || isAdmin()"
      }
    },
    "products_current": {
      ".read": true,
      ".write": false
    },
    "orders": {
      "$orderId": {
        ".read": "data.child('userId').val() === auth.uid || isAdmin()",
        ".write": "isAdmin()"
      }
    },
    "merchants": {
      "$userId": {
        ".read": "auth.uid === $userId || isAdmin()",
        ".write": "isAdmin()"
      }
    },
    "vouchers": {
      ".read": true,
      ".write": "isAdmin()"
    },
    "refresh_tokens": { ".read": false, ".write": false },
    "token_blacklist": { ".read": false, ".write": false },
    "login_attempts": { ".read": false, ".write": false },
    "$other": { ".read": false, ".write": false }
  }
}
```

**Important:** The application layer (cf-api) enforces authorization independently of RTDB rules. RTDB rules are the last line of defense. Both layers must be correct.
