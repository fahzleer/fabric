# Error Codes Reference

All errors returned by `apps/cf-api` and `apps/cf-commerce` follow a consistent JSON envelope:

```json
{
  "error": "Human-readable message",
  "_tag": "MachineReadableErrorTag"
}
```

The `_tag` field is the stable machine-readable identifier. The `error` string is user-facing and may change. Clients should branch on `_tag`, not `error`.

---

## cf-api Error Codes

### Auth Errors (4xx)

| `_tag` | HTTP | Description |
|--------|------|-------------|
| `AccountLockedError` | 429 | Too many failed logins. Locked for 15 minutes. |
| `InvalidCredentialsError` | 401 | Wrong password or email not found. |
| `OAuthOnlyAccountError` | 401 | Account uses Google/Facebook — no password set. |
| `InvalidTokenError` | 401 | PASETO token malformed or signature invalid. |
| `TokenExpiredError` | 401 | Access token TTL (15 min) exceeded. |
| `TokenRevokedError` | 401 | Refresh token was already used (replay detected). Token family invalidated. |
| `MissingAuthorizationError` | 401 | No `Authorization: Bearer <token>` header. |
| `ForbiddenError` | 403 | Valid token but insufficient role. |
| `InvalidFacebookToken` | 401 | Facebook user access token failed verification. |
| `EmailNotProvidedError` | 422 | OAuth provider did not return an email address. |

### Resource Errors (4xx)

| `_tag` | HTTP | Description |
|--------|------|-------------|
| `ProductNotFoundError` | 404 | Product ID does not exist or is archived. |
| `OrderNotFoundError` | 404 | Order ID not found, or belongs to different user. |
| `CartNotFoundError` | 404 | Cart ID not found. |
| `UserNotFoundError` | 404 | User email or ID not found. |
| `VoucherNotFoundError` | 404 | Voucher code does not exist. |
| `PayoutNotFoundError` | 404 | Payout request ID not found. |
| `MerchantNotFoundError` | 404 | Merchant profile not found for user. |

### Conflict / Validation Errors (4xx)

| `_tag` | HTTP | Description |
|--------|------|-------------|
| `DuplicateEmailError` | 409 | Email is already registered. |
| `InvalidStatusTransitionError` | 409 | Order/Product FSM transition not allowed from current state. |
| `EmptyOrderError` | 422 | Cart is empty — cannot place order. |
| `PriceChangedError` | 422 | Product price changed since item was added to cart. User must refresh. |
| `InsufficientBalanceError` | 422 | Payout amount exceeds available balance. |
| `ProductCapacityError` | 403 | Plan product limit reached (`canAddProduct` returned false). |
| `InvalidProductNameError` | 422 | Product name < 2 or > 120 characters. |
| `InvalidQuantityError` | 422 | Cart item quantity outside 1–99. |
| `InvalidSizeError` | 422 | Size not in `ProductSize` union. |

### Rate Limit (429)

| `_tag` | HTTP | Description |
|--------|------|-------------|
| `RateLimitError` | 429 | IP + path rate limit exceeded (Memcached sliding window). |

### Server Errors (5xx)

| `_tag` | HTTP | Description |
|--------|------|-------------|
| `RepositoryError` | 500 | Firebase RTDB read/write failure. |
| `TokenIssuanceError` | 500 | Failed to encrypt PASETO token. |
| `PasswordHashError` | 500 | bcrypt hashing failed. |
| `InternalServiceError` | 503 | Downstream service (cf-commerce) unreachable. |

---

## cf-commerce Pricing Error Codes

All pricing errors are returned from `POST /checkout/calculate`, `POST /pricing/validate`, `POST /inventory/reserve`, and `POST /voucher/apply` in the envelope:

```json
{
  "ok": false,
  "error": { "tag": "EmptyCart", "message": "Cart must have at least one item" }
}
```

| `tag` | Description | Source step |
|-------|-------------|-------------|
| `EmptyCart` | No items in checkout request. | `validateNotEmpty` |
| `InvalidPrice` | Unit price ≤ 0 or currency not supported. | `validateItemPrices` |
| `ZeroQuantity` | Item quantity is zero. | `validateItemPrices` |
| `InsufficientStock` | Requested qty exceeds available stock. | `checkSufficient` (inventory) |
| `StockLockFailed` | Concurrent reservation conflict. | `reserveStockBatch` (cf-api) |
| `VoucherNotFound` | Voucher code does not exist in RTDB. | `applyVoucherIfPresent` |
| `VoucherExpired` | `validUntilEpoch` < current time. | `checkExpiry` |
| `VoucherExhausted` | `currentUsages >= maxUsages`. | `checkUsageLimit` |
| `OrderBelowMinimum` | Subtotal < `minOrderCents`. | `checkMinOrder` |
| `InvalidDiscount` | Computed discount ≤ 0 (bad voucher config). | `discountStep` |
| `UndeliverableAddress` | Shipping country not in rate table. | `addShipping` |
| `ShippingCalculationFailed` | Internal shipping rate error. | `addShipping` |
| `InvalidCurrency` | Currency not in `"THB" \| "USD" \| "EUR" \| "SGD"`. | `validateCurrency` |

---

## Payment Error Codes

Returned from `POST /payment/initiate` and `POST /payment/process` in cf-commerce:

| `_tag` | Description |
|--------|-------------|
| `PaymentDeclined` | Gateway rejected the charge (insufficient funds, blocked card). |
| `InvalidPaymentToken` | Omise token expired or already used. |
| `PaymentGatewayError` | Omise API 5xx or network timeout. |
| `InvalidAmount` | `amountCents` ≤ 0. |
| `UnsupportedCurrency` | Currency not accepted by gateway. |

---

## HTTP Status Code Summary

| Status | When |
|--------|------|
| 200 | Success with body |
| 201 | Resource created (`POST /merchant/payouts/request`, `POST /auth/register`) |
| 202 | Accepted, async processing (`POST /events` in cf-commerce) |
| 204 | Success, no body |
| 400 | Request body failed schema validation (arktype) |
| 401 | Missing or invalid auth token |
| 403 | Valid token, insufficient role or plan |
| 404 | Resource not found |
| 409 | Conflict (duplicate, FSM violation) |
| 422 | Business rule violation (price change, empty cart, bad voucher) |
| 429 | Rate limit exceeded |
| 500 | Unexpected server error (Firebase, crypto) |
| 503 | Downstream service unavailable |

---

## Error Handling in Client Code

### apps/web (merchant portal)

`createMerchantApi()` returns `ApiResult<T>`:

```typescript
type ApiResult<T> = { ok: true; value: T } | { ok: false; error: string; _tag?: string }
```

Pattern:

```typescript
const result = await api.createProduct(input)
if (!result.ok) {
  if (result._tag === "ProductCapacityError") {
    // show upgrade prompt
  } else {
    // generic error toast
  }
  return
}
// use result.value
```

### apps/cf-api internal (domain layer)

All service methods return `Result<T, E>`:

```typescript
const result = await orderService.placeOrder(...)
if (result._tag === "Err") {
  // result.error._tag is the error tag
  // result.error.message is the human-readable description
}
```

### Error → HTTP mapping

`presentDomainError()` in `features/shared/http-error.presenter.ts` looks up `ERROR_CODES[error._tag]` to get `{ status, message }` and throws an HTTPException with the correct status code.

The HTTP handler wraps this in the response envelope:

```json
{ "error": "...", "_tag": "..." }
```

---

## Input Validation Errors (400)

When an HTTP handler's arktype schema rejects the request body, the response is:

```json
{
  "error": "amountCents must be a positive integer, bankInfo must be at least 5 characters"
}
```

No `_tag` is present on validation errors — the `error` string contains the full arktype summary.
