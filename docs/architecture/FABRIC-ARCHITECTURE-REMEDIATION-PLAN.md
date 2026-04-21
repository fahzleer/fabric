# FABRIC ARCHITECTURAL REMEDIATION PLAN

## PART I — CANONICAL GROUND TRUTHS

### I.1 — Token TTLs (Canonical)

| Token | TTL | Scope Field |
|---|---|---|
| Access token (standard) | 900 seconds (15 min) | `"standard"` |
| Access token (privileged) | 120 seconds (2 min) | `"privileged"` |
| Refresh token | 604800 seconds (7 days) | n/a |

**DOCUMENTATION ERROR:** `cf-api.md` contains two references to "30-day refresh token TTL". These are incorrect. The canonical value is 7 days, verified from `token.types.ts`. Phase 1.7 must correct all 30-day references to 7 days.

**PASETO key rotation window:** After rotating the PASETO signing key, the old key must remain valid for **8 days** (7-day refresh TTL + 1-day buffer). Removing the old key after only 24 hours would force-logout every user who has a valid 7-day refresh token.

---

### I.2 — Firebase RTDB Canonical Paths

| Purpose | Canonical Path | Old/Wrong Path |
|---|---|---|
| Product write store | `/product_write/{productId}` | `/product_current`, `/products_current` |
| Product write history | `/product_write_history/{productId}/{historyId}` | n/a (new) |
| Product read model | `/product_read_model/{productId}` | n/a (verify) |
| Event outbox | `/event_outbox/{eventId}` | n/a (new) |
| Event dead-letter queue | `/event_dlq/{eventId}` | n/a (new) |

**Phase 1.3 instruction:** Before executing any rename, verify current source code. If source already uses `product_write` and `product_read_model`, Phase 1.3 is verification-only — do not re-rename.

---

### I.3 — ProductPrice Canonical Type

```typescript
// packages/types/src/product-price.ts
// THIS IS THE ONLY CORRECT SHAPE. No exceptions.

interface ProductPrice {
  readonly displayAmount: number   // Render ONLY. 299 = ฿299. NEVER arithmetic.
  readonly cents: number           // Arithmetic + persistence. 29900 = ฿299.00.
  readonly currency: CurrencyCode
}

const ProductPrice = {
  fromCents: (cents: number, currency: CurrencyCode): ProductPrice => ({
    cents,
    displayAmount: cents / 100,
    currency,
  }),
  toCents: (p: ProductPrice): number => p.cents,
}
```

**FORBIDDEN — will cause runtime crash or silent precision loss:**
```typescript
// FORBIDDEN: bigint for any price field
cents: bigint   // JSON.stringify({ cents: 29900n }) throws TypeError

// FORBIDDEN: ambiguous field name
amount: number  // Ambiguous — cents or display? Never use.

// FORBIDDEN: old factory name
makeProductPriceFromCents()  // Replaced by ProductPrice.fromCents()
```

---

### I.4 — Branded Type Canonical Pattern

```typescript
// packages/types/src/kernel.ts (after Phase 3.5 cleanup)
// Intersection brand — still a string at runtime, no .value accessor needed

type Brand<T, K extends string> = T & { readonly __brand: K }

type ProductId   = Brand<string, "ProductId">
type MerchantId  = Brand<string, "MerchantId">
type OrderId     = Brand<string, "OrderId">
type UserId      = Brand<string, "UserId">

// Constructor functions (type-safe cast, no runtime overhead)
const ProductId   = (s: string): ProductId   => s as ProductId
const MerchantId  = (s: string): MerchantId  => s as MerchantId
```

**FORBIDDEN — incorrect wrapper shape:**
```typescript
// FORBIDDEN: object wrapper
type ProductId = { __brand: "ProductId"; value: string }  // Not a string at runtime

// FORBIDDEN: .value to unwrap
const id = someProductId.value  // Does not exist with intersection brand

// FORBIDDEN: Effect-ts Schema.brand() for domain IDs
// Schema.brand is for parsing from untrusted input, not for domain ID construction
```

---

### I.5 — Secret Names (Canonical After Phase 0.2)

| Secret Name | Used By | Guards |
|---|---|---|
| `TOKEN_ISSUE_SECRET` | cf-api (issues), apps/web (sends) | `/internal/issue-token` bridge |
| `PAYMENT_RESULT_SECRET` | cf-commerce (sends), cf-api (verifies) | `/internal/payment-result` webhook |
| `PROMPTPAY_CREATE_SECRET` | cf-api (sends), cf-commerce (verifies) | `/payment/promptpay/create` |

**`INTERNAL_SECRET` DOES NOT EXIST after Phase 0.2.** Any code, documentation, or environment file referencing `INTERNAL_SECRET` after Phase 0.2 is a bug.

---

### I.6 — PASETO Scope Model (Canonical After Phase 2.2)

```typescript
interface AccessTokenPayload {
  sub:   string                        // UserId (branded string)
  email: string
  role:  UserRole                      // Authoritative source: PostgreSQL users.role
  scope: "standard" | "privileged"    // NEW — added in Phase 2.2
  iat:   number
  exp:   number  // iat + 900 (standard) OR iat + 120 (privileged)
}
```

**Issuance rules — strictly enforced:**
- Login endpoint (`POST /auth/login`): ALWAYS issues `scope: "standard"`, TTL 15 min. NEVER issues privileged tokens. No dual-token response.
- `/internal/issue-token` bridge: ALWAYS issues `scope: "privileged"`, TTL 2 min.
- Merchant/admin route middleware: REJECT with 403 if `scope !== "privileged"`.
- `requireAuth` middleware on standard routes: REJECT if token expired; do NOT check scope.

**Bridge call pattern — per Server Component, not per page load:**
Next.js Server Components call the bridge naturally on each render (which is already per-request server-side). The 2-min TTL fits this lifecycle. The bridge is NOT called client-side.

---

## PART II — REMEDIATION PHASES

### PHASE 0 — Emergency Safety (Week 1, No Feature Freeze Required)

Phase 0 items are security/reliability fixes that must be deployed before any other phase begins. They are all backward-compatible and can ship without a feature freeze.

---

#### Phase 0.1 — Rotate All Secrets Immediately

**Problem:** `INTERNAL_SECRET` is a single key guarding three attack surfaces. Any exposure compromises all three.

**Action:**
1. Generate three new secrets: `openssl rand -base64 32` × 3
2. Set in all environments simultaneously (staging first, then production within same deploy window):
   - `TOKEN_ISSUE_SECRET` in cf-api and apps/web
   - `PAYMENT_RESULT_SECRET` in cf-commerce and cf-api
   - `PROMPTPAY_CREATE_SECRET` in cf-api and cf-commerce
3. Remove `INTERNAL_SECRET` from all environment configurations
4. Verify no service restarts with old secret references

**Acceptance criteria:** All three secrets present in all required services. `INTERNAL_SECRET` absent. Auth flows pass smoke test.

---

#### Phase 0.2 — Split INTERNAL_SECRET in Code

**Problem:** Code currently uses one `process.env.INTERNAL_SECRET` for all three uses.

**Files:**
- `apps/cf-api/src/infrastructure/middleware/verify-internal.middleware.ts`
- `apps/cf-api/src/routes/internal/issue-token.route.ts`
- `apps/cf-api/src/routes/internal/payment-result.route.ts`
- `apps/cf-commerce/src/infrastructure/middleware/verify-internal.middleware.ts`
- `apps/cf-commerce/src/routes/payment/promptpay.route.ts`
- `apps/web/src/lib/bridge.ts` (or wherever web calls the bridge)

**Implementation:**

```typescript
// apps/cf-api/src/routes/internal/issue-token.route.ts
const TOKEN_ISSUE_SECRET = process.env.TOKEN_ISSUE_SECRET
if (!TOKEN_ISSUE_SECRET) throw new Error("TOKEN_ISSUE_SECRET not set")

// Verify incoming request from apps/web
const provided = c.req.header("X-Internal-Secret")
if (!timingSafeEqual(TOKEN_ISSUE_SECRET, provided)) {
  return c.json({ error: "unauthorized" }, 401)
}
```

```typescript
// apps/cf-api/src/routes/internal/payment-result.route.ts
const PAYMENT_RESULT_SECRET = process.env.PAYMENT_RESULT_SECRET
if (!PAYMENT_RESULT_SECRET) throw new Error("PAYMENT_RESULT_SECRET not set")

const provided = c.req.header("X-Internal-Secret")
if (!timingSafeEqual(PAYMENT_RESULT_SECRET, provided)) {
  return c.json({ error: "unauthorized" }, 401)
}
```

```typescript
// apps/cf-commerce/src/routes/payment/promptpay.route.ts
const PROMPTPAY_CREATE_SECRET = process.env.PROMPTPAY_CREATE_SECRET
if (!PROMPTPAY_CREATE_SECRET) throw new Error("PROMPTPAY_CREATE_SECRET not set")

const provided = c.req.header("X-Internal-Secret")
if (!timingSafeEqual(PROMPTPAY_CREATE_SECRET, provided)) {
  return c.json({ error: "unauthorized" }, 401)
}
```

**Note on `timingSafeEqual`:** Use Node.js `crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))` to prevent timing attacks. Do not use `===` string comparison for secrets.

**Acceptance criteria:** All three internal routes verified with their specific secret. No route accepts any of the other secrets.

---

#### Phase 0.3 — Fix Rate Limit Fail-Closed

**Problem:** When Memcached is unavailable, the throttle middleware currently allows all requests through (fail-open). This defeats the purpose of rate limiting.

**File:** `apps/cf-api/src/infrastructure/middleware/throttle.middleware.ts`

**Implementation:**

```typescript
// apps/cf-api/src/infrastructure/middleware/throttle.middleware.ts

import { createMiddleware } from "hono/factory"
import type { MemcachedClient } from "../cache/memcached.client"

interface ThrottleOptions {
  limit: number       // Max requests per window
  windowMs: number    // Window size in milliseconds
  keyFn: (c: Context) => string  // Returns the rate limit key (e.g. IP or userId)
}

export function throttle(memcached: MemcachedClient, opts: ThrottleOptions) {
  return createMiddleware(async (c, next) => {
    const key = `rl:${opts.keyFn(c)}`
    const windowSec = Math.ceil(opts.windowMs / 1000)

    let count: number | null
    try {
      count = await memcached.increment(key, windowSec)
    } catch {
      count = null
    }

    if (count === null) {
      // FAIL CLOSED — Memcached unavailable
      // NEVER allow requests through when rate limiter is down
      // NEVER use per-instance in-memory fallback (horizontal scaling breaks limits)
      c.header("Retry-After", "60")
      return c.json({ error: "rate_limiter_unavailable" }, 503)
    }

    if (count > opts.limit) {
      c.header("X-RateLimit-Limit", String(opts.limit))
      c.header("X-RateLimit-Remaining", "0")
      return c.json({ error: "rate_limit_exceeded" }, 429)
    }

    c.header("X-RateLimit-Limit", String(opts.limit))
    c.header("X-RateLimit-Remaining", String(opts.limit - count))
    await next()
  })
}
```

**FORBIDDEN patterns:**
```typescript
// FORBIDDEN: fail-open
if (count === null) {
  await next()  // Attacker can abuse this by taking down Memcached
  return
}

// FORBIDDEN: per-instance in-memory fallback
if (count === null) {
  if (localBucket.consume()) await next()  // 10 instances × 10 req = 100 req effective limit
  else return c.json({ error: "rate_limit_exceeded" }, 429)
}
```

**Acceptance criteria:** When Memcached returns null/throws, ALL requests to rate-limited routes receive 503 with `Retry-After: 60`. Zero requests allowed through.

---

#### Phase 0.4 — Add Rate Limiting to cf-commerce

**Problem:** cf-commerce payment routes have no rate limiting despite being direct attack surface for payment fraud.

**File:** `apps/cf-commerce/src/app.ts` (or wherever cf-commerce routes are registered)

**Implementation:**

```typescript
// Apply throttle to all payment routes
app.use("/payment/*", throttle(memcached, {
  limit: 20,
  windowMs: 60_000,
  keyFn: (c) => {
    // Use authenticated userId if available, fall back to IP
    const payload = c.get("tokenPayload")
    return payload?.sub ?? c.req.header("CF-Connecting-IP") ?? "unknown"
  },
}))

// Tighter limit on PromptPay create (expensive operation)
app.use("/payment/promptpay/create", throttle(memcached, {
  limit: 5,
  windowMs: 60_000,
  keyFn: (c) => c.req.header("CF-Connecting-IP") ?? "unknown",
}))
```

**Acceptance criteria:** `POST /payment/promptpay/create` returns 429 after 5 requests within 60 seconds from same IP. Returns 503 when Memcached unavailable.

---

#### Phase 0.5 — Freeze Payouts with PAYOUTS_ENABLED Guard

**Problem:** Payout logic exists but Admin UI for reviewing payouts does not yet exist. Payouts must not execute until Phase 1.1 (Admin UI MVP) is complete and verified.

**File:** `apps/cf-api/src/routes/payouts/payout.route.ts` (or equivalent payout handler)

**Implementation:**

```typescript
// apps/cf-api/src/routes/payouts/payout.route.ts

payoutsRouter.post("/initiate", requireAuth, requirePrivileged, async (c) => {
  // PAYOUTS_ENABLED guard — DO NOT REMOVE until Admin UI verified in production
  if (process.env.PAYOUTS_ENABLED !== "true") {
    return c.json({
      error: "payouts_disabled",
      message: "Payout system is temporarily disabled pending admin review UI. Set PAYOUTS_ENABLED=true to enable.",
    }, 503)
  }

  // ... rest of payout logic
})
```

**Environment configuration:**
```
# All environments: default is false (safe)
PAYOUTS_ENABLED=false

# Set to true ONLY after Phase 1.1 Admin UI is deployed and verified in production
# PAYOUTS_ENABLED=true
```

**Acceptance criteria:** `POST /payouts/initiate` returns 503 with `payouts_disabled` error in all environments until explicitly enabled. Changing `PAYOUTS_ENABLED=true` (and redeploying) re-enables payouts without code change.

---

### PHASE 1 — Correctness & Visibility (Weeks 1–8, Two Parallel Tracks)

Phase 1 runs two tracks simultaneously. Track A (correctness) and Track B (admin UI) are independent and can be assigned to different engineers.

---

#### Phase 1.1 — Admin UI MVP (Track B, Weeks 1–4)

**Problem:** No admin interface exists for reviewing merchant applications, managing payouts, or KYC verification. Payouts are frozen (Phase 0.5) until this is built.

**Files to create:**
- `apps/web/src/app/(admin)/admin/layout.tsx`
- `apps/web/src/app/(admin)/admin/page.tsx`
- `apps/web/src/app/(admin)/admin/merchants/page.tsx`
- `apps/web/src/app/(admin)/admin/payouts/page.tsx`
- `apps/web/src/app/(admin)/admin/kyc/page.tsx`

**Route protection:**

```typescript
// apps/web/src/app/(admin)/admin/layout.tsx
import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()

  // Double-check: session role AND privileged token
  if (!session || session.user.role !== "admin") {
    redirect("/unauthorized")
  }

  return (
    <div className="admin-layout">
      <AdminNav />
      {children}
    </div>
  )
}
```

**Merchant listing page:**

```typescript
// apps/web/src/app/(admin)/admin/merchants/page.tsx
export default async function AdminMerchantsPage() {
  // Server Component — fetch with privileged token via bridge
  const merchants = await fetchWithPrivilegedToken("/admin/merchants")
  return <MerchantTable merchants={merchants} />
}
```

**Payout review page:**

```typescript
// apps/web/src/app/(admin)/admin/payouts/page.tsx
export default async function AdminPayoutsPage() {
  const pendingPayouts = await fetchWithPrivilegedToken("/admin/payouts?status=pending")
  return (
    <div>
      <PayoutTable payouts={pendingPayouts} />
      <ApprovePayoutButton />  {/* Client Component with optimistic update */}
    </div>
  )
}
```

**When complete:** Set `PAYOUTS_ENABLED=true` in production environment and redeploy. Phase 0.5 guard is then lifted by configuration, not code change.

**Acceptance criteria:** Admin can log in, view merchant list, view pending payouts, approve/reject payouts. Non-admin users receive 302 redirect to `/unauthorized`. Payouts re-enabled in production.

---

#### Phase 1.2 — Distributed Tracing with OpenTelemetry (Track A, Week 1)

**Problem:** No distributed trace IDs cross service boundaries. When a request fails, there is no way to correlate logs across cf-api → cf-commerce → Firebase.

**Files:**
- `packages/observability/src/tracer.ts` (new)
- `apps/cf-api/src/infrastructure/middleware/trace.middleware.ts` (new)
- `apps/cf-commerce/src/infrastructure/middleware/trace.middleware.ts` (new)

**Implementation:**

```typescript
// packages/observability/src/tracer.ts
import { trace, context, propagation, SpanStatusCode } from "@opentelemetry/api"
import { W3CTraceContextPropagator } from "@opentelemetry/core"

propagation.setGlobalPropagator(new W3CTraceContextPropagator())

export const tracer = trace.getTracer("fabric", "1.0.0")

export function generateTraceId(): string {
  return crypto.randomUUID().replace(/-/g, "")
}

export function withSpan<T>(
  name: string,
  fn: () => Promise<T>,
  attributes?: Record<string, string | number | boolean>
): Promise<T> {
  return tracer.startActiveSpan(name, { attributes }, async (span) => {
    try {
      const result = await fn()
      span.setStatus({ code: SpanStatusCode.OK })
      return result
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: String(err) })
      span.recordException(err as Error)
      throw err
    } finally {
      span.end()
    }
  })
}
```

```typescript
// apps/cf-api/src/infrastructure/middleware/trace.middleware.ts
import { createMiddleware } from "hono/factory"
import { generateTraceId } from "@fabric/observability"

export const traceMiddleware = createMiddleware(async (c, next) => {
  const traceId = c.req.header("X-Trace-ID") ?? generateTraceId()
  c.set("traceId", traceId)
  c.header("X-Trace-ID", traceId)

  // Propagate to outgoing requests via context
  const originalFetch = globalThis.fetch
  // ... propagation setup

  await next()
})
```

**Cross-service propagation:**
```typescript
// When cf-api calls cf-commerce
await fetch(`${CF_COMMERCE_URL}/events`, {
  headers: {
    "Content-Type": "application/json",
    "X-Trace-ID": c.get("traceId"),  // Propagate trace ID
  },
  body: JSON.stringify(payload),
})
```

**Acceptance criteria:** Every request to cf-api produces an `X-Trace-ID` header in the response. Same trace ID appears in cf-commerce logs when called by cf-api. Firebase Function logs include trace ID in structured log fields.

---

#### Phase 1.3 — RTDB Path Canonicalization (Track A, Week 1–2)

**Problem:** RTDB paths may use non-canonical names. Canonical paths are `/product_write` and `/product_read_model` (see Part I.2).

**Verification step (mandatory before any rename):**
```bash
# Search for old path names in all source files
grep -r "product_current\|products_current" apps/ packages/ --include="*.ts" --include="*.tsx"
```

**If grep finds matches:** Execute full rename procedure below.
**If grep finds zero matches:** Phase 1.3 is verification-only. Document in ADR that paths were already canonical.

**Full rename procedure (only if needed):**

```typescript
// Search and replace in all source files
// OLD: db.ref("/product_current")
// NEW: db.ref("/product_write")

// OLD: db.ref("/products_current")
// NEW: db.ref("/product_write")  (note: singular, not plural)

// OLD: db.ref("/product_read")
// NEW: db.ref("/product_read_model")
```

**Firebase RTDB security rules update:**
```json
{
  "rules": {
    "product_write": {
      "$productId": {
        ".read": "auth != null",
        ".write": "auth != null && root.child('users').child(auth.uid).child('role').val() === 'merchant'"
      }
    },
    "product_read_model": {
      "$productId": {
        ".read": true,
        ".write": false
      }
    },
    "event_outbox": {
      "$eventId": {
        ".read": "auth != null && root.child('users').child(auth.uid).child('role').val() === 'admin'",
        ".write": "auth != null"
      }
    },
    "event_dlq": {
      "$eventId": {
        ".read": "auth != null && root.child('users').child(auth.uid).child('role').val() === 'admin'",
        ".write": false
      }
    }
  }
}
```

**Data migration (if rename executed):** Firebase RTDB does not support path renames. A migration script must copy all data:
```typescript
// scripts/migrate-rtdb-paths.ts
const oldRef = db.ref("/product_current")
const newRef = db.ref("/product_write")
const snapshot = await oldRef.once("value")
if (snapshot.exists()) {
  await newRef.set(snapshot.val())
  // Verify new path before deleting old
  const verification = await newRef.once("value")
  if (verification.exists()) {
    await oldRef.remove()
    console.log(`Migrated ${Object.keys(snapshot.val()).length} products`)
  }
}
```

**Acceptance criteria:** Zero references to `/product_current` or `/products_current` in source code. RTDB security rules use canonical paths. Migration script either ran successfully or was not needed (paths already canonical).

---

#### Phase 1.4 — Branded Type Canonicalization (Track A, Week 2)

**Problem:** Branded types may use object wrapper shape `{ __brand: "X"; value: string }` which is not a string at runtime and requires `.value` accessor everywhere.

**File to create/rewrite:** `packages/types/src/kernel.ts`

**Implementation:**

```typescript
// packages/types/src/kernel.ts
// Canonical branded type pattern for entire Fabric codebase

/**
 * Intersection brand — the branded value IS the primitive at runtime.
 * No .value accessor needed. No wrapper object.
 * All branded IDs are still strings/numbers; branding is compile-time only.
 */
export type Brand<T, K extends string> = T & { readonly __brand: K }

// Domain ID types
export type ProductId   = Brand<string, "ProductId">
export type MerchantId  = Brand<string, "MerchantId">
export type OrderId     = Brand<string, "OrderId">
export type UserId      = Brand<string, "UserId">
export type CategoryId  = Brand<string, "CategoryId">
export type EventId     = Brand<string, "EventId">

// Currency type
export type CurrencyCode = Brand<string, "CurrencyCode">
export const THB = "THB" as CurrencyCode
export const USD = "USD" as CurrencyCode

// Constructor functions (type-safe casts, zero runtime overhead)
export const ProductId   = (s: string): ProductId   => s as ProductId
export const MerchantId  = (s: string): MerchantId  => s as MerchantId
export const OrderId     = (s: string): OrderId     => s as OrderId
export const UserId      = (s: string): UserId      => s as UserId
export const CategoryId  = (s: string): CategoryId  => s as CategoryId
export const EventId     = (s: string): EventId     => s as EventId
export const CurrencyCode = (s: string): CurrencyCode => s as CurrencyCode
```

**Migration: find and replace object wrapper usages:**
```bash
# Find all .value accessors on branded IDs (will show up as compilation errors after type change)
grep -r "\.value" apps/ packages/ --include="*.ts" --include="*.tsx" | grep -v "node_modules"
```

After changing the type, TypeScript compiler will fail on any `.value` access. Fix each: `someId.value` → `someId` (the branded type IS the string).

**Acceptance criteria:** Zero compilation errors after type change. Zero `.value` accessors on branded ID types. All domain code treats branded IDs as plain strings with compile-time safety.

---

#### Phase 1.5 — Fix Login Attempt Lockout (PostgreSQL)

**Problem:** Login attempt tracking stored in Firebase RTDB cannot use `SELECT FOR UPDATE` for atomic increment, risking race conditions under concurrent login attempts.

**Files:**
- `packages/db/migrations/YYYYMMDD_create_login_attempts.sql` (new)
- `apps/cf-api/src/infrastructure/auth/login-attempts.repository.ts` (new or rewrite)

**Migration:**
```sql
-- packages/db/migrations/YYYYMMDD_create_login_attempts.sql
CREATE TABLE login_attempts (
  email            TEXT PRIMARY KEY,
  attempt_count    INTEGER NOT NULL DEFAULT 0,
  first_attempt_at TIMESTAMP WITH TIME ZONE NOT NULL,
  locked_until     TIMESTAMP WITH TIME ZONE,
  updated_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_login_attempts_locked_until
  ON login_attempts (locked_until)
  WHERE locked_until IS NOT NULL;
```

**Repository:**
```typescript
// apps/cf-api/src/infrastructure/auth/login-attempts.repository.ts

interface LoginAttemptsRepository {
  recordFailedAttempt(email: string): Promise<{ isLocked: boolean; lockedUntil?: Date }>
  clearAttempts(email: string): Promise<void>
  isLocked(email: string): Promise<{ isLocked: boolean; lockedUntil?: Date }>
}

class PostgresLoginAttemptsRepository implements LoginAttemptsRepository {
  constructor(private db: DatabaseClient) {}

  async recordFailedAttempt(email: string): Promise<{ isLocked: boolean; lockedUntil?: Date }> {
    const MAX_ATTEMPTS = 5
    const WINDOW_MINUTES = 15
    const LOCKOUT_MINUTES = 30

    const result = await this.db.transaction(async (tx) => {
      // SELECT FOR UPDATE prevents race conditions
      const row = await tx.queryOne<LoginAttemptRow>(
        `SELECT * FROM login_attempts WHERE email = $1 FOR UPDATE`,
        [email]
      )

      const now = new Date()

      if (!row) {
        // First failure
        await tx.execute(
          `INSERT INTO login_attempts (email, attempt_count, first_attempt_at, updated_at)
           VALUES ($1, 1, $2, $2)`,
          [email, now]
        )
        return { isLocked: false }
      }

      // Reset window if expired
      const windowExpired =
        now.getTime() - row.first_attempt_at.getTime() > WINDOW_MINUTES * 60 * 1000
      const newCount = windowExpired ? 1 : row.attempt_count + 1
      const newFirstAttempt = windowExpired ? now : row.first_attempt_at

      let lockedUntil: Date | null = null
      if (newCount >= MAX_ATTEMPTS) {
        lockedUntil = new Date(now.getTime() + LOCKOUT_MINUTES * 60 * 1000)
      }

      await tx.execute(
        `UPDATE login_attempts
         SET attempt_count = $1, first_attempt_at = $2, locked_until = $3, updated_at = $4
         WHERE email = $5`,
        [newCount, newFirstAttempt, lockedUntil, now, email]
      )

      return {
        isLocked: lockedUntil !== null,
        lockedUntil: lockedUntil ?? undefined,
      }
    })

    return result
  }

  async clearAttempts(email: string): Promise<void> {
    await this.db.execute(`DELETE FROM login_attempts WHERE email = $1`, [email])
  }

  async isLocked(email: string): Promise<{ isLocked: boolean; lockedUntil?: Date }> {
    const row = await this.db.queryOne<LoginAttemptRow>(
      `SELECT locked_until FROM login_attempts WHERE email = $1`,
      [email]
    )
    if (!row?.locked_until) return { isLocked: false }
    const now = new Date()
    if (row.locked_until <= now) {
      await this.clearAttempts(email)
      return { isLocked: false }
    }
    return { isLocked: true, lockedUntil: row.locked_until }
  }
}
```

**Acceptance criteria:** 5 failed login attempts within 15 minutes locks account for 30 minutes. Concurrent login attempts (e.g. 10 simultaneous requests) result in exactly one winner incrementing first, no race conditions. Successful login clears attempt count.

---

#### Phase 1.6 — Role Source Disambiguation

**Problem:** Two sources of truth for user role: Firebase Auth custom claims AND PostgreSQL `users.role`. These can drift if one is updated without the other.

**Canonical rule (enforced after Phase 1.6):** `PostgreSQL users.role` is the ONLY authoritative source. Firebase Auth custom claims are read-only cache and must always be refreshed from PostgreSQL after any role change.

**Files:**
- `apps/cf-api/src/infrastructure/auth/role-sync.service.ts` (new)
- `apps/cf-api/src/routes/admin/update-role.route.ts` (update)

**Implementation:**

```typescript
// apps/cf-api/src/infrastructure/auth/role-sync.service.ts

class RoleSyncService {
  constructor(
    private db: DatabaseClient,
    private firebaseAuth: FirebaseAuth
  ) {}

  /**
   * Update user role in PostgreSQL (authoritative) and sync to Firebase custom claims.
   * ALWAYS call this instead of updating either source directly.
   */
  async updateRole(userId: UserId, newRole: UserRole): Promise<void> {
    // 1. Update PostgreSQL (authoritative)
    await this.db.execute(
      `UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2`,
      [newRole, userId]
    )

    // 2. Sync to Firebase custom claims (cache)
    await this.firebaseAuth.setCustomUserClaims(userId, { role: newRole })

    // Note: Existing privileged tokens expire in 2 minutes naturally.
    // No need to revoke tokens — the short TTL handles role propagation.
  }

  /**
   * Read role from PostgreSQL (authoritative). Never trust Firebase custom claims alone.
   */
  async getRole(userId: UserId): Promise<UserRole> {
    const row = await this.db.queryOne<{ role: UserRole }>(
      `SELECT role FROM users WHERE id = $1`,
      [userId]
    )
    if (!row) throw new Error(`User ${userId} not found`)
    return row.role
  }
}
```

**Token payload role source:**
```typescript
// apps/cf-api/src/routes/auth/login.route.ts
// When issuing tokens, always read role from PostgreSQL

const user = await db.queryOne(`SELECT id, email, role FROM users WHERE email = $1`, [email])
const payload: AccessTokenPayload = {
  sub: UserId(user.id),
  email: user.email,
  role: user.role,  // From PostgreSQL — never from Firebase custom claims
  scope: "standard",
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 900,
}
```

**Acceptance criteria:** Zero code paths read role from Firebase custom claims for authorization decisions. All role updates go through `RoleSyncService.updateRole()`. Admin role change reflected in new privileged tokens within 2 minutes (existing tokens expire).

---

#### Phase 1.7 — Documentation Corrections

**Problem:** Documentation contains errors that will mislead developers.

**Files to correct:**
- `apps/cf-api/cf-api.md` — change "30 days" to "7 days" (two occurrences)
- Any ADR, README, or doc file referencing `INTERNAL_SECRET` → update to three scoped secret names
- Any doc referencing the old RTDB path names → update to canonical names
- Any doc showing object wrapper branded type pattern → update to intersection brand

**Specific cf-api.md fix:**
```diff
- Refresh tokens are valid for 30 days.
+ Refresh tokens are valid for 7 days (604800 seconds).

- After rotating PASETO keys, wait at least 24 hours before removing the old key
- to allow refresh tokens to expire.
+ After rotating PASETO keys, wait at least 8 days (7-day refresh TTL + 1-day buffer)
+ before removing the old key. Removing earlier would force-logout users with valid
+ 7-day refresh tokens.
```

**Acceptance criteria:** `grep -r "30 days\|30-day" apps/cf-api/ docs/` returns zero results related to refresh token TTL. Documentation is internally consistent with Part I of this plan.

---

### PHASE 2 — Auth Hardening (Weeks 5–10)

---

#### Phase 2.1 — PASETO Key Management Infrastructure

**Problem:** PASETO keys may be hardcoded or stored insecurely. Key rotation has no documented procedure.

**Files:**
- `packages/auth/src/paseto/key-manager.ts` (new)
- `apps/cf-api/src/infrastructure/auth/paseto.service.ts` (update)

**Implementation:**

```typescript
// packages/auth/src/paseto/key-manager.ts

interface PasetoKeySet {
  current: {
    keyId: string
    key: Uint8Array
    createdAt: Date
  }
  previous?: {
    keyId: string
    key: Uint8Array
    createdAt: Date
    expiresAt: Date  // current.createdAt + 8 days
  }
}

class PasetoKeyManager {
  constructor(private secretStore: SecretStorePort) {}

  async getCurrentKeys(): Promise<PasetoKeySet> {
    const raw = await this.secretStore.get("PASETO_KEY_SET")
    return JSON.parse(raw) as PasetoKeySet
  }

  /**
   * Rotate keys. Previous key remains valid for 8 days.
   * PASETO v3.local uses symmetric key — generate with:
   * openssl rand -base64 32
   */
  async rotateKeys(): Promise<void> {
    const current = await this.getCurrentKeys()
    const newKey = await this.generateKey()
    const now = new Date()

    const newKeySet: PasetoKeySet = {
      current: {
        keyId: crypto.randomUUID(),
        key: newKey,
        createdAt: now,
      },
      previous: {
        ...current.current,
        expiresAt: new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000),  // 8 days
      },
    }

    await this.secretStore.set("PASETO_KEY_SET", JSON.stringify(newKeySet))
  }

  private async generateKey(): Promise<Uint8Array> {
    return crypto.getRandomValues(new Uint8Array(32))
  }
}
```

**Token verification with key fallback:**
```typescript
// apps/cf-api/src/infrastructure/auth/paseto.service.ts

async verifyToken(token: string): Promise<AccessTokenPayload> {
  const keySet = await this.keyManager.getCurrentKeys()

  // Try current key first
  try {
    return await this.decryptWithKey(token, keySet.current.key)
  } catch {
    // Try previous key (for tokens issued before rotation)
    if (keySet.previous && new Date() < keySet.previous.expiresAt) {
      return await this.decryptWithKey(token, keySet.previous.key)
    }
    throw new TokenVerificationError("Invalid or expired token")
  }
}
```

**Acceptance criteria:** Key rotation procedure documented. Previous key accepted for 8 days after rotation. After 8 days, previous key automatically rejected. No service downtime during rotation.

---

#### Phase 2.2 — Add Scope Field to PASETO Tokens

**Problem:** Standard and privileged tokens are indistinguishable. Merchant/admin routes cannot verify the caller used the privileged token flow.

**Files:**
- `packages/auth/src/paseto/token.types.ts` (update)
- `apps/cf-api/src/routes/auth/login.route.ts` (update)
- `apps/cf-api/src/routes/internal/issue-token.route.ts` (update)
- `apps/cf-api/src/infrastructure/middleware/require-privileged.middleware.ts` (new)

**Token type update:**
```typescript
// packages/auth/src/paseto/token.types.ts

export interface AccessTokenPayload {
  sub:   UserId
  email: string
  role:  UserRole
  scope: "standard" | "privileged"  // NEW — required field
  iat:   number
  exp:   number
}

export interface RefreshTokenPayload {
  sub:      UserId
  tokenId:  string   // Unique per refresh token, for future revocation
  iat:      number
  exp:      number
}
```

**Login route — always issues standard:**
```typescript
// apps/cf-api/src/routes/auth/login.route.ts

const accessTokenPayload: AccessTokenPayload = {
  sub:   UserId(user.id),
  email: user.email,
  role:  user.role,
  scope: "standard",           // ALWAYS standard from login
  iat:   nowSec,
  exp:   nowSec + 900,         // 15 minutes
}
```

**Issue-token bridge — always issues privileged:**
```typescript
// apps/cf-api/src/routes/internal/issue-token.route.ts

const accessTokenPayload: AccessTokenPayload = {
  sub:   UserId(user.id),
  email: user.email,
  role:  user.role,
  scope: "privileged",         // ALWAYS privileged from bridge
  iat:   nowSec,
  exp:   nowSec + 120,         // 2 minutes ONLY
}
```

**Require-privileged middleware:**
```typescript
// apps/cf-api/src/infrastructure/middleware/require-privileged.middleware.ts

import { createMiddleware } from "hono/factory"

/**
 * Use AFTER requireAuth. Rejects requests with standard-scope tokens.
 * Apply to all merchant and admin routes.
 */
export const requirePrivileged = createMiddleware(async (c, next) => {
  const payload = c.get("tokenPayload") as AccessTokenPayload | undefined

  if (!payload) {
    return c.json({ error: "unauthorized", reason: "no_token" }, 401)
  }

  if (payload.scope !== "privileged") {
    return c.json({
      error: "forbidden",
      reason: "privileged_token_required",
      message: "This endpoint requires a privileged token. Obtain one via the /internal/issue-token bridge.",
    }, 403)
  }

  await next()
})

// Usage:
// app.use("/merchant/*", requireAuth, requirePrivileged)
// app.use("/admin/*", requireAuth, requirePrivileged)
```

**Acceptance criteria:** Login endpoint returns tokens with `scope: "standard"`. Bridge endpoint returns tokens with `scope: "privileged"`. Merchant routes return 403 with `privileged_token_required` when called with standard token. Standard routes accept both scopes.

---

#### Phase 2.3 — apps/web Bridge Integration

**Problem:** apps/web Server Components must call `/internal/issue-token` to obtain privileged tokens for merchant/admin API calls.

**File:** `apps/web/src/lib/privileged-fetch.ts` (new)

**Implementation:**

```typescript
// apps/web/src/lib/privileged-fetch.ts
// Server-side ONLY. Do NOT import in client components.

import { cookies } from "next/headers"

const CF_API_URL = process.env.CF_API_URL!
const TOKEN_ISSUE_SECRET = process.env.TOKEN_ISSUE_SECRET!

if (!CF_API_URL) throw new Error("CF_API_URL not set")
if (!TOKEN_ISSUE_SECRET) throw new Error("TOKEN_ISSUE_SECRET not set")

/**
 * Obtain a 2-minute privileged token from the bridge.
 * Call once per Server Component render — the token fits the Next.js per-request lifecycle.
 */
async function issuePrivilegedToken(refreshToken: string): Promise<string> {
  const response = await fetch(`${CF_API_URL}/internal/issue-token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Secret": TOKEN_ISSUE_SECRET,
    },
    body: JSON.stringify({ refreshToken }),
    // No cache — always fresh token
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error(`Failed to issue privileged token: ${response.status}`)
  }

  const { accessToken } = await response.json()
  return accessToken
}

/**
 * Authenticated fetch for merchant/admin Server Components.
 * Automatically obtains a privileged token from the bridge.
 *
 * Usage:
 *   const data = await privilegedFetch("/merchant/products")
 */
export async function privilegedFetch(path: string, init?: RequestInit): Promise<Response> {
  const cookieStore = await cookies()
  const refreshToken = cookieStore.get("refresh_token")?.value

  if (!refreshToken) {
    throw new Error("No refresh token in cookies — user must be logged in")
  }

  const privilegedToken = await issuePrivilegedToken(refreshToken)

  return fetch(`${CF_API_URL}${path}`, {
    ...init,
    headers: {
      ...init?.headers,
      "Authorization": `Bearer ${privilegedToken}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  })
}
```

**Usage in Server Component:**
```typescript
// apps/web/src/app/(merchant)/merchant/products/page.tsx
import { privilegedFetch } from "@/lib/privileged-fetch"

export default async function MerchantProductsPage() {
  const response = await privilegedFetch("/merchant/products")
  if (!response.ok) redirect("/login")
  const products = await response.json()
  return <ProductList products={products} />
}
```

**Acceptance criteria:** Merchant Server Components successfully call cf-api merchant routes. Standard-token cached fetch does NOT work for merchant routes. Bridge issues new 2-minute token per render. Token is never exposed to client.

---

#### Phase 2.4 — NDID KYC Integration (Replace Placeholder)

**Problem:** Placeholder KYC implementation exists. Must use NDID (Thai National Digital ID) — the correct provider for Thai market. Do NOT use US-centric providers like BlueDot or IDWall.

**Files:**
- `apps/cf-api/src/infrastructure/kyc/ndid-kyc.adapter.ts` (new)
- `apps/cf-api/src/application/ports/kyc.port.ts` (update or create)

**Port definition:**
```typescript
// apps/cf-api/src/application/ports/kyc.port.ts

export interface KycVerificationRequest {
  userId: UserId
  nationalId: string      // Thai national ID number (13 digits)
  firstName: string       // Thai first name
  lastName: string        // Thai last name
  dateOfBirth: string     // ISO date string
}

export interface KycVerificationResult {
  verified: boolean
  verificationId: string  // NDID reference ID
  verifiedAt?: Date
  rejectionReason?: string
}

export interface KycPort {
  initiateVerification(req: KycVerificationRequest): Promise<KycVerificationResult>
  checkVerificationStatus(verificationId: string): Promise<KycVerificationResult>
}
```

**NDID Adapter:**
```typescript
// apps/cf-api/src/infrastructure/kyc/ndid-kyc.adapter.ts

class NdidKycAdapter implements KycPort {
  constructor(
    private ndidApiUrl: string,    // process.env.NDID_API_URL
    private ndidApiKey: string     // process.env.NDID_API_KEY
  ) {}

  async initiateVerification(req: KycVerificationRequest): Promise<KycVerificationResult> {
    const response = await fetch(`${this.ndidApiUrl}/v1/identity/verify`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.ndidApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        citizen_id: req.nationalId,
        first_name: req.firstName,
        last_name: req.lastName,
        date_of_birth: req.dateOfBirth,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new KycError(`NDID verification failed: ${error.message}`)
    }

    const data = await response.json()
    return {
      verified: data.status === "verified",
      verificationId: data.reference_id,
      verifiedAt: data.verified_at ? new Date(data.verified_at) : undefined,
      rejectionReason: data.rejection_reason,
    }
  }

  async checkVerificationStatus(verificationId: string): Promise<KycVerificationResult> {
    const response = await fetch(
      `${this.ndidApiUrl}/v1/identity/verify/${verificationId}`,
      { headers: { "Authorization": `Bearer ${this.ndidApiKey}` } }
    )
    const data = await response.json()
    return {
      verified: data.status === "verified",
      verificationId: data.reference_id,
      verifiedAt: data.verified_at ? new Date(data.verified_at) : undefined,
    }
  }
}
```

**Acceptance criteria:** KYC flow uses NDID API. Zero references to BlueDot, IDWall, or other non-Thai KYC providers. National ID validation enforces 13-digit Thai format.

---

#### Phase 2.5 — Merchant Stripe Subscription Hardening

**Problem:** Stripe webhook handling may have gaps in idempotency or event verification.

**File:** `apps/cf-api/src/infrastructure/billing/stripe-webhook.handler.ts`

**Implementation:**
```typescript
// apps/cf-api/src/infrastructure/billing/stripe-webhook.handler.ts

class StripeWebhookHandler {
  constructor(
    private stripe: Stripe,
    private db: DatabaseClient,
    private webhookSecret: string  // process.env.STRIPE_WEBHOOK_SECRET
  ) {}

  async handleWebhook(rawBody: string, signature: string): Promise<void> {
    // 1. Verify Stripe signature (prevents spoofed webhooks)
    let event: Stripe.Event
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret)
    } catch {
      throw new WebhookVerificationError("Invalid Stripe signature")
    }

    // 2. Idempotency check — Stripe may deliver same event multiple times
    const existing = await this.db.queryOne(
      `SELECT id FROM processed_stripe_events WHERE stripe_event_id = $1`,
      [event.id]
    )
    if (existing) return  // Already processed

    // 3. Process event in transaction
    await this.db.transaction(async (tx) => {
      await this.processEvent(event, tx)
      await tx.execute(
        `INSERT INTO processed_stripe_events (stripe_event_id, processed_at)
         VALUES ($1, NOW())`,
        [event.id]
      )
    })
  }
}
```

**Acceptance criteria:** Duplicate Stripe webhook events are idempotent. Invalid signatures return 400. All subscription state changes persisted in PostgreSQL.

---

#### Phase 2.6 — Atom Patterns Audit

**Problem:** `@effect-atom/atom-react` has three distinct atom patterns, each with specific lifecycle rules. Incorrect pattern choice causes subtle bugs.

---

##### Phase 2.6a — Atom Pattern Inventory

**Audit all atoms in `apps/web/src/application/atoms/`**

For each atom, classify:
1. **Static atoms** — initial value known at module load time. No keepAlive needed unless shared across components.
2. **Dynamic atoms** — initial value requires async fetch or comes from server props. Always consider keepAlive.
3. **Derived atoms** — computed from other atoms. GC behaviour follows the atom they derive from.

---

##### Phase 2.6b — Atom.keepAlive() Fix (REQUIRED, Not Optional)

**Problem:** Atoms seeded in `useLayoutEffect` are at risk of GC between the layout effect seed and the passive effect subscription. The `@effect-atom/atom-react` documentation explicitly calls this out as the most critical lifecycle rule.

**Rule of thumb for when `Atom.keepAlive()` is REQUIRED:**
> If an atom's initial value is set in `useLayoutEffect` OR if the atom is shared across sibling components where one seeds it before the other subscribes, wrap it with `Atom.keepAlive()`.

**Files to update:**
- `apps/web/src/application/atoms/merchant-products.atoms.ts`
- Any other atoms seeded in `useLayoutEffect` found during Phase 2.6a audit

**Implementation:**

```typescript
// apps/web/src/application/atoms/merchant-products.atoms.ts

import { Atom } from "@effect-atom/atom-react"
import type { MerchantProduct } from "@fabric/types"

// ❌ WRONG — atom will be GC'd between useLayoutEffect seed and passive subscription
// export const merchantAllProductsAtom = Atom.make<MerchantProduct[]>([])

// ✅ CORRECT — keepAlive prevents GC until the component tree unmounts
export const merchantAllProductsAtom = Atom.keepAlive(
  Atom.make<MerchantProduct[]>([])
)

export const merchantManualResultsAtom = Atom.keepAlive(
  Atom.make<MerchantProduct[]>([])
)

// Derived atom — follows merchantAllProductsAtom lifecycle
export const merchantProductCountAtom = Atom.derive(
  [merchantAllProductsAtom],
  (products) => products.length
)
```

**Seed pattern (component using the atom):**
```typescript
// apps/web/src/components/merchant/ProductList.tsx
"use client"

import { useAtom, useAtomSetter } from "@effect-atom/atom-react"
import { merchantAllProductsAtom } from "@/application/atoms/merchant-products.atoms"

function ProductListSeeder({ initialProducts }: { initialProducts: MerchantProduct[] }) {
  const setProducts = useAtomSetter(merchantAllProductsAtom)

  useLayoutEffect(() => {
    // Safe to seed in useLayoutEffect — keepAlive prevents GC
    setProducts(initialProducts)
  }, [initialProducts, setProducts])

  return null
}

function ProductList() {
  const products = useAtom(merchantAllProductsAtom)  // Subscribe after seed
  return <ul>{products.map(p => <li key={p.id}>{p.name}</li>)}</ul>
}
```

**Acceptance criteria:** Zero atoms seeded in `useLayoutEffect` without `Atom.keepAlive()` wrapping. Audit checklist completed for all atoms in `apps/web/src/application/atoms/`. No UI flickers or empty-state flashes due to atom GC during component mounting.

---

### PHASE 3 — Remove Over-Engineering (Weeks 9–16)

Phase 3 removes three architectural patterns that add complexity without proportional benefit. Order matters: Free Monad first, then Command Pattern, then kernel.ts cleanup.

---

#### Phase 3.1 — Remove Free Monad (EventOp<A>)

**Problem:** `EventOp<A>` is a Free Monad — a pure data structure describing event-handling programs, interpreted at the edge. It exists to support dry-run mode (in-memory Maps instead of Firebase). This is over-engineering: dry-run can be achieved with a simple boolean flag and dependency injection.

**Files to DELETE:**
```
apps/cf-commerce/src/events/free/event-op.ts
apps/cf-commerce/src/events/free/interpreter.ts
apps/cf-commerce/src/events/free/dry-run-interpreter.ts
apps/cf-commerce/src/events/free/  (entire directory)
```

**Replacement pattern — plain async function with injected repository:**

```typescript
// apps/cf-commerce/src/events/event-handler.ts
// BEFORE (Free Monad):
// const program: EventOp<void> = pipe(
//   EventOp.readEvent(eventId),
//   EventOp.flatMap(event => EventOp.writeCounter(event.merchantId, 1)),
//   EventOp.flatMap(() => EventOp.publishToOutbox(eventId))
// )
// await interpret(program, firebaseInterpreter)

// AFTER (plain async with injected repo):
class EventHandler {
  constructor(private eventRepo: EventRepositoryPort) {}

  async handleOrderCompleted(event: OrderCompletedEvent): Promise<void> {
    await this.eventRepo.incrementRevenueCounter(event.merchantId, event.amount)
    await this.eventRepo.writeToOutbox(event)
  }
}

// For tests — inject in-memory repo (no Free Monad needed):
const handler = new EventHandler(new InMemoryEventRepository())
await handler.handleOrderCompleted(testEvent)
```

**EventRepositoryPort:**
```typescript
// apps/cf-commerce/src/events/ports/event-repository.port.ts
interface EventRepositoryPort {
  incrementRevenueCounter(merchantId: MerchantId, amount: ProductPrice): Promise<void>
  writeToOutbox(event: DomainEvent): Promise<void>
  readOutboxEvents(limit: number): Promise<DomainEvent[]>
}

// Production implementation:
class FirebaseEventRepository implements EventRepositoryPort {
  async writeToOutbox(event: DomainEvent): Promise<void> {
    const eventId = EventId(crypto.randomUUID())
    await db.ref(`/event_outbox/${eventId}`).set({
      event,
      attempts: 0,
      createdAt: new Date().toISOString(),
    })
  }
}

// Test implementation:
class InMemoryEventRepository implements EventRepositoryPort {
  private outbox: DomainEvent[] = []
  private counters = new Map<string, number>()

  async writeToOutbox(event: DomainEvent): Promise<void> {
    this.outbox.push(event)
  }
}
```

**Acceptance criteria:** Zero references to `EventOp`, `Free`, `interpret`, `FreeMonad` in `apps/cf-commerce/src/events/`. All event handling uses plain async functions with injected repository. Test coverage maintained — tests now use `InMemoryEventRepository` directly.

---

#### Phase 3.2 — Remove Command Pattern

**Problem:** `PaymentCommand[]` separates payment logic (pure) from execution but has exactly one call site. The separation adds 3 files of indirection with no benefit.

**Files to DELETE:**
```
apps/cf-commerce/src/payment/domain/payment.commands.ts
apps/cf-commerce/src/payment/logic/process-payment.logic.ts
apps/cf-commerce/src/payment/interpreter/payment.interpreter.ts
apps/cf-commerce/src/payment/adapters/mock-payment-gateway.ts  → move to test/fixtures/
apps/cf-commerce/src/payment/adapters/mock-payment-repo.ts     → move to test/fixtures/
```

**Replacement — PaymentService:**
```typescript
// apps/cf-commerce/src/payment/payment.service.ts

export type PaymentError =
  | { type: "insufficient_funds" }
  | { type: "card_declined"; code: string }
  | { type: "gateway_unavailable" }
  | { type: "invalid_payment_method" }
  | { type: "order_already_paid" }

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E }

class PaymentService {
  constructor(
    private gateway: PaymentGatewayPort,
    private paymentRepo: PaymentRepoPort,
    private cfApiUrl: string,
    private paymentResultSecret: string
  ) {}

  async processPayment(
    order: Order,
    request: PaymentRequest
  ): Promise<Result<PaymentResult, PaymentError>> {
    // 1. Check idempotency
    const existing = await this.paymentRepo.findByOrderId(order.id)
    if (existing?.status === "completed") {
      return { ok: false, error: { type: "order_already_paid" } }
    }

    // 2. Call payment gateway
    const gatewayResult = await this.gateway.charge({
      amount: request.price.cents,
      currency: request.price.currency,
      paymentMethodId: request.paymentMethodId,
      orderId: order.id,
    })

    if (!gatewayResult.success) {
      return { ok: false, error: this.mapGatewayError(gatewayResult.errorCode) }
    }

    // 3. Persist result
    const paymentRecord = await this.paymentRepo.create({
      orderId: order.id,
      merchantId: order.merchantId,
      amount: request.price,
      gatewayTransactionId: gatewayResult.transactionId,
      status: "completed",
      paidAt: new Date(),
    })

    // 4. Notify cf-api (fire with outbox guarantee — see Phase 4.1)
    await this.notifyCfApi(paymentRecord)

    return { ok: true, value: { paymentRecord, transactionId: gatewayResult.transactionId } }
  }

  private async notifyCfApi(payment: PaymentRecord): Promise<void> {
    await fetch(`${this.cfApiUrl}/internal/payment-result`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Secret": this.paymentResultSecret,
      },
      body: JSON.stringify({
        orderId: payment.orderId,
        merchantId: payment.merchantId,
        amount: payment.amount,
        transactionId: payment.gatewayTransactionId,
        status: payment.status,
      }),
      signal: AbortSignal.timeout(5_000),
    })
  }

  private mapGatewayError(code: string): PaymentError {
    const mapping: Record<string, PaymentError> = {
      "insufficient_funds": { type: "insufficient_funds" },
      "card_declined":      { type: "card_declined", code },
      "gateway_error":      { type: "gateway_unavailable" },
    }
    return mapping[code] ?? { type: "gateway_unavailable" }
  }
}
```

**Acceptance criteria:** Zero references to `PaymentCommand`, `executeCommands`, `interpret` in `apps/cf-commerce/src/payment/`. `PaymentService` has full test coverage using mock implementations from `test/fixtures/`. Railway-Oriented Programming (Either pipeline for checkout) is PRESERVED — this phase only removes the Command Pattern wrapper around payment execution.

---

#### Phase 3.3 — Simplify Hexagonal Architecture Boundaries

**Problem:** Hexagonal architecture is correctly applied but some port/adapter boundaries are excessively thin — single-method ports that could be merged, or adapters that add zero behaviour.

**Instruction:** Do NOT remove hexagonal architecture wholesale. It is appropriate for the domain complexity. Instead:
1. Merge ports that always appear together (e.g., `ProductReadPort` + `ProductWritePort` → `ProductRepositoryPort` if they share the same adapter)
2. Delete adapters that are pure pass-through with zero logic (the port itself is sufficient)
3. Preserve all ports where the adapter has real behaviour (auth, payment, KYC, Firebase RTDB)

**Acceptance criteria:** Port count reduced by merging pure pass-through pairs. No real behaviour is lost. Dependency injection still works via port interfaces.

---

#### Phase 3.4 — Consolidate FP Libraries

**Problem:** Three FP libraries coexist: `packages/types/src/kernel.ts` (custom), `effect-ts`, and `@effect-atom/atom-react`. This creates inconsistent patterns across the codebase.

**Resolution:**
- `@effect-atom/atom-react` — **KEEP** for React state management (no alternative in scope)
- `effect-ts` — **KEEP** for Schema parsing from untrusted input (JSON validation). Use `Schema.parse` at boundaries only.
- `packages/types/src/kernel.ts` — **KEEP** but slim down (see Phase 3.5). Remove all Effect-ts re-exports and custom typeclasses.
- `pipe`, `Either`, `Option` — **STANDARDIZE** on a single lightweight implementation. Recommended: `fp-ts/lib/Either` + `fp-ts/lib/pipe` OR inline the 20-line Either implementation from `kernel.ts`. Choose one and remove the other.

**Forbidden after Phase 3.4:**
```typescript
// FORBIDDEN: mixing Either from two different libraries in same file
import { Either } from "effect"            // effect-ts Either
import { Either } from "fp-ts/lib/Either"  // fp-ts Either
// Pick one, use everywhere
```

**Acceptance criteria:** Exactly one Either/pipe library imported in any given file. `effect-ts` usage confined to Schema parsing at service boundaries. No custom typeclass implementations (`Functor`, `Monad`, `Applicative` etc.) in `kernel.ts`.

---

#### Phase 3.5 — Slim kernel.ts (After Free Monad Removed)

**Problem:** After Phase 3.1 (Free Monad removal), `kernel.ts` no longer needs HKT machinery (`Kind`, `URIS`, etc.) that supported the Free Monad.

**SEQUENCE CONSTRAINT:** Phase 3.5 MUST come after Phase 3.1. Deleting HKT types while Free Monad code still exists → compilation failure.

**File:** `packages/types/src/kernel.ts`

**Items to DELETE from kernel.ts after Phase 3.1:**
- `Kind<F, A>` and HKT infrastructure
- `URIS` registry type
- `Functor<F>`, `Monad<F>`, `Applicative<F>` typeclass interfaces
- Any `Free<F, A>` or `Coyoneda` types
- Effect-ts re-exports (use effect-ts directly where needed)

**Items to KEEP in kernel.ts:**
- `Brand<T, K>` and all branded ID types (see Phase 1.4)
- `ProductPrice` interface and `ProductPrice` namespace (or move to `product-price.ts`)
- `UserRole`, `CurrencyCode`, and other domain enums
- `Result<T, E>` type (either inline or re-exported from chosen Either library)

**Acceptance criteria:** kernel.ts compiles after Phase 3.1. Zero HKT or typeclass code remains. File is under 100 lines. All domain types still exported correctly.

---

### PHASE 4 — Reliability (Weeks 13–22)

---

#### Phase 4.1 — RTDB Outbox + onCreate Trigger

**Problem:** Revenue counter updates sent from cf-commerce to cf-api via direct HTTP. If cf-commerce crashes after payment but before notification, revenue is never recorded (fire-and-forget).

**Files to create:**
- `apps/cf-api/functions/event-relay.function.ts` (new Cloud Function)

**Implementation:**

```typescript
// apps/cf-api/functions/event-relay.function.ts

import * as functions from "firebase-functions/v2"
import * as admin from "firebase-admin"

const db = admin.database()

export const relayEvent = functions.database
  .ref("/event_outbox/{eventId}")
  .onCreate(async (snapshot, context) => {
    const eventId = context.params.eventId
    const record = snapshot.val() as {
      event: DomainEvent
      attempts: number
      createdAt: string
    }

    const CF_COMMERCE_URL = process.env.CF_COMMERCE_URL
    if (!CF_COMMERCE_URL) throw new Error("CF_COMMERCE_URL not set in function environment")

    try {
      const response = await fetch(`${CF_COMMERCE_URL}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(record.event),
        signal: AbortSignal.timeout(10_000),
      })

      if (!response.ok) {
        throw new Error(`cf-commerce returned ${response.status}`)
      }

      // SUCCESS: delete from outbox (atomically)
      await snapshot.ref.remove()
    } catch (err) {
      const attempts = (record.attempts ?? 0) + 1

      if (attempts >= 10) {
        // MAX RETRIES EXCEEDED: move to DLQ
        await db.ref(`/event_dlq/${eventId}`).set({
          ...record,
          attempts,
          failedAt: new Date().toISOString(),
          lastError: String(err),
        })
        await snapshot.ref.remove()
        console.error(`Event ${eventId} moved to DLQ after ${attempts} attempts`, err)
        return  // Do NOT throw — stops retry loop
      }

      // RETRY: increment attempts and throw (Cloud Functions exponential backoff)
      await snapshot.ref.update({ attempts })
      throw err  // Cloud Functions will retry with exponential backoff
    }
  })
```

**Outbox write from cf-commerce (payment completion):**
```typescript
// apps/cf-commerce/src/events/firebase-event-repository.ts

async writeToOutbox(event: DomainEvent): Promise<void> {
  const eventId = EventId(crypto.randomUUID())
  // Write is atomic — either the payment AND the outbox entry persist, or neither does
  await db.ref(`/event_outbox/${eventId}`).set({
    event,
    attempts: 0,
    createdAt: new Date().toISOString(),
  })
  // The onCreate trigger fires automatically — no manual polling needed
}
```

**DLQ monitor (admin route):**
```typescript
// apps/cf-api/src/routes/admin/dlq.route.ts

adminRouter.get("/dlq", requireAuth, requirePrivileged, async (c) => {
  const snapshot = await db.ref("/event_dlq").limitToFirst(100).once("value")
  const dlqEvents = snapshot.val() ?? {}
  return c.json({ events: Object.entries(dlqEvents).map(([id, v]) => ({ id, ...v })) })
})

adminRouter.post("/dlq/:eventId/reprocess", requireAuth, requirePrivileged, async (c) => {
  const { eventId } = c.req.param()
  const snapshot = await db.ref(`/event_dlq/${eventId}`).once("value")
  if (!snapshot.exists()) return c.json({ error: "not_found" }, 404)

  // Move back to outbox (triggers relay)
  await db.ref(`/event_outbox/${eventId}`).set({ ...snapshot.val(), attempts: 0 })
  await snapshot.ref.remove()
  return c.json({ requeued: true })
})
```

**Acceptance criteria:** Payment completion writes event to `/event_outbox`. onCreate trigger fires within 1 second. On cf-commerce failure, event remains in outbox and is retried. After 10 failures, event moves to `/event_dlq`. DLQ events visible in admin UI. Revenue counters never lost after payment confirmation.

---

#### Phase 4.2 — Daily Revenue Reconciliation

**Problem:** Even with the outbox pattern, revenue counters should be periodically verified against actual payment records to catch any discrepancy.

**File:** `apps/cf-api/functions/revenue-reconciliation.function.ts` (new)

**Implementation:**
```typescript
// apps/cf-api/functions/revenue-reconciliation.function.ts

export const dailyRevenueReconciliation = functions.scheduler
  .onSchedule("0 2 * * *", async () => {  // 2 AM daily (UTC+7 = 9 AM Bangkok)
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    yesterday.setHours(0, 0, 0, 0)

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // 1. Sum actual payments from PostgreSQL (source of truth)
    const actualRevenue = await db.queryOne<{ total: number; merchant_id: string }[]>(
      `SELECT merchant_id, SUM(amount_cents) as total
       FROM payments
       WHERE status = 'completed'
         AND paid_at >= $1 AND paid_at < $2
       GROUP BY merchant_id`,
      [yesterday, today]
    )

    // 2. Read RTDB revenue counters
    const snapshot = await rtdb.ref("/revenue_counters").once("value")
    const counters = snapshot.val() ?? {}

    // 3. Compare and alert on discrepancy
    for (const { merchant_id, total } of actualRevenue) {
      const rtdbTotal = counters[merchant_id]?.yesterday ?? 0
      const discrepancy = Math.abs(total - rtdbTotal)
      if (discrepancy > 0) {
        console.error(`Revenue discrepancy for merchant ${merchant_id}:`, {
          postgresql: total,
          rtdb: rtdbTotal,
          discrepancy,
        })
        // TODO: Phase 4.2b — send alert to admin Slack/email
      }
    }
  })
```

**Acceptance criteria:** Reconciliation runs daily. Discrepancies > 0 produce structured error logs. DLQ checked as part of reconciliation.

---

#### Phase 4.3 — Checkout Railway-Oriented Programming Preservation

**Problem:** The Railway-Oriented Programming pattern using `Either<PricingError, T>` pipeline for checkout is a GOOD pattern that must NOT be removed during Phase 3.

**This phase is a verification checkpoint — no code change required.**

**Verify these patterns are preserved:**
```typescript
// apps/cf-commerce/src/checkout/checkout.service.ts
// These Either pipelines should exist unchanged after all Phase 3 work:

const result = pipe(
  order,
  Either.flatMap(validateInventory),      // Right<Order> | Left<OutOfStockError>
  Either.flatMap(applyDiscounts),          // Right<PricedOrder> | Left<InvalidDiscountError>
  Either.flatMap(calculateTax),            // Right<TaxedOrder> | Left<TaxCalculationError>
  Either.flatMap(validatePaymentMethod),   // Right<ValidatedOrder> | Left<PaymentMethodError>
)

// 13 error variants known at compile time:
type PricingError =
  | { type: "out_of_stock"; productId: ProductId; available: number }
  | { type: "invalid_discount"; code: string; reason: string }
  | { type: "tax_calculation_failed"; region: string }
  | { type: "payment_method_invalid"; reason: string }
  | { type: "minimum_order_not_met"; minimum: ProductPrice; actual: ProductPrice }
  // ... 8 more variants
```

**Acceptance criteria:** `grep -r "pipe\|Either.flatMap" apps/cf-commerce/src/checkout/` still returns meaningful results. All 13 PricingError variants still compile. No checkout logic has been accidentally removed during Phase 3 cleanup.

---

#### Phase 4.4 — PostgreSQL Migration for SSE Data

**Problem:** SSE resume requires compound queries (`occurredAt > X AND userId = Y`). Firebase RTDB only supports single-field ordering. SSE resume is impossible on RTDB.

**SEQUENCE CONSTRAINT:** Phase 4.5 (SSE resume) MUST come after Phase 4.4.

**Files:**
- `packages/db/migrations/YYYYMMDD_create_events_table.sql` (new)
- `apps/cf-api/src/infrastructure/events/postgres-event-store.ts` (new)

**Migration:**
```sql
-- packages/db/migrations/YYYYMMDD_create_events_table.sql

CREATE TABLE domain_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type   TEXT NOT NULL,
  merchant_id  TEXT NOT NULL,
  user_id      TEXT,
  payload      JSONB NOT NULL,
  occurred_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  processed    BOOLEAN NOT NULL DEFAULT false
);

-- Compound index — enables "events after timestamp for user" queries
CREATE INDEX idx_domain_events_user_time
  ON domain_events (user_id, occurred_at DESC)
  WHERE user_id IS NOT NULL;

CREATE INDEX idx_domain_events_merchant_time
  ON domain_events (merchant_id, occurred_at DESC);

-- Retention: delete events older than 30 days
CREATE INDEX idx_domain_events_occurred_at ON domain_events (occurred_at);
```

**Event store:**
```typescript
// apps/cf-api/src/infrastructure/events/postgres-event-store.ts

class PostgresEventStore {
  constructor(private db: DatabaseClient) {}

  async getEventsAfter(
    userId: UserId,
    afterEventId: string,  // Last-Event-ID from SSE client
    limit = 50
  ): Promise<DomainEvent[]> {
    // Get the timestamp of the last known event
    const anchor = await this.db.queryOne<{ occurred_at: Date }>(
      `SELECT occurred_at FROM domain_events WHERE id = $1`,
      [afterEventId]
    )

    if (!anchor) {
      // Unknown anchor — return latest N events for safety
      return this.getLatestEvents(userId, limit)
    }

    // Compound query — impossible on RTDB, trivial on PostgreSQL
    return this.db.query<DomainEvent>(
      `SELECT * FROM domain_events
       WHERE user_id = $1 AND occurred_at > $2
       ORDER BY occurred_at ASC
       LIMIT $3`,
      [userId, anchor.occurred_at, limit]
    )
  }
}
```

**Acceptance criteria:** `domain_events` table created with compound indexes. PostgreSQL query for `userId + occurred_at > X` returns results in under 50ms for tables up to 1 million rows. RTDB event storage deprecated (events now written to PostgreSQL for SSE consumption).

---

#### Phase 4.5 — SSE Resume with Dexie (After Phase 4.4)

**Problem:** SSE implementation has no `Last-Event-ID` support and no resume after disconnect. On Cloud Functions 120s timeout, all subscribers are silently disconnected.

**Files:**
- `apps/web/src/infrastructure/sse/sse-client.ts` (new or rewrite)
- `apps/web/src/infrastructure/db/sse-positions.db.ts` (new Dexie store)
- `apps/cf-api/src/routes/events/sse.route.ts` (update)

**Dexie store for resume positions:**
```typescript
// apps/web/src/infrastructure/db/sse-positions.db.ts

import Dexie, { type EntityTable } from "dexie"

interface SseResumePosition {
  userId:      string
  lastEventId: string
  savedAt:     string  // ISO timestamp
}

class SsePositionDatabase extends Dexie {
  positions!: EntityTable<SseResumePosition, "userId">

  constructor() {
    super("fabric-sse-positions")
    this.version(1).stores({
      positions: "userId, savedAt",
    })
  }
}

export const ssePositionDb = new SsePositionDatabase()

// NOT sessionStorage — cleared on tab close
// NOT localStorage — no TTL built-in, grows unbounded
// Dexie (IndexedDB): survives tab close, queryable, supports TTL via savedAt field

export async function getResumePosition(userId: string): Promise<string | null> {
  const row = await ssePositionDb.positions.get(userId)
  if (!row) return null

  // Discard stale positions older than 24 hours
  const savedAt = new Date(row.savedAt)
  const hoursOld = (Date.now() - savedAt.getTime()) / (1000 * 60 * 60)
  if (hoursOld > 24) {
    await ssePositionDb.positions.delete(userId)
    return null
  }

  return row.lastEventId
}

export async function saveResumePosition(userId: string, lastEventId: string): Promise<void> {
  await ssePositionDb.positions.put({
    userId,
    lastEventId,
    savedAt: new Date().toISOString(),
  })
}
```

**SSE client with auto-reconnect:**
```typescript
// apps/web/src/infrastructure/sse/sse-client.ts
"use client"

import { getResumePosition, saveResumePosition } from "../db/sse-positions.db"

interface SseClientOptions {
  userId: string
  url: string
  onEvent: (event: MessageEvent) => void
  onError?: (err: Event) => void
}

export function createSseClient(opts: SseClientOptions) {
  let es: EventSource | null = null
  let stopped = false

  async function connect() {
    if (stopped) return

    const lastEventId = await getResumePosition(opts.userId)
    const url = lastEventId
      ? `${opts.url}?lastEventId=${encodeURIComponent(lastEventId)}`
      : opts.url

    es = new EventSource(url, { withCredentials: true })

    es.onmessage = async (event) => {
      if (event.lastEventId) {
        await saveResumePosition(opts.userId, event.lastEventId)
      }
      opts.onEvent(event)
    }

    es.onerror = (err) => {
      opts.onError?.(err)
      es?.close()
      // Reconnect after 5 seconds (Cloud Functions 120s timeout requires this)
      if (!stopped) {
        setTimeout(connect, 5_000)
      }
    }
  }

  return {
    start: connect,
    stop: () => {
      stopped = true
      es?.close()
    },
  }
}
```

**SSE route with Last-Event-ID support:**
```typescript
// apps/cf-api/src/routes/events/sse.route.ts

eventsRouter.get("/stream", requireAuth, async (c) => {
  const userId = UserId(c.get("tokenPayload").sub)
  const lastEventId = c.req.query("lastEventId")

  c.header("Content-Type", "text/event-stream")
  c.header("Cache-Control", "no-cache")
  c.header("Connection", "keep-alive")
  c.header("X-Accel-Buffering", "no")  // Disable nginx buffering

  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()

  // Resume from last known position
  const eventStore = c.get("eventStore") as PostgresEventStore
  if (lastEventId) {
    const missedEvents = await eventStore.getEventsAfter(userId, lastEventId)
    for (const event of missedEvents) {
      await writer.write(
        new TextEncoder().encode(`id: ${event.id}\ndata: ${JSON.stringify(event)}\n\n`)
      )
    }
  }

  // Stream new events
  const unsubscribe = subscribeToUserEvents(userId, async (event) => {
    await writer.write(
      new TextEncoder().encode(`id: ${event.id}\ndata: ${JSON.stringify(event)}\n\n`)
    )
  })

  c.req.raw.signal.addEventListener("abort", () => {
    unsubscribe()
    writer.close()
  })

  return new Response(readable, {
    headers: c.res.headers,
  })
})
```

**Acceptance criteria:** SSE client sends `lastEventId` query param on reconnect. Server replays missed events since last position. Dexie position survives tab close and browser restart. Stale positions (>24h) are discarded. No missed events between Cloud Function timeout and reconnect.

---

### PHASE 5 — Merchant Features (Weeks 19–26)

---

#### Phase 5.1 — PromptPay Integration Hardening

**Problem:** PromptPay QR code generation must handle Thai banking system timeouts and QR expiry.

**Files:**
- `apps/cf-commerce/src/payment/adapters/promptpay.adapter.ts` (update)

**Implementation:**
```typescript
// apps/cf-commerce/src/payment/adapters/promptpay.adapter.ts

class PromptPayAdapter {
  // PromptPay QR codes expire after 15 minutes per Bank of Thailand spec
  static readonly QR_EXPIRY_SECONDS = 900

  async createPayment(
    orderId: OrderId,
    amount: ProductPrice,
    merchantPromptPayId: string
  ): Promise<PromptPayPayment> {
    const qrPayload = this.buildQrPayload(merchantPromptPayId, amount)
    const qrCode = await this.generateQrCode(qrPayload)

    return {
      orderId,
      qrCode,
      amount,
      expiresAt: new Date(Date.now() + PromptPayAdapter.QR_EXPIRY_SECONDS * 1000),
      paymentRef: this.generatePaymentRef(orderId),
    }
  }

  private buildQrPayload(promptPayId: string, amount: ProductPrice): string {
    // Thai Standard PromptPay QR payload (EMVCo format)
    // Amount in Thai Baht decimal: 299.00 for ฿299
    const amountBaht = (amount.cents / 100).toFixed(2)
    // ... EMVCo QR payload construction
    return payload
  }
}
```

**Acceptance criteria:** PromptPay QR codes include correct expiry time. Amount uses `cents / 100` for display (never direct `displayAmount` for calculations). Payment reference generated deterministically from orderId for idempotency.

---

#### Phase 5.2 — Enable Payouts (After Admin UI Verified)

**Prerequisite:** Phase 1.1 (Admin UI MVP) deployed and verified in production.

**Action:**
```bash
# Set in Cloud Functions environment (cf-api)
firebase functions:config:set app.payouts_enabled="true"

# Or in .env.production:
PAYOUTS_ENABLED=true
```

**Then redeploy cf-api.** The Phase 0.5 guard reads this variable at runtime.

**Acceptance criteria:** `POST /payouts/initiate` returns 200 for approved merchants. Admin can view pending payouts in admin UI. Payout amounts calculated using `payment.cents` (never `displayAmount`).

---

#### Phase 5.3 — USDC Payment Integration

**Problem:** USDC payment path exists in architecture docs but may not be fully implemented.

**Files:**
- `apps/cf-commerce/src/payment/adapters/usdc.adapter.ts` (new or complete)

**Key constraint:**
```typescript
// USDC amounts: use cents-equivalent smallest unit
// 1 USDC = 1,000,000 micro-USDC (6 decimal places)
// ProductPrice.cents for THB → convert to USDC at exchange rate
// NEVER store USDC amount as bigint
interface UsdcPayment {
  amountMicroUsdc: number  // number is safe up to 2^53 ≈ 9 quadrillion micro-USDC
  exchangeRateThbPerUsdc: number
  orderId: OrderId
}
```

**Acceptance criteria:** USDC payment flow completes. Exchange rate fetched fresh per payment (never cached stale rate). Amount stored as number (not bigint). JSON serialization works correctly.

---

### PHASE 6 — Ongoing Operations

---

#### Phase 6.1 — Pre-commit Hook Optimization

**Problem:** Pre-commit hook currently runs all 720 tests, making commits slow (several minutes). This slows development without meaningful benefit — pre-commit should run fast checks only.

**File:** `.husky/pre-commit` (or equivalent)

**Implementation:**
```bash
#!/bin/sh
# .husky/pre-commit

# Fast checks only (< 30 seconds total)
bun run lint          # Biome lint — fast
bun run type-check    # tsc --noEmit — fast
bun run test:unit     # Unit tests only, not integration tests

# DO NOT run: bun test (all 720 tests)
# Full test suite runs in CI (GitHub Actions), not pre-commit
```

**package.json scripts:**
```json
{
  "scripts": {
    "test": "bun test",                           // All tests — CI only
    "test:unit": "bun test --testPathPattern=.unit.test.",  // Unit only — pre-commit
    "test:integration": "bun test --testPathPattern=.integration.test.",
    "lint": "biome lint .",
    "type-check": "tsc --noEmit"
  }
}
```

**Acceptance criteria:** Pre-commit hook completes in under 30 seconds. Full test suite (720 tests) runs only in CI. `bun run test:unit` passes before any commit.

---

#### Phase 6.2 — PASETO Key Rotation Runbook

**Canonical rotation procedure:**

```
PASETO Key Rotation Runbook
============================
Author: Fabric Engineering
Last updated: [date]
Refresh token TTL: 7 days (canonical — cf-api.md "30 days" was a documentation error)

Steps:
1. Generate new key:
   openssl rand -base64 32

2. Deploy new key set (current = new, previous = old):
   - Set PASETO_KEY_SET with new current + old as previous with expiresAt = NOW + 8 days
   - Deploy to all cf-api instances simultaneously (use rolling deploy)

3. Monitor for 8 days:
   - Watch for token verification errors in logs
   - Both current key (new tokens) and previous key (tokens issued before rotation) are valid

4. After 8 days (NOT after 24 hours):
   - Remove previous key from PASETO_KEY_SET
   - All outstanding refresh tokens issued before rotation have now expired (7-day TTL)
   - Deploy updated key set

CRITICAL: Removing previous key before 8 days = force-logout of all users
          with valid 7-day refresh tokens.

Rotation frequency: Every 90 days minimum. Immediately if key is suspected compromised.
```

**Acceptance criteria:** Runbook exists in `docs/runbooks/paseto-key-rotation.md`. Rotation tested in staging environment. Previous key correctly rejected after 8-day window.

---

#### Phase 6.3 — dependency-cruiser Import Graph Enforcement

**Problem:** Without import graph enforcement, application layer may accidentally import infrastructure layer (violating hexagonal architecture), or packages may develop circular dependencies.

**File:** `.dependency-cruiser.js` (new or update)

**Implementation:**
```javascript
// .dependency-cruiser.js

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-domain-to-infrastructure",
      comment: "Domain layer must not import from infrastructure",
      severity: "error",
      from: { path: "src/domain/" },
      to: { path: "src/infrastructure/" },
    },
    {
      name: "no-application-to-infrastructure",
      comment: "Application layer must not import from infrastructure (use ports)",
      severity: "error",
      from: { path: "src/application/" },
      to: { path: "src/infrastructure/" },
    },
    {
      name: "no-web-to-cf-api-direct",
      comment: "apps/web must not import from apps/cf-api directly",
      severity: "error",
      from: { path: "apps/web/" },
      to: { path: "apps/cf-api/src/" },
    },
    {
      name: "no-cf-commerce-to-cf-api-direct",
      comment: "cf-commerce must not import from cf-api source (only HTTP calls)",
      severity: "error",
      from: { path: "apps/cf-commerce/" },
      to: { path: "apps/cf-api/src/" },
    },
    {
      name: "no-circular",
      comment: "No circular dependencies",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "no-internal-secret-usage",
      comment: "INTERNAL_SECRET must not be referenced after Phase 0.2",
      severity: "error",
      from: {},
      to: { path: "INTERNAL_SECRET" },  // String match in source
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    reporterOptions: {
      archi: { collapsePattern: "^(node_modules|packages)/[^/]+" }
    }
  }
}
```

**CI integration:**
```yaml
# .github/workflows/ci.yml
- name: Check import graph
  run: npx depcruise --config .dependency-cruiser.js apps/ packages/
```

**Acceptance criteria:** CI fails on any violation of the import rules above. Zero circular dependencies in the codebase. `no-domain-to-infrastructure` check passes.

---

#### Phase 6.4 — ADR Documentation Requirements

**Every significant architectural decision must have an ADR (Architecture Decision Record).**

**Required ADRs to create during this remediation:**
- `docs/adr/ADR-0001-paseto-dual-ttl.md` — Why dual TTL instead of token revocation
- `docs/adr/ADR-0002-rtdb-outbox-pattern.md` — Why onCreate trigger instead of polling
- `docs/adr/ADR-0003-fail-closed-rate-limiting.md` — Why 503 instead of fail-open
- `docs/adr/ADR-0004-cloudflare-worker.md` — Whether to keep or delete apps/worker
- `docs/adr/ADR-0005-fp-library-consolidation.md` — Which FP library is canonical
- `docs/adr/ADR-0006-free-monad-removal.md` — Why EventOp<A> was removed
- `docs/adr/ADR-0007-ndid-kyc.md` — Why NDID over US-centric providers

**ADR format:**
```markdown
# ADR-XXXX: [Title]

## Status
[Proposed | Accepted | Deprecated | Superseded by ADR-YYYY]

## Context
[What was the problem?]

## Decision
[What was decided?]

## Consequences
[What are the trade-offs? What becomes easier/harder?]

## Canonical values established
[Any values that future code must treat as immutable facts]
```

---

## PART III — CROSS-CUTTING GUARDRAILS

These rules apply throughout ALL phases.

---

### G.1 — Type Safety Rules (Biome)

```json
// biome.json — enforce these rules
{
  "linter": {
    "rules": {
      "correctness": {
        "noUnusedVariables": "error",
        "noUndeclaredVariables": "error"
      },
      "suspicious": {
        "noBigintLiteral": "error"
      },
      "style": {
        "noNonNullAssertion": "warn",
        "useConst": "error"
      }
    }
  }
}
```

**The `noBigintLiteral` rule catches:** Any `29900n` literal, which crashes `JSON.stringify`.

---

### G.2 — Merge Requirements

Every PR must pass ALL of these before merge:
1. `bun run lint` — zero Biome errors
2. `bun run type-check` — zero TypeScript errors
3. `bun test` — all tests pass (in CI, not just unit tests)
4. `npx depcruise` — zero import graph violations
5. Manual review: no `INTERNAL_SECRET` references, no `bigint` in price fields, no `.value` on branded IDs

---

### G.3 — Canary Deploy Protocol

All Phase 0 and Phase 2 changes (security-related) must use canary deploy:
1. Deploy to 10% of Cloud Functions instances
2. Monitor error rate and latency for 30 minutes
3. If error rate < 0.1%, promote to 100%
4. If error rate ≥ 0.1%, roll back immediately

---

### G.4 — No Backward Compatibility Breaks Without Migration

Any change to RTDB path names, PostgreSQL schema, or token payload structure must include:
1. A migration script (for data)
2. A compatibility layer (for code) that supports both old and new format during transition
3. A cleanup PR (to remove compatibility layer after migration verified)

---

## APPENDIX A — Timeline

| Phase | Weeks | Description |
|---|---|---|
| 0 | 1 | Emergency safety (secrets, rate limit, payout freeze) |
| 1A | 1–8 | Correctness: tracing, path rename, branded types, role source, docs |
| 1B | 1–4 | Admin UI MVP (parallel) |
| 2 | 5–10 | Auth hardening: PASETO scope, key management, bridge, NDID, atoms |
| 3 | 9–16 | Remove over-engineering: Free Monad, Command Pattern, kernel cleanup |
| 4 | 13–22 | Reliability: outbox, reconciliation, Postgres migration, SSE resume |
| 5 | 19–26 | Merchant features: PromptPay, payouts, USDC |
| 6 | Ongoing | Key rotation, pre-commit, ADRs, dependency-cruiser CI |
| **Total** | **~26–30 weeks** | *Phases overlap where dependencies allow* |

---

## APPENDIX B — Files That Must NOT Exist After Plan Completion

```
# Deleted in Phase 3.1 (Free Monad removal)
apps/cf-commerce/src/events/free/event-op.ts
apps/cf-commerce/src/events/free/interpreter.ts
apps/cf-commerce/src/events/free/dry-run-interpreter.ts
apps/cf-commerce/src/events/free/  (entire directory)

# Deleted in Phase 3.2 (Command Pattern removal)
apps/cf-commerce/src/payment/domain/payment.commands.ts
apps/cf-commerce/src/payment/logic/process-payment.logic.ts
apps/cf-commerce/src/payment/interpreter/payment.interpreter.ts

# Moved in Phase 3.2 (not deleted — moved to test/fixtures/)
apps/cf-commerce/src/payment/adapters/mock-payment-gateway.ts
apps/cf-commerce/src/payment/adapters/mock-payment-repo.ts
# → moved to: apps/cf-commerce/test/fixtures/mock-payment-gateway.ts
# → moved to: apps/cf-commerce/test/fixtures/mock-payment-repo.ts

# Deleted in Phase 3.5 (kernel.ts slimmed — HKT machinery removed)
# (kernel.ts itself STAYS but the following concepts are removed from it:)
# - Kind<F, A> and URIS registry
# - Functor<F>, Monad<F>, Applicative<F> typeclass interfaces
# - Any Free<F, A> or Coyoneda types

# Deleted in Phase 0.2 (INTERNAL_SECRET references)
# (no files deleted — INTERNAL_SECRET string references removed from existing files)

# Potentially deleted per ADR-0004 (Cloudflare Worker review)
apps/worker/  (entire directory — ONLY if ADR-0004 recommends removal)
# If ADR-0004 recommends keeping it, apps/worker/ stays
```

---

## APPENDIX C — Canonical Environment Variables

### cf-api (Firebase Functions v2)

```bash
# Authentication
TOKEN_ISSUE_SECRET=<32-byte random base64>    # Replaces INTERNAL_SECRET
PASETO_KEY_SET=<JSON key set>                  # Managed by key-manager.ts

# Internal service communication
PAYMENT_RESULT_SECRET=<32-byte random base64>  # cf-commerce → cf-api
PROMPTPAY_CREATE_SECRET=<32-byte random base64> # cf-api → cf-commerce

# External services
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NDID_API_URL=https://api.ndid.or.th
NDID_API_KEY=<NDID API key>
CF_COMMERCE_URL=https://...

# Feature flags
PAYOUTS_ENABLED=false  # Set to true after Phase 1.1 admin UI verified

# DELETED — does not exist after Phase 0.2
# INTERNAL_SECRET  ← REMOVED
```

### apps/cf-commerce (Firebase Functions v2)

```bash
# Internal service communication
PROMPTPAY_CREATE_SECRET=<same value as cf-api>  # Verify incoming from cf-api
PAYMENT_RESULT_SECRET=<same value as cf-api>    # Send to cf-api
CF_API_URL=https://...

# Cache
MEMCACHED_URL=...

# DELETED — does not exist after Phase 0.2
# INTERNAL_SECRET  ← REMOVED
```

### apps/web (Next.js 16, server-side)

```bash
# Bridge authentication
TOKEN_ISSUE_SECRET=<same value as cf-api>  # Call /internal/issue-token bridge

# Service URLs
CF_API_URL=https://...

# better-auth + PostgreSQL (web session management — separate from PASETO)
DATABASE_URL=postgresql://...
BETTER_AUTH_SECRET=<32-byte random>

# DELETED — does not exist after Phase 0.2
# INTERNAL_SECRET  ← REMOVED
```

---

## APPENDIX D — Forbidden Patterns Quick Reference

```typescript
// ❌ FORBIDDEN: bigint for any price field
const price = { cents: 29900n }  // JSON.stringify throws TypeError

// ❌ FORBIDDEN: ambiguous price field name
const price = { amount: 299 }  // Is this cents or baht display?

// ❌ FORBIDDEN: object wrapper branded type
type ProductId = { __brand: "ProductId"; value: string }

// ❌ FORBIDDEN: .value accessor on branded ID
const id = productId.value  // Doesn't exist with intersection brand

// ❌ FORBIDDEN: INTERNAL_SECRET after Phase 0.2
process.env.INTERNAL_SECRET  // Split into three scoped secrets

// ❌ FORBIDDEN: fail-open rate limiting
if (memcachedDown) { await next() }  // Must return 503

// ❌ FORBIDDEN: per-instance rate limit fallback
const localBucket = new TokenBucket(10)  // Breaks with horizontal scaling

// ❌ FORBIDDEN: login endpoint issuing privileged tokens
// Login ALWAYS returns scope:"standard", TTL 900s

// ❌ FORBIDDEN: SSE resume in sessionStorage
sessionStorage.setItem("lastEventId", id)  // Cleared on tab close

// ❌ FORBIDDEN: RTDB compound queries
db.ref("/events").orderByChild("userId").equalTo(uid)
  .orderByChild("occurredAt").startAt(ts)  // RTDB: only one orderBy allowed

// ❌ FORBIDDEN: 24-hour PASETO key rotation window
// "Wait 24 hours then remove old key" — forces logout of 7-day refresh token holders

// ❌ FORBIDDEN: domain layer importing infrastructure
import { FirebaseProductRepository } from "../../infrastructure/firebase"  // In domain/ file

// ❌ FORBIDDEN: makeProductPriceFromCents() (old name)
const price = makeProductPriceFromCents(2990, "THB")  // Use ProductPrice.fromCents()

// ❌ FORBIDDEN: US-centric KYC provider for Thai market
import { BlueDotKyc } from "./bluedot"   // Wrong provider
import { IdWallKyc } from "./idwall"     // Wrong provider
// Correct: NDID (Thai National Digital ID)
```

---

*End of Fabric Architectural Remediation Plan.*

*This document is the single source of truth. All values herein supersede any conflicting documentation, comment, ADR, or prior plan version. When in doubt, refer to Part I (Canonical Ground Truths) first.*
