# Security Architecture

> Security is not a feature. It is a set of constraints that the entire system must satisfy, all the time, under adversarial conditions.

---

## Threat Model

The system must defend against:

1. **Credential stuffing / brute force** — Automated password attempts against `/auth/login`
2. **Cross-site request forgery** — Malicious pages triggering authenticated API calls
3. **Token theft** — JWT/PASETO tokens intercepted and replayed
4. **Privilege escalation** — Customer accessing store_owner routes
5. **Internal service impersonation** — External callers hitting `/internal/**` routes
6. **Information leakage** — Stack traces, internal URLs, or error messages in responses

Each of these is addressed by a specific control.

---

## PASETO v3.local — Why Not JWT

JWT is a format, not a security protocol. It allows arbitrary algorithm selection via the `alg` header. This has led to documented attacks:

- **`alg: none` attack**: Set `alg` to `none`, strip the signature. Servers that don't verify the algorithm accept the token.
- **RS256/HS256 confusion**: Server expects RS256 (asymmetric). Attacker uses the public key as the HMAC secret for HS256. Server accepts it.
- **Algorithm downgrade**: Attacker swaps `RS256` to `RS512`. Server accepts both.

PASETO removes algorithm agility entirely. `v3.local` uses exactly one algorithm: `AES-256-CTR + HMAC-SHA384`. There is no `alg` field to manipulate. The algorithm is hardcoded into the version string.

```
v3.local.{base64url-encrypted-payload}.{optional-footer}
```

**Symmetric**: The same key encrypts (issues) and decrypts (verifies) tokens. cf-api holds the key; no public-key distribution required. The key is a 32-byte hex string loaded from GCP Secret Manager at cold start.

**Token structure**:
```typescript
// Access token payload (after decryption)
{
  sub: string,       // userId
  email: string,
  role: UserRole,
  iat: number,       // issued-at (Unix seconds)
  exp: number        // expires-at (Unix seconds, iat + 900)
}
```

**No token revocation by default**. Access tokens are short-lived (15 minutes). Refresh tokens are stored in RTDB (`/token_repo/{jti}`) and can be revoked by deleting the record. Logout deletes the refresh token entry.

---

## CSRF — Double-Submit Cookie

Single-Page Applications that use cookie-based sessions are vulnerable to CSRF if they accept requests without verifying origin. Modern browsers block cross-origin `fetch` by default (CORS), but CORS has exceptions:

- Simple requests (`GET`, `POST` with `application/x-www-form-urlencoded` or `text/plain`) bypass CORS preflight
- Form submissions from any origin bypass CORS entirely

The double-submit cookie pattern mitigates this:

1. Client reads a CSRF token from a cookie (`csrf_token`)
2. Client sends the token as a header (`x-csrf-token`)
3. Server verifies cookie value == header value
4. An attacker cannot read the cookie (same-origin cookie) and therefore cannot construct a valid request

Hono's `csrf()` middleware implements this. Configuration in cf-api:

```typescript
app.use("*", csrf({
  // If corsOrigin is set to a specific domain, trustedOrigin restricts
  // CSRF validation to that origin. When corsOrigin = "*", all origins
  // pass CORS — but CSRF double-submit still requires the cookie.
  ...(config.corsOrigin !== "*" && { trustedOrigin: config.corsOrigin }),
}))
```

**CSRF-exempt routes**: `GET /api/health`. Health checks are read-only and do not require CSRF protection. All mutation routes (`POST`, `PUT`, `PATCH`, `DELETE`) are protected.

---

## Rate Limiting — Sliding Window

**Implementation**: Memcached atomic increment, sliding window.

```typescript
// throttle middleware
const key = `rate-limit:${clientIp}:${path}`
const count = await memcached.increment(key, windowMs / 1000)

if (count !== null && count > limit) {
  return c.json(
    { error: "rate_limit_exceeded", retryAfter: windowMs / 1000 },
    429,
    { "Retry-After": String(windowMs / 1000) }
  )
}
```

**Limits**:
| Route | Limit | Window |
|---|---|---|
| `POST /auth/login` | 10 requests | 60 seconds |
| `POST /auth/register` | 5 requests | 120 seconds |
| `POST /auth/facebook`, `/auth/google` | 10 requests | 60 seconds |

**Degradation behavior**: If Memcached is unavailable (`increment` returns `null`), rate limiting is bypassed and the request is allowed. This is an availability-over-enforcement tradeoff — legitimate traffic is not blocked during infrastructure failures. Attackers would need Memcached to be down to exploit this window.

**IP extraction**: The rate limit key uses `x-forwarded-for` (set by the Cloudflare Worker from `cf-connecting-ip`). This is the real client IP after Cloudflare's network, not Cloudflare's IP.

---

## Brute-Force Lockout

After 5 consecutive failed login attempts for the same email address, the account is locked for 15 minutes:

```typescript
// FirebaseLockoutAdapter
async function recordFailure(email: string): Promise<void> {
  const ref = db.ref(`lockout/${email}`)
  const snap = await ref.once("value")
  const current = snap.val() ?? { failedAttempts: 0 }

  const updated = {
    failedAttempts: current.failedAttempts + 1,
    lastAttemptAt: new Date().toISOString(),
    ...(current.failedAttempts + 1 >= 5 && {
      lockedUntil: new Date(Date.now() + 15 * 60_000).toISOString(),
    }),
  }

  await ref.set(updated)
}

async function isLocked(email: string): Promise<boolean> {
  const snap = await db.ref(`lockout/${email}`).once("value")
  const data = snap.val()
  if (!data?.lockedUntil) return false
  return new Date(data.lockedUntil) > new Date()
}
```

Rate limiting (per-IP) and brute-force lockout (per-email) are independent controls. Rate limiting stops high-volume attacks from a single IP. Lockout stops distributed low-volume attacks targeting a single account from many IPs.

**Lockout is reset** on successful login (cleanup record) and expires naturally (15-minute window).

---

## Internal Service Authentication

Routes under `/internal/**` are protected by a shared secret:

```typescript
// requireInternalSecret middleware
function requireInternalSecret(expectedSecret: string) {
  return async (c: Context, next: Next) => {
    const provided = c.req.header("x-internal-secret")
    if (!provided || provided !== expectedSecret) {
      return c.json({ error: "unauthorized" }, 401)
    }
    return next()
  }
}
```

The `INTERNAL_SECRET` is a random 32-byte hex string shared between cf-api and cf-commerce. It is loaded from GCP Secret Manager at cold start.

**Routes protected**:
- `POST /internal/issue-token` — Called by `apps/web` to bridge sessions → PASETO tokens
- `POST /internal/payment-result` — Called by cf-commerce after payment processing

**Routes NOT accessible from the public internet**: The Cloudflare Worker routing table does not include `/internal/**` prefixes. These routes are unreachable from the browser. The only callers are:
- `apps/web` server actions (calls cf-api directly, not via Worker)
- `cf-commerce` payment interpreter (direct HTTP call to cf-api, not via Worker)

---

## Security Headers

### Cloudflare Worker (Edge)

```
X-Frame-Options: SAMEORIGIN
X-Content-Type-Options: nosniff
Strict-Transport-Security: max-age=31536000; includeSubDomains
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

### cf-api (Function Level)

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY                           ← Stricter than Worker (DENY vs SAMEORIGIN)
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
Strict-Transport-Security: max-age=63072000     ← 2 years, stricter than Worker's 1 year
Content-Security-Policy: default-src 'none'; connect-src 'self'; ...
```

The CSP at the function level restricts what resources the browser can load. `default-src 'none'` blocks everything by default; explicit `connect-src`, `script-src`, `style-src`, etc. allow only what is needed.

**Defense in depth**: Two header layers mean a misconfiguration in one layer doesn't expose the system. The Worker headers protect all traffic regardless of which upstream handles it.

---

## Input Validation

All incoming request payloads are validated at the HTTP boundary using **arktype**:

```typescript
import { type } from "arktype"

const LoginInput = type({
  email: "string.email",
  password: "string >= 8",
})

// In the handler:
const parsed = LoginInput(await c.req.json())
if (parsed instanceof type.errors) {
  return c.json({ error: "validation_failed", issues: parsed.summary }, 400)
}
// parsed is now: { email: string, password: string }
// TypeScript knows the types — arktype schemas are the types
```

arktype's validation schema *is* the TypeScript type. No separate `z.infer<typeof schema>`. No code generation. The runtime validation and the compile-time type are one and the same.

---

## Activity Audit Trail

Every significant action is written to `activity_log/{timestamp}` in RTDB:

```typescript
interface ActivityRecord {
  eventType: string        // e.g. "user_login_failed", "product_created", "order_placed"
  userId: string | null    // null for pre-auth failures
  ipAddress: string
  userAgent: string
  eventData: Record<string, unknown>
  timestamp: string        // ISO 8601
}
```

Recorded events:
- `user_login_success`, `user_login_failed` (with failure reason)
- `user_register_success`, `user_register_failed`
- `product_created`, `product_updated`
- `order_placed`, `order_cancelled`
- `payment_succeeded`, `payment_failed`
- `payout_requested`
- `billing_subscribed`, `billing_cancelled`

The audit trail is append-only. Records are keyed by `{timestamp}-{uuid}` to prevent collisions. It is not a SIEM — but it provides enough context for incident response and basic compliance requirements.
