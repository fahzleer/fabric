# Railway Oriented Programming — Error Handling with Either

> "Exceptions are goto statements for error handling." They transfer control to an unknown location, bypass type checking, and force every call site to either handle all possible errors or propagate them blindly.

---

## The Core Thesis

In a language with checked exceptions (Java), the compiler forces you to handle every checked exception at the call site. TypeScript has no checked exceptions. Every `throw` is invisible to the type system. Every function that throws is lying about its return type.

The fix is not to use checked exceptions — TypeScript doesn't have them. The fix is to make errors values:

```typescript
// ❌ Lies about its return type. Actually returns PricingError | CheckoutResult.
function calculateCheckout(req: CheckoutRequest): CheckoutResult {
  if (req.items.length === 0) throw new PricingError("EmptyCart")
  // ...
}

// ✅ Tells the truth.
function calculateCheckout(req: CheckoutRequest): Either<PricingError, CheckoutResult> {
  if (req.items.length === 0) return Either.left({ _tag: "EmptyCart" })
  // ...
}
```

The second function's type is a contract. It cannot lie. The compiler holds it to account.

---

## Either<L, R> from the Effect Library

```typescript
import { Either } from "effect"

// Either.left(l)  → Left<L>   — the "error" track
// Either.right(r) → Right<R>  — the "success" track

const success: Either<string, number> = Either.right(42)
const failure: Either<string, number> = Either.left("something went wrong")

// Check which track you're on
Either.isLeft(result)   // → boolean
Either.isRight(result)  // → boolean

// Unwrap safely
Either.getOrElse(result, (err) => defaultValue)

// Chain: transform the right value, pass through Left unchanged
const doubled = Either.map(result, (n) => n * 2)

// Chain: flat-map for operations that might also fail
const validated = Either.flatMap(result, (n) =>
  n > 0 ? Either.right(n) : Either.left("must be positive")
)
```

---

## The Pricing Pipeline

The checkout flow is a sequence of steps, each of which can fail. Railway Oriented Programming makes this a linear chain:

```typescript
// pricing/Pipeline/Checkout.ts

const checkoutFlow = (req: CheckoutRequest): Either<PricingError, CheckoutResult> =>
  pipe(
    Either.right(req),

    // Step 1: Cart must have at least one item
    Either.flatMap(validateNotEmpty),
    // validateNotEmpty: CheckoutRequest → Either<EmptyCart, CheckoutRequest>

    // Step 2: Every item must have a valid price and non-zero quantity
    Either.flatMap(validateItemPrices),
    // validateItemPrices: CheckoutRequest → Either<InvalidPrice | ZeroQuantity, CheckoutRequest>

    // Step 3: Calculate subtotal; verify stock quantities
    Either.flatMap(calculateSubtotal),
    // calculateSubtotal: CheckoutRequest → Either<InsufficientStock, CheckoutRequest & { subtotalCents }>

    // Step 4: Apply voucher if provided (optional step — no voucher = no change)
    Either.flatMap(applyVoucher),
    // applyVoucher: ... → Either<VoucherExpired | VoucherExhausted | VoucherNotFound | ..., ...>

    // Step 5: Calculate shipping for the delivery address
    Either.flatMap(addShipping),
    // addShipping: ... → Either<UndeliverableAddress | ShippingCalculationFailed, ...>

    // Step 6: Validate the total currency is supported
    Either.flatMap(validateCurrency),
    // validateCurrency: ... → Either<InvalidCurrency, CheckoutResult>
  )
```

The `pipe` + `Either.flatMap` pattern implements **short-circuit evaluation**: as soon as one step returns `Either.left(error)`, all subsequent steps are skipped. The error propagates unchanged to the end of the pipeline.

**The critical property**: the error type at each step is statically known. The final type is:

```typescript
Either<
  EmptyCart
  | InvalidPrice | ZeroQuantity
  | InsufficientStock
  | VoucherExpired | VoucherExhausted | VoucherNotFound | OrderBelowMinimum | InvalidDiscount
  | UndeliverableAddress | ShippingCalculationFailed
  | InvalidCurrency,
  CheckoutResult
>
```

The HTTP handler pattern-matches on this union to return the correct HTTP status and error message for *every possible failure mode*.

---

## Individual Pipeline Steps

```typescript
function validateNotEmpty(
  req: CheckoutRequest
): Either<PricingError, CheckoutRequest> {
  return req.items.length > 0
    ? Either.right(req)
    : Either.left({ _tag: "EmptyCart" })
}

function validateItemPrices(
  req: CheckoutRequest
): Either<PricingError, CheckoutRequest> {
  for (const item of req.items) {
    if (item.unitPriceCents <= 0) {
      return Either.left({
        _tag: "InvalidPrice",
        productId: item.productId,
        price: item.unitPriceCents,
      })
    }
    if (item.quantity === 0) {
      return Either.left({ _tag: "ZeroQuantity", productId: item.productId })
    }
  }
  return Either.right(req)
}

function calculateSubtotal(
  req: CheckoutRequest
): Either<PricingError, CheckoutRequest & { subtotalCents: number }> {
  for (const item of req.items) {
    if (item.quantity > item.availableStock) {
      return Either.left({
        _tag: "InsufficientStock",
        productId: item.productId,
        requested: item.quantity,
        available: item.availableStock,
      })
    }
  }

  const subtotalCents = req.items.reduce(
    (acc, item) => acc + item.unitPriceCents * item.quantity,
    0
  )

  return Either.right({ ...req, subtotalCents })
}
```

Each step is a pure function. No async. No database calls. The function takes data in, returns Either out. It can be tested with a single function call.

---

## PricingError ADT — Exhaustive Coverage

```typescript
// pricing/Error/PricingError.ts

type PricingError =
  | { readonly _tag: "EmptyCart" }
  | { readonly _tag: "InvalidPrice";             readonly productId: string; readonly price: number }
  | { readonly _tag: "ZeroQuantity";             readonly productId: string }
  | { readonly _tag: "InsufficientStock";        readonly productId: string; readonly requested: number; readonly available: number }
  | { readonly _tag: "StockLockFailed";          readonly productId: string }
  | { readonly _tag: "VoucherExpired";           readonly code: string; readonly expiredAt: string }
  | { readonly _tag: "VoucherExhausted";         readonly code: string }
  | { readonly _tag: "VoucherNotFound";          readonly code: string }
  | { readonly _tag: "OrderBelowMinimum";        readonly minimum: number; readonly actual: number }
  | { readonly _tag: "InvalidDiscount";          readonly reason: string }
  | { readonly _tag: "UndeliverableAddress";     readonly province: string }
  | { readonly _tag: "ShippingCalculationFailed" }
  | { readonly _tag: "InvalidCurrency";          readonly currency: string }
```

The HTTP handler exhaustively matches this union:

```typescript
// pricing/Http/Router.ts
app.post("/checkout/calculate", async (c) => {
  const req = parseCheckoutRequest(await c.req.json())
  const result = checkoutFlow(req)

  if (Either.isRight(result)) {
    return c.json(Either.getRight(result), 200)
  }

  const error = Either.getLeft(result)
  switch (error._tag) {
    case "EmptyCart":
      return c.json({ code: "EMPTY_CART", message: "Cart has no items" }, 400)

    case "InsufficientStock":
      return c.json({
        code: "INSUFFICIENT_STOCK",
        message: `Product ${error.productId}: requested ${error.requested}, available ${error.available}`,
      }, 409)

    case "VoucherExpired":
      return c.json({ code: "VOUCHER_EXPIRED", message: `Voucher expired at ${error.expiredAt}` }, 400)

    case "VoucherNotFound":
      return c.json({ code: "VOUCHER_NOT_FOUND", message: `No voucher with code ${error.code}` }, 404)

    // TypeScript enforces that every case is handled.
    // If you add a new PricingError variant and forget to add a case here,
    // the compiler will report an error (with --noImplicitReturns or exhaustive checks).
    default:
      return c.json({ code: "PRICING_ERROR", message: error._tag }, 400)
  }
})
```

---

## Testing the Pipeline

```typescript
describe("checkoutFlow", () => {
  const baseRequest: CheckoutRequest = {
    items: [{ productId: "prod_1", unitPriceCents: 1000, quantity: 2, availableStock: 5 }],
    voucherCode: null,
    shippingAddress: validAddress,
    currency: "THB",
  }

  test("returns Right(CheckoutResult) for valid request", () => {
    const result = checkoutFlow(baseRequest)
    expect(Either.isRight(result)).toBe(true)
    expect(Either.getRight(result).subtotalCents).toBe(2000)
  })

  test("returns Left(EmptyCart) for empty items", () => {
    const result = checkoutFlow({ ...baseRequest, items: [] })
    expect(Either.isLeft(result)).toBe(true)
    expect(Either.getLeft(result)._tag).toBe("EmptyCart")
  })

  test("returns Left(InsufficientStock) when quantity exceeds stock", () => {
    const result = checkoutFlow({
      ...baseRequest,
      items: [{ productId: "prod_1", unitPriceCents: 1000, quantity: 10, availableStock: 5 }],
    })
    expect(Either.isLeft(result)).toBe(true)
    const err = Either.getLeft(result) as Extract<PricingError, { _tag: "InsufficientStock" }>
    expect(err.requested).toBe(10)
    expect(err.available).toBe(5)
  })
})
```

Every test is a pure function call. No network. No database. No mocking framework. Execution time: sub-millisecond per test.

---

## When NOT to Use Either

Railway Oriented Programming is appropriate for **business rule validation** — sequences of checks where each failure has a specific, known type that the caller needs to handle differently.

It is not appropriate for:

**Infrastructure errors** (database unavailable, network timeout): These are not business rules. They are operational failures. Return them as `RepositoryError` or let them propagate as unhandled exceptions to the global error handler, which will log them and return a 500.

**Simple boolean checks**: `if (user.role !== "store_owner") return 403` does not need Either. Straight conditional with an early return is clearer.

**Async pipelines** where each step is IO-bound: Either is synchronous. For async pipelines, use `Effect` from the `effect` library, which is the async analog of Either.
