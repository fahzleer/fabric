# ADR 0015: Redis Role — Rate Limiting

**Status:** Accepted  
**Date:** 2026-04-29

## Context

Redis was introduced as a dependency of the API gateway for distributed rate limiting. The question of whether to extend its role to **session caching**, **Kafka offset tracking**, or **general-purpose application cache** was evaluated.

Two failure modes matter:

1. **Redis unavailable** — the system must not become inaccessible for authenticated users
2. **Over-reliance** — adding Redis to the critical path of every service increases the blast radius of a Redis outage

Auth sessions are stored in PostgreSQL (better-auth + Drizzle). Kafka offset commits are managed by the Kafka broker. Product/order reads are served from PostgreSQL directly.

## Decision

Redis is used **exclusively for rate limiting** at the gateway layer. It is not a session store, application cache, or message queue.

**Rate limiting policy:**
- Global: 200 req/min per IP (all routes)
- Auth routes (`/internal/*`): 10 req/min per IP (stricter, lower blast radius for credential stuffing)
- Implementation: Redis `INCR` + `EXPIRE` (sliding window per minute)
- **Fail-closed**: if Redis is unreachable, the throttle middleware returns `503 Service Unavailable`. This prevents traffic floods during Redis recovery from masking the outage.

**Rationale for fail-closed vs fail-open:** Fabric processes payments and order mutations; allowing unbounded traffic during a Redis outage could cause cascading DB load. Operators can disable the throttle middleware if Redis is known-down during maintenance.

## Consequences

**Positive:**
- Redis failure only affects rate limiting — all business logic continues on PostgreSQL
- Simple, auditable implementation (INCR/EXPIRE is well-understood)
- No session data stored in Redis — no data loss risk on Redis restart

**Negative:**
- Fail-closed means a Redis outage causes a 503 for all requests (not just over-limit ones)
- Rate limit counters are lost on Redis restart — burst protection has a brief blind spot after restart
- Without caching, some hot read paths (e.g. product list) hit PostgreSQL on every request

**Future:** If hot-path caching becomes necessary, it should be added as a separate Redis database (`SELECT` index or separate instance) with an explicit cache-aside pattern, not by repurposing the rate-limit Redis.

## Implementation

- `packages/middleware/src/redis-throttle.ts` — `redisThrottle()` Elysia plugin
- `apps/gateway/src/main.ts` — global throttle + per-route stricter throttle on `/internal/*`
