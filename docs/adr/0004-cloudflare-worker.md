# ADR 0004: Keep apps/worker as Edge Router (Do Not Delete)

**Status:** Accepted  
**Date:** 2024-01-20

## Context

`apps/worker` is a Cloudflare Worker that acts as the edge router for all traffic. It inspects the URL path and proxies requests to the appropriate upstream:

```
/api/* /auth/* /token/*          → cf-api (Firebase Function)
/checkout/* /events/* /payment/* → cf-commerce (Firebase Function)
/**                              → Vercel (Next.js SSR)
```

During the Phase 3 over-engineering cleanup, the question arose: should `apps/worker` be deleted and routing handled by Cloudflare's built-in path routing rules?

Options evaluated:
1. **Delete apps/worker** — use Cloudflare Routes configuration (no code, declarative)
2. **Keep apps/worker** — maintain the edge router as a TypeScript Worker

## Decision

**Keep `apps/worker`** as the authoritative edge router.

Reasons:
- The Worker handles path-rewriting logic that Cloudflare Routes cannot express (regex with named capture groups, conditional proxying based on request headers)
- Future requirements (A/B testing, feature flags at the edge, canary routing) require programmable routing that Cloudflare Routes cannot provide
- The Worker is already deployed and proven in production — migration to declarative routes would require a cutover with no rollback path
- The Worker codebase (`apps/worker/src/`) is small (~150 lines) and has no over-engineering concerns

## Consequences

**Positive:**
- Routing logic is version-controlled and testable
- Future edge features (geolocation, canary, A/B) can be added without infrastructure changes
- A single entrypoint simplifies CORS configuration — only the Worker needs CORS headers

**Negative:**
- An additional deployment artifact to maintain (Cloudflare Worker)
- Worker invocation adds ~1-2ms latency vs direct routing (within Cloudflare SLA)
- Worker code must be updated when upstream service URLs change

## Related

- `apps/worker/src/index.ts`
- Cloudflare dashboard: Workers & Pages → fabric-edge
