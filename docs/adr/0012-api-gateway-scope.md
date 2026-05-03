# ADR 0012 — API Gateway Scope and Responsibilities

## Status
Accepted

## Context
The gateway at `:4000` is the single entry point from the web app and external clients. It was possible to implement business logic, auth, caching, and other concerns here, or to keep it thin.

## Decision
The gateway is a **thin reverse proxy only**. Its responsibilities are:

1. **Route proxying** — forward `/api/products/*` to product service, `/api/orders/*` to order service, etc.
2. **CORS** — single source of truth for allowed origins (ADR 0013). No downstream service sets CORS headers.
3. **Rate limiting** — global Redis-backed sliding window (ADR 0003, ADR 0015).

The gateway does **NOT**:
- Validate or decode auth tokens (each service validates its own Bearer token via `requireAuth()`)
- Cache responses
- Aggregate or transform payloads from multiple services
- Implement circuit breakers (circuit breakers live in each service)
- Contain business logic

## Consequences
- **+** Gateway is stateless and simple; easy to replace or scale horizontally.
- **+** Each service is independently testable without the gateway.
- **+** Auth logic is co-located with the service that owns the resource.
- **−** No gateway-level auth short-circuit — unauthenticated requests reach downstream services before being rejected.
- **−** No response aggregation — clients that need data from multiple services make multiple requests (or the web app uses server actions to aggregate).
