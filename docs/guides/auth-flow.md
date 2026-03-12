# Authentication & Authorization Deep-Dive

Fabric uses two parallel authentication systems that must stay in sync. Understanding both and the bridge between them is essential for working on the merchant portal.

---

## System Overview

```
Browser (apps/web)
  │
  ├── Public pages (/, /products, /store/*)
  │     └── No auth required
  │
  ├── Protected customer pages (/products, /product/*)
  │     └── better-auth session (PostgreSQL) — checked by Next.js middleware
  │
  └── Merchant portal (/merchant/*)
        └── better-auth session → dual-auth bridge → PASETO token → cf-api
```

Two separate auth systems coexist:

| System | Technology | Storage | Used For |
|--------|------------|---------|----------|
| **Web sessions** | better-auth + Drizzle | PostgreSQL `fabric` DB | apps/web authentication (all users) |
| **API tokens** | PASETO v3.local | Firebase RTDB (`refresh_tokens/`) | cf-api authorization (merchant actions) |

---

## System 1: Web Sessions (better-auth)

### Session lifecycle

1. User submits `/auth/login` or `/auth/register`
2. Next.js server action calls `authClient.signIn.email()` or `authClient.signUp.email()`
3. better-auth validates credentials against PostgreSQL `user` table
4. better-auth creates a `session` row in PostgreSQL with a secure session token
5. Browser receives `Set-Cookie: better-auth.session_token=...` (HttpOnly, SameSite=Strict)
6. Cookie TTL: 1-day expiry, rolling 1-hour update, 5-minute server-side cache

### Session validation

```typescript
// Server component or server action
import { auth } from "@/lib/auth"
import { headers } from "next/headers"

const session = await auth.api.getSession({ headers: await headers() })
if (!session) redirect("/auth/login")

const { user } = session
// user.id, user.email, user.role ("customer" | "store_owner" | "admin")
```

### Edge middleware (fast path)

`apps/web/src/middleware.ts` uses `getSessionCookie()` — reads the cookie without a DB query. This is a fast existence check only. Full validation happens in Server Components.

```typescript
// middleware.ts — only checks /products and /product/* routes
export async function middleware(request: NextRequest) {
  const sessionCookie = await getSessionCookie(request)
  if (!sessionCookie) {
    return NextResponse.redirect(new URL(`/auth/login?callbackUrl=${request.url}`, request.url))
  }
}
```

### Role field

`role` is an additional field on the `user` table — not part of better-auth's built-in schema. It is set to `"customer"` on registration and updated to `"store_owner"` or `"admin"` server-side only.

**Critical:** The `role` in PostgreSQL controls access to the merchant portal in apps/web. The `role` in Firebase RTDB and the PASETO token controls cf-api authorization. Both must be kept in sync when upgrading users.

To grant merchant access in development:

```sql
UPDATE "user" SET role = 'store_owner' WHERE email = 'dev@example.com';
```

---

## System 2: PASETO Tokens (cf-api)

### Token structure

cf-api uses PASETO v3.local — symmetric encryption with `PASETO_KEY` (64-char hex = 32 bytes). Tokens are encrypted, not signed. Third parties cannot read the payload.

**Access token payload:**
```typescript
{
  sub: string        // userId
  email: string
  role: UserRole     // "customer" | "store_owner" | "admin"
  iat: string        // ISO UTC (issued at)
  exp: string        // ISO UTC (expires at = iat + 15 min)
}
```

**Refresh token payload:**
```typescript
{
  sub: string        // userId
  jti: string        // unique ID for this refresh token
  iat: string
  exp: string        // expires at = iat + 7 days
}
```

The `tokenFamily` string in the refresh token links all tokens from the same login session (for replay detection).

### Direct PASETO login (mobile / API clients)

```
POST /auth/login
Body: { email, password }
Response: { accessToken, refreshToken, expiresIn: 900 }
```

1. `login.use-case.ts` checks lockout → finds user → verifies bcrypt hash → issues token pair
2. `issueTokens.use-case.ts` encrypts both tokens; stores refresh token hash + family in `refresh_tokens/{jti}`
3. Client stores tokens; attaches `Authorization: Bearer <accessToken>` to all cf-api requests

### Token refresh

```
POST /auth/refresh
Body: { refreshToken }
Response: { accessToken, refreshToken, expiresIn: 900 }
```

Token rotation rules:
- Old refresh token is blacklisted in `token_blacklist/{jti}` immediately
- A new refresh token (new JTI, same family) is issued
- If the old token is already blacklisted (replay attack): entire token family is revoked → all sessions for this user are invalidated

### Token verification (cf-api middleware)

```typescript
// requireAuth(verifier) middleware flow:
const header = c.req.header("Authorization")
const token = verifier.extractBearerToken(header)   // strips "Bearer "
const payload = await verifier.verify(token)         // V3.decrypt + expiry check
c.set("userId", payload.sub)
c.set("userRole", payload.role)
c.set("userEmail", payload.email)
```

---

## Dual-Auth Bridge (Merchant Portal)

The merchant portal (apps/web) needs to call cf-api, but the browser only holds a better-auth session cookie — not a PASETO token. The bridge solves this:

```
apps/web Server Component
  │
  │ 1. auth.api.getSession()          → PostgreSQL session lookup
  │ 2. POST /internal/issue-token      → cf-api (x-internal-secret header)
  │    body: { userId, email, role }   → creates 30-min PASETO access token
  │ 3. _buildMerchantApi(token)        → all subsequent calls use Bearer token
  ▼
cf-api endpoints
```

### `createMerchantApi()` implementation

```typescript
// apps/web/src/lib/merchant-api.ts
export async function createMerchantApi() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) throw new Error("Not authenticated")

  const response = await fetch(`${CF_API_URL}/internal/issue-token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": INTERNAL_SECRET,  // server-to-server shared secret
    },
    body: JSON.stringify({
      userId: session.user.id,
      email: session.user.email,
      role: session.user.role,
    }),
  })

  const { token } = await response.json()
  return _buildMerchantApi(token)
}
```

### `/internal/issue-token` handler (cf-api)

```
POST /internal/issue-token
Header: x-internal-secret: <INTERNAL_SECRET>
Body: { userId, email, role }
Response: { token: "<PASETO access token with 30-min TTL>" }
```

Security: `x-internal-secret` is validated with HMAC-SHA256 constant-time comparison. This endpoint is not publicly documented and is only called from apps/web server-side code.

---

## OAuth (Google / Facebook)

OAuth is available when env vars are set:

| Provider | Env Vars | Auth Route |
|----------|----------|------------|
| Google | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | `POST /auth/sign-in/social` (better-auth) |
| Facebook | `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET` | `POST /auth/sign-in/social` (better-auth) |

cf-api also has independent OAuth endpoints for non-web clients:

```
POST /auth/google     — verifies Google ID token directly
POST /auth/facebook   — verifies Facebook User Access Token directly
```

Both auto-register unknown emails with `role: "customer"` and issue PASETO tokens.

**OAuth accounts have `passwordHash: None`** — attempting email/password login on an OAuth-only account returns `OAuthOnlyAccountError`.

---

## Account Lockout

```
5 failed login attempts within 15 minutes → account locked for 15 minutes
```

State stored in `login_attempts/{base64(email)}`:
- `failureCount`: rolling counter
- `firstAttemptAt`: window start timestamp
- `lockedUntil`: timestamp (only set when threshold exceeded)

On success: entire entry deleted.

Progressive lockout is implemented via `FirebaseLockoutAdapter` using Firebase transactions for atomic increments. The lockout window resets if `now - firstAttemptAt > 15 min`.

---

## Admin Role

Admin users have `role: "admin"` in both PostgreSQL and PASETO tokens.

In cf-api, admin routes check:

```typescript
function requireAdmin(c: Context): boolean {
  return c.get("userRole") === "admin"
}
```

In apps/web, admin pages check:

```typescript
// admin/layout.tsx
const session = await auth.api.getSession({ headers: await headers() })
if (!session || session.user.role !== "admin") redirect("/")
```

There is no separate admin user table — the `role` field on the standard `user` record is the sole authority.

---

## CSRF Protection

Mutation endpoints (POST, PUT, PATCH, DELETE) require a CSRF token when called from a browser (non-Bearer requests).

Flow:
1. Browser makes any GET request → cf-api sets `csrf_token` cookie (32 random bytes, not HttpOnly)
2. Client-side JS reads the cookie and sets `x-csrf-token: <value>` on mutations
3. cf-api validates `x-csrf-token === csrf_token` cookie (constant-time compare)

Exempt paths: `/api/health`, `/auth/*`, `/internal/*`, and any request with `Authorization: Bearer` header.

**apps/web does not use the CSRF cookie** — all cf-api calls from the merchant portal use `Authorization: Bearer <PASETO>`, which bypasses CSRF automatically.

---

## Token Revocation (Logout)

```
POST /auth/logout
Header: Authorization: Bearer <accessToken>
Body: { refreshToken }
```

1. Decodes refresh token → extracts `jti`
2. Removes `refresh_tokens/{jti}`
3. Adds `jti` to `token_blacklist/{jti}` with expiry

Access tokens cannot be revoked (short TTL is the mitigation). Refresh token blacklisting prevents session reuse after logout.

---

## Security Invariants

1. **PASETO_KEY** must be exactly 64 hex characters. Validated at startup.
2. **INTERNAL_SECRET** must match between apps/web and cf-api. Validated with HMAC-SHA256.
3. **Role cannot be set by users.** The `role` field is `serverOnly: true` in better-auth config and only updated via server actions or direct DB queries.
4. **Refresh tokens are single-use.** Once presented, they are blacklisted. Presenting a used token revokes the entire family.
5. **Access tokens are bearer tokens.** Anyone with the token can act as the user for 15 minutes (access) or 30 minutes (merchant portal bridge). Do not log tokens.
