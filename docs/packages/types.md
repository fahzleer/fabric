# @fabric/types — Domain Model

**Location**: `packages/types/src/`

The domain model is the most important code in the system. Not the services, not the handlers, not the database layer — the *types*. The types encode the invariants of the business domain. If the types are correct, an entire class of bugs becomes unrepresentable.

---

## The Philosophy of Branded Types

A raw `string` passed as `productId` where an `orderId` is expected is a bug that TypeScript's structural type system won't catch. The function signature says `string`, you pass a `string`, it compiles. You ship. It blows up at 2am.

Branded types close this hole:

```typescript
type BrandedId<TBrand> = {
  readonly __brand: TBrand
  readonly value: string
}

type ProductId = BrandedId<"ProductId">
type OrderId   = BrandedId<"OrderId">
type UserId    = BrandedId<"UserId">

// These are structurally different types
const productId: ProductId = { __brand: "ProductId", value: "prod_123" }
const orderId: OrderId     = { __brand: "OrderId",   value: "ord_456" }

// ✅ Compiles
function getProduct(id: ProductId): Promise<Product> { ... }
getProduct(productId)

// ❌ Compile error: Argument of type 'OrderId' is not assignable to 'ProductId'
getProduct(orderId)
```

You can still pass a raw string by constructing the brand explicitly — but you have to *mean* to do it. Accidental misuse is a compile error.

---

## Kernel Types (`kernel.ts`)

Foundation types used everywhere:

```typescript
// Option (presence/absence without null)
type Maybe<T> = Some<T> | None
type Some<T> = { readonly _tag: "Some"; readonly value: T }
type None    = { readonly _tag: "None" }

// Result (success/failure as values, not exceptions)
type Result<T, E> = Ok<T> | Err<E>
type Ok<T>  = { readonly _tag: "Ok";  readonly value: T }
type Err<E> = { readonly _tag: "Err"; readonly error: E }

// Branded identifier
type BrandedId<TBrand> = { readonly __brand: TBrand; readonly value: string }

// Currencies the system accepts
type CurrencyCode = "THB" | "USD" | "EUR" | "GBP" | "JPY" | "SGD"

// Base error type (structural, not class-based)
type TaggedError<TTag extends string, TData = never> = {
  readonly _tag: TTag
  readonly message: string
} & (TData extends never ? {} : { readonly data: TData })

// Non-empty array — makes the "at least one item" invariant structural
type NonEmptyArray<T> = readonly [T, ...T[]]
```

Narrowing:
```typescript
// Never check result._tag === "Err" — use the type guards
if (Result.isOk(result)) {
  result.value  // typed as T
} else {
  result.error  // typed as E
}

// Or: narrow with _tag directly
if (result._tag === "Ok") { ... }
```

---

## Product Types (`product.types.ts`)

```typescript
type ProductId     = BrandedId<"ProductId">
type ProductName   = { readonly __brand: "ProductName"; readonly value: string }
// Invariant: value.length >= 2 && value.length <= 120

type ProductPrice = {
  readonly __brand: "ProductPrice"
  readonly amount: number      // In cents (integer). 1999 = ฿19.99
  readonly currency: CurrencyCode
}
// ⚠️ makeProductPriceFromCents() is INFALLIBLE — returns ProductPrice directly, not Result
// Do not wrap in Result.match; it will fail. This is a constructor, not a validator.

type ProductSize   = "XS" | "S" | "M" | "L" | "XL" | "XXL" | "XXXL"
type ProductStatus = "draft" | "active" | "archived"
type ProductCategory = "basic" | "premium" | "limited_edition" | "custom"
type StockQuantity = { readonly __brand: "StockQuantity"; readonly value: number }
// Invariant: value >= 0 (never negative)

type ProductImage = {
  url: string
  alt: string
  isPrimary: boolean
  order: number
}
```

**Product Status State Machine**:

```
draft ──────────────────→ active ──────────────────→ archived
  │                                                       │
  └───────────────────────────────────────────────────────┘
                    (can re-activate)

draft → active:    publish action (store_owner)
active → archived: archive action (store_owner)
archived → active: re-activate (store_owner)
draft → archived:  not permitted (must publish first)
```

The transitions are enforced in `ProductService`. The `ProductStatus` type itself is just a union string — the service layer is where illegal transitions are rejected.

---

## User Types (`user.types.ts`)

```typescript
type UserId      = BrandedId<"UserId">
type Email       = { readonly __brand: "Email"; readonly value: string }
// Invariant: matches RFC 5322 (validated at ingress)

type DisplayName = { readonly __brand: "DisplayName"; readonly value: string }
// Invariant: value.length >= 2 && value.length <= 50

type UserRole    = "customer" | "admin" | "store_owner"
```

**Role semantics**:
- `"customer"`: Can browse, cart, and order
- `"store_owner"`: Can manage products, view analytics, receive payouts, subscribe to billing plans
- `"admin"`: Full access; can impersonate users, view all orders, modify billing

Role is stored in two places:
1. PostgreSQL `"user".role` — authoritative source for better-auth web sessions
2. Firebase RTDB `users/{userId}.role` — used by cf-api for server-side checks

If these get out of sync (e.g., role updated in RTDB but not PostgreSQL), the web session will show the old role until the user logs out and back in. The `/internal/issue-token` bridge reads from the web session (PostgreSQL) — so PASETO tokens reflect the correct role. Only the merchant portal's server-side redirect uses the session role.

---

## Cart Types (`cart.types.ts`)

```typescript
type CartId          = BrandedId<"CartId">
type CartItemQuantity = { readonly __brand: "CartItemQuantity"; readonly value: number }
// Invariant: value >= 1 && value <= 99
```

---

## Order Types (`order.types.ts`)

```typescript
type OrderId     = BrandedId<"OrderId">
type PaymentMethod = "card" | "crypto" | "promptpay"

type OrderStatus =
  | "pending"      // Created, payment initiated
  | "confirmed"    // Payment succeeded
  | "processing"   // Merchant is preparing
  | "shipped"      // Dispatched
  | "delivered"    // Customer confirmed receipt
  | "cancelled"    // Cancelled before shipping
  | "refunded"     // Payment reversed

type ShippingAddress = {
  recipientName: string
  street: string
  district: string
  city: string
  province: string
  postalCode: string
  country: string          // ISO 3166-1 alpha-2
  phoneNumber: string
}
```

**Order Status State Machine**:

```
pending → confirmed → processing → shipped → delivered
    │                                             │
    └── cancelled ←─────────────────────────────┘
    └── (payment failed) → stays pending (manual resolution)

confirmed → refunded (support action)
```

---

## Token Types (`token.types.ts`)

```typescript
type AccessTokenPayload = {
  sub: string      // userId
  email: string
  role: UserRole
  iat: number      // Unix timestamp
  exp: number      // Unix timestamp
}

type RefreshTokenPayload = {
  sub: string
  jti: string      // JWT ID (stored in tokenRepo for revocation)
  iat: number
  exp: number
}

type TokenPair = {
  accessToken: string   // PASETO v3.local, 15-minute expiry
  refreshToken: string  // PASETO v3.local, 30-day expiry
}
```

---

## Events (`events.ts`)

```typescript
// Base event structure — all domain events conform to this shape
type DomainEvent<TType extends string, TPayload> = {
  readonly _type: TType
  readonly _version: number       // Schema version for forward compatibility
  readonly eventId: string        // UUID, used for idempotency
  readonly occurredAt: string     // ISO 8601
  readonly payload: TPayload
}

// Event bus port — how services publish events
interface EventBusPort {
  publish(event: DomainEvent<string, unknown>): Promise<void>
}

// Concrete event types
type ProductCreated = DomainEvent<"ProductCreated", {
  productId: string
  sellerId: string
  name: string
  price: number
  priceCurrency: CurrencyCode
  category: ProductCategory
  status: "draft"
}>

type ProductUpdated = DomainEvent<"ProductUpdated", {
  productId: string
  changes: Partial<{ name: string; price: number; status: ProductStatus }>
}>

type OrderPlaced = DomainEvent<"OrderPlaced", {
  orderId: string
  userId: string
  cartId: string
  items: Array<{ productId: string; quantity: number; priceAtOrder: number }>
  totalCents: number
  currency: CurrencyCode
  paymentMethod: PaymentMethod
}>

// Payment
type PaymentDomainEvent =
  | DomainEvent<"PaymentSucceeded", { orderId: string; paymentId: string; amountCents: number }>
  | DomainEvent<"PaymentFailed",    { orderId: string; reason: string }>
  | DomainEvent<"RefundIssued",     { orderId: string; paymentId: string; amountCents: number }>
```

---

## Billing Types (`billing.types.ts`)

```typescript
type PlanId = "free" | "starter" | "professional" | "enterprise"

type MerchantOnboarded  = DomainEvent<"MerchantOnboarded",  { merchantId: string; storeSlug: string }>
type PlanSubscribed     = DomainEvent<"PlanSubscribed",     { merchantId: string; planId: PlanId; stripeSubscriptionId: string }>
type PlanUpgraded       = DomainEvent<"PlanUpgraded",       { merchantId: string; fromPlan: PlanId; toPlan: PlanId }>
type SubscriptionCancelled  = DomainEvent<"SubscriptionCancelled",  { merchantId: string; planId: PlanId }>
type SubscriptionExpired    = DomainEvent<"SubscriptionExpired",    { merchantId: string; planId: PlanId }>
type BillingPaymentFailed   = DomainEvent<"BillingPaymentFailed",   { merchantId: string; invoiceId: string; reason: string }>
```

---

## Pricing Types (`pricing.types.ts`)

```typescript
type CheckoutCalculated = DomainEvent<"CheckoutCalculated", {
  cartId: string
  subtotalCents: number
  discountCents: number
  shippingCents: number
  totalCents: number
  currency: CurrencyCode
  voucherCode?: string
}>

type VoucherApplied = DomainEvent<"VoucherApplied", {
  orderId: string
  voucherCode: string
  discountCents: number
}>

type VoucherRejected = DomainEvent<"VoucherRejected", {
  orderId: string
  voucherCode: string
  reason: string
}>

type InventoryReserved = DomainEvent<"InventoryReserved", {
  orderId: string
  reservations: Array<{ productId: string; quantity: number }>
}>

type InventoryReservationFailed = DomainEvent<"InventoryReservationFailed", {
  orderId: string
  productId: string
  requested: number
  available: number
}>
```

---

## Inventory Types (`inventory.types.ts`)

```typescript
type LotId   = BrandedId<"LotId">
type AuditId = BrandedId<"AuditId">

type InventoryBalance = {
  productId: string
  quantityOnHand: number
  quantityReserved: number
  quantityAvailable: number    // onHand - reserved
}

type InventoryReceived  = DomainEvent<"InventoryReceived",  { productId: string; lotId: string; quantity: number }>
type StockAuditRecorded = DomainEvent<"StockAuditRecorded", { productId: string; auditId: string; countedQuantity: number; variance: number }>
type ShrinkageCharged   = DomainEvent<"ShrinkageCharged",   { productId: string; quantity: number; reason: string }>
```

---

## Typeclasses (`typeclasses.ts`)

```typescript
// Equality
interface Eq<A> {
  equals(x: A, y: A): boolean
}

// Ordering
interface Ord<A> extends Eq<A> {
  compare(x: A, y: A): -1 | 0 | 1
}

// Semigroup (combining two values)
interface Semigroup<A> {
  concat(x: A, y: A): A
}

// Monoid (Semigroup with identity element)
interface Monoid<A> extends Semigroup<A> {
  empty: A
}

// Functional pipeline helpers
interface ListPipe<A> { /* map, filter, reduce, sort, etc. */ }
interface MapPipe<K, V> { /* get, set, delete, entries, etc. */ }

// Pipe function (left-to-right composition)
const pipe: <A>(value: A, ...fns: Array<(x: unknown) => unknown>) => unknown
```

---

## Repository Error

```typescript
// packages/types/src/errors.ts
type RepositoryError = {
  readonly _tag: "RepositoryError"
  readonly message: string
  readonly code: "not_found" | "database_error" | "constraint_violation" | "unauthorized"
  readonly cause?: unknown
}
```

All repository implementations return `Result<T, RepositoryError>`. Services map `RepositoryError` to domain-specific service errors at the boundary.
