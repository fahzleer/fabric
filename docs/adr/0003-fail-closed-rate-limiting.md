# ADR 0003: Fail-Closed Rate Limiting (503 When Memcached Unavailable)

**Status:** Accepted  
**Date:** 2024-01-20

## Context

The throttle middleware in cf-api uses Memcached to track request counts per IP/user. When Memcached is unavailable (cold start, network partition, node restart), the middleware must decide: allow all requests through (fail-open) or reject all requests (fail-closed).

The original implementation was fail-open: if Memcached threw an error, the middleware caught it silently and called `next()`, letting the request through. This meant that a Memcached outage disabled rate limiting entirely — a targeted availability attack could use this window to flood the API.

## Decision

**Fail-closed**: when Memcached is unavailable, the throttle middleware returns **503 Service Unavailable** instead of allowing the request through.

```typescript
try {
  const count = await memcached.incr(key, 1, windowSeconds);
  if (count > limit) return c.json({ error: "rate_limit_exceeded" }, 429);
} catch {
  return c.json({ error: "service_unavailable" }, 503);
}
```

## Consequences

**Positive:**
- Rate limiting cannot be bypassed by triggering a Memcached outage
- Security guarantee is preserved: the limit is enforced or the endpoint is unavailable
- Monitoring will immediately detect 503 spikes if Memcached goes down

**Negative:**
- A Memcached outage causes legitimate traffic to receive 503 — availability impact
- Load balancer health checks and retry logic must handle 503 correctly
- Memcached availability becomes a dependency for API availability (previously it was advisory only)

## Mitigation

- Memcached is deployed with 2+ replicas with automatic failover
- The connection timeout is set to 500ms (short) to fail fast
- CloudFlare CDN caches public endpoints — most read traffic bypasses the rate limiter entirely
- Internal routes (webhooks, token bridge) use secret-based auth, not rate limiting

## Related

- Phase 0.3 of the remediation plan
- `apps/cf-api/src/infrastructure/middleware/throttle.middleware.ts`
