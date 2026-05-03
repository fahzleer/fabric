# ADR 0009 — Service-to-Service Token Format

## Status
Accepted

## Context
Some routes require a machine-to-machine identity for internal calls (e.g. the web app calling customer service's `/internal/issue-token` to get a merchant token, or legacy payment → order HTTP calls). Options:

- **Signed JWT** — verifiable without a shared secret lookup; standard; requires a signing key.
- **base64url JSON** — simple to produce; no verification overhead; easy to inspect in dev.
- **x-internal-secret header** — shared secret header, no token body needed; used for service-to-service HTTP.

## Decision
Use **x-internal-secret** (shared secret header) for all direct service-to-service HTTP calls. This is documented in ADR 0018.

For the internal merchant token issued by the customer service (`/internal/issue-token`), use **base64url-encoded JSON** with `{ sub, email, role, iat, exp }`. The token is short-lived (1 hour) and validated on the consuming side by decoding and checking `exp`. It is NOT cryptographically signed in the current implementation (Phase 4 placeholder).

Secret rotation: `TOKEN_ISSUE_SECRET` / `INTERNAL_SECRET` are injected via environment variables. Rotation requires redeploying all services that share the secret simultaneously.

## Consequences
- **+** Zero dependencies — no JWT library needed for the base64url token.
- **+** Easy to inspect and debug in dev.
- **−** base64url token is not signed — a compromised service could forge tokens. Acceptable for the current internal-only, same-network deployment.
- **−** Secret rotation requires coordinated redeployment.
- **Future**: Replace base64url token with PASETO (already used for customer-facing auth per ADR 0001).
