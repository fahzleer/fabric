# Observability Guide

Fabric uses GCP Cloud Logging for structured logs from Firebase Functions, and Google Cloud Monitoring for infrastructure metrics. This guide covers log querying, debugging, and the 4 Golden Signals.

---

## Structured Logging

Both `apps/cf-api` and `apps/cf-commerce` emit structured JSON logs that are automatically ingested by Cloud Logging (stdout from Firebase Functions is captured).

### Log format

```typescript
// infrastructure/monitoring/logger.ts
interface LogEntry {
  severity: "DEBUG" | "INFO" | "WARNING" | "ERROR" | "CRITICAL"
  service: "cf-api" | "cf-commerce"
  message: string
  [key: string]: unknown  // structured fields
}
```

### Log helpers

```typescript
import { log } from "../../infrastructure/monitoring/logger"

log.debug("Cart item resolved", { cartId, productId, qty })
log.info(`Order placed: orderId=${orderId} total=${totalCents} ${currency}`)
log.warn(`Pricing fallback: voucher rejected (${tag}), retrying without voucher`)
log.error("Firebase write failed", { path: "orders/abc", error: e })
```

### HTTP request logs

`requestLogger()` middleware (Hono) logs every request:

```json
{
  "severity": "INFO",
  "service": "cf-api",
  "message": "POST /api/orders 201 142ms",
  "method": "POST",
  "path": "/api/orders",
  "status": 201,
  "latencyMs": 142,
  "ip": "1.2.3.4",
  "userAgent": "Mozilla/5.0..."
}
```

Status-based severity:
- 5xx → `ERROR`
- 4xx → `WARNING`
- 2xx/3xx → `INFO`

---

## GCP Cloud Logging Queries

Access at: **GCP Console → Logging → Log Explorer**

Resource filter: `resource.type="cloud_run_revision"` (Firebase Functions v2 run on Cloud Run)

### Common queries

```
# All errors from cf-api
resource.type="cloud_run_revision"
resource.labels.service_name="cf-api"
severity=ERROR

# Auth failures (rate limiting, invalid tokens)
resource.type="cloud_run_revision"
jsonPayload.message=~"TokenExpired|InvalidToken|RateLimit|AccountLocked"

# Order placement events
jsonPayload.message=~"Order placed"

# Slow requests (>1000ms)
jsonPayload.latencyMs > 1000

# Pricing fallback (voucher or pricing service unavailable)
jsonPayload.message=~"fallback"

# Payment webhook callbacks
jsonPayload.message=~"payment-result"

# Webhook processing (Stripe)
resource.labels.service_name="cf-api"
jsonPayload.path="/webhooks/stripe"
```

### Finding a specific order's lifecycle

```
jsonPayload.message=~"orderId=abc-123-..."
```

This will show all log entries tagged with that order ID across placement, payment initiation, and confirmation.

---

## 4 Golden Signals

### 1. Latency

**Target:** p99 < 500ms for read endpoints; p99 < 1000ms for write endpoints

Key latency contributors:
- Firebase RTDB reads: typically 50–150ms
- Pricing service call (cf-commerce): 50–200ms
- Stripe API calls: 200–500ms
- PASETO decryption: <1ms

**Cloud Monitoring query:**
```
metric.type="run.googleapis.com/request_latencies"
resource.labels.service_name="cf-api"
```

### 2. Traffic

**Baseline:** Monitor requests per second per endpoint

High-value endpoints to watch:
- `POST /auth/login` — spike detection (brute force)
- `POST /api/orders` — revenue proxy
- `POST /webhooks/stripe` — billing health
- `POST /events` — event pipeline health

```
metric.type="run.googleapis.com/request_count"
resource.labels.service_name="cf-api"
```

### 3. Errors

**Alert on:**
- Error rate > 1% on any 5xx
- `POST /webhooks/stripe` → any 4xx/5xx (webhook signature mismatch or processing failure)
- `POST /internal/payment-result` → repeated failures (payment callback loop broken)

**Key error patterns to search:**
```
# Webhook processing failures
jsonPayload.path="/webhooks/stripe"
severity=ERROR

# Payment result failures
jsonPayload.path="/internal/payment-result"
severity=ERROR

# Firebase transaction failures
jsonPayload.message=~"transaction.*fail|Firebase.*fail"
```

### 4. Saturation

**Firebase RTDB:**
- Monitor concurrent connections (max 200,000 per project)
- Watch for hot paths: `product_current` (public read on every storefront load)
- RTDB charges per downloaded bytes — monitor in Firebase Console → Usage

**Memcached (rate limiting):**
- If Memcached is unavailable, rate limiting falls back to fail-open (all requests allowed)
- Watch for `"Memcached"` or `"cache"` error logs

**Cold starts:**
- Firebase Functions v2 with minimum instances = 0 cold-start on first request
- First request after cold start: 1–3 seconds additional latency
- Consider setting minimum instances for `/api/products` (high-traffic read)

---

## Local Debugging

### Tail Firebase Function logs (prod)

```bash
firebase functions:log --only cfApi
firebase functions:log --only cfCommerce
```

### Local dev logs

In local dev (`bun run dev` in each app), logs go to stdout with the same JSON structure. Use `| jq` for readable output:

```bash
cd apps/cf-api && bun run dev 2>&1 | jq -r '"\(.severity) \(.message)"'
```

### Request tracing

The `attachRequestSignal` middleware threads an AbortSignal through `AsyncLocalStorage` so Firebase reads can be cancelled when the client disconnects. There is no distributed tracing (no OpenTelemetry) yet.

To trace a specific request:
1. Note the timestamp from the HTTP request log
2. Filter Cloud Logging by that timestamp ± 5 seconds
3. Filter by the endpoint path

---

## Firebase Console Monitoring

Firebase Console → Functions tab shows:

- **Invocations:** per-function call count (24h graph)
- **Errors:** error rate (separate from HTTP 4xx — these are unhandled exceptions)
- **Execution time:** median and 95th percentile
- **Active instances:** min/max concurrent instances

Firebase Console → Realtime Database → Usage shows:

- **Connections:** current + 30-day max
- **Bandwidth:** downloaded bytes (billing)
- **Storage:** total stored data

---

## Stripe Dashboard Monitoring

Stripe Dashboard → Developers → Webhooks shows:

- Event delivery success/failure rate
- Failed webhook attempts (with retry history)
- Response time per endpoint

Check this when investigating billing subscription issues before querying Cloud Logging.

---

## Health Checks

Both functions expose a health endpoint:

```bash
curl https://api.fabric.co/api/health       # cf-api
curl https://commerce.fabric.co/health      # cf-commerce
```

Both return `200 OK` with `{ "status": "ok" }` if the function is running.

Cloud Monitoring uptime checks should be configured on these endpoints with a 1-minute check interval and a 2-failure alert threshold.

---

## Alerting Recommendations

| Metric | Threshold | Alert Channel |
|--------|-----------|---------------|
| cf-api error rate | > 2% over 5 min | PagerDuty / Slack |
| cf-api p99 latency | > 2000ms | Slack |
| `POST /webhooks/stripe` errors | Any | PagerDuty (billing critical) |
| Firebase RTDB connections | > 150,000 | Slack |
| Memcached connection errors | > 10 in 5 min | Slack |
| Auth lockout events | > 100 in 1 min | PagerDuty (brute force attack) |

---

## Debug Playbook: "Order placed but not confirmed"

1. Find the order in Firebase:
   ```bash
   firebase database:get /orders/<orderId>
   ```
   Check `status`. If `"pending"`, the payment webhook was not received.

2. Check Stripe for the session:
   ```
   Stripe Dashboard → Payments → find by amount/date
   ```

3. Check if webhook was delivered:
   ```
   Stripe Dashboard → Webhooks → view events → filter by orderId
   ```

4. Check cf-api logs for webhook receipt:
   ```
   jsonPayload.path="/webhooks/stripe"
   jsonPayload.message=~"<orderId>"
   ```

5. If webhook was delivered but order not updated, check cf-api logs for `/internal/payment-result`:
   ```
   jsonPayload.path="/internal/payment-result"
   severity=ERROR
   ```

6. Manual resolution: call the internal endpoint directly (requires admin PASETO token):
   ```bash
   curl -X POST https://api.fabric.co/internal/payment-result \
     -H "x-internal-secret: <INTERNAL_SECRET>" \
     -H "Content-Type: application/json" \
     -d '{"orderId":"<id>","paymentId":"<stripePaymentId>","success":true}'
   ```
