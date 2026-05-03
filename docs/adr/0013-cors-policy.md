# ADR 0013: CORS Policy

**Status:** Accepted  
**Date:** 2026-04-29

## Context

Fabric runs a Next.js frontend (`apps/web`, :3000) behind an API gateway (:4000) that proxies to downstream microservices. Browser requests come from the web app; server-action calls come from the Next.js server itself. Internal service-to-service calls never go through a browser.

Three threat models drive the policy:

1. **Cross-origin reads from malicious sites** — a third-party site must not be able to make credentialed requests to the API on behalf of a logged-in user.
2. **Over-permissive wildcard** — `Access-Control-Allow-Origin: *` exposes all public endpoints to arbitrary clients and cannot be used with `credentials: include`.
3. **Internal endpoint exposure** — `/internal/*` routes (token bridge, shipment creation) must not be reachable from browsers at all.

## Decision

Apply CORS at the **gateway** only. Downstream services are not reachable from browsers directly.

**Allowed origins (configurable via `ALLOWED_ORIGINS` env, comma-separated):**
- `http://localhost:3000` (dev Next.js)
- `GATEWAY_URL` value(s) passed by the deployment (production domain)

**Rules:**
- `origin` matches against the explicit allowlist — never `*`
- `credentials: true` (cookie-based sessions)
- `methods`: GET, POST, PUT, PATCH, DELETE, OPTIONS
- `/internal/*` routes sit behind `x-internal-secret` header verification, not CORS — browsers cannot supply this header without a preflight that would be rejected

## Consequences

**Positive:**
- Single enforcement point in the gateway; no per-service CORS config drift
- Allowlist prevents credential leakage to arbitrary origins
- Internal routes are network-level isolated (CORS rejection + secret header guard)

**Negative:**
- Any new frontend origin (e.g., a mobile PWA on a different subdomain) requires an `ALLOWED_ORIGINS` env change and redeploy
- Strict mode means no curl-based browser testing without disabling CORS in dev

## Implementation

- `apps/gateway/src/main.ts` — `@elysiajs/cors` with `origin: allowedOrigins`
- `ALLOWED_ORIGINS` env var in gateway deployment; defaults to `http://localhost:3000`
