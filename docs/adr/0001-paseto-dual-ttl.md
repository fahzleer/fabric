# ADR 0001: PASETO Dual TTL Instead of Token Revocation

**Status:** Accepted  
**Date:** 2024-01-15

## Context

Fabric issues authentication tokens for two scenarios: standard user sessions (access + refresh) and privileged operations (admin actions, internal service bridges). The original design used a single token type with a single TTL and a server-side revocation list.

Problems with revocation lists:
- Require a database or cache lookup on every request (latency, availability risk)
- Firebase RTDB is eventually consistent — revoked tokens could still pass in a brief window
- Revocation list grows unbounded unless periodically purged

Two alternatives were considered:
1. **Single TTL + revocation list** — standard JWT approach, requires server-side state
2. **Dual TTL without revocation** — short-lived access tokens that expire fast enough that revocation is unnecessary for most use cases; long-lived refresh tokens for session continuity

## Decision

Use **dual TTL** with PASETO v3.local tokens:

| Token type | TTL | Stored where |
|---|---|---|
| Access token | 900s (15 min) | Client memory only |
| Privileged token | 120s (2 min) | Client memory only |
| Refresh token | 604800s (7 days) | HttpOnly cookie |

All tokens carry a `scope` claim: `"standard"` or `"privileged"`. Guards check scope before allowing privileged operations.

No revocation list. Tokens are stateless — validation is a local HMAC verification.

## Consequences

**Positive:**
- Zero latency on token validation — no database lookup required
- No availability dependency on a revocation store
- Privileged tokens expire in 2 minutes — compromise window is extremely short
- PASETO v3.local uses AES-256-CTR + HMAC-SHA384 — no algorithm confusion attacks possible

**Negative:**
- A compromised access token is valid until expiry (max 15 minutes)
- Logout invalidates the refresh cookie but cannot revoke in-flight access tokens
- Privileged scope requires the client to re-request a privileged token for each elevated action

## Related

- Phase 2.2 of the remediation plan (PASETO scope model)
- `apps/cf-api/src/infrastructure/auth/paseto-verifier.service.ts`
