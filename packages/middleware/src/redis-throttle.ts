import Elysia from "elysia";
import type Redis from "ioredis";

export interface RedisThrottleOptions {
  limit: number;
  windowMs: number;
  /** Key extractor — defaults to IP + pathname */
  keyFn?: (request: Request) => string;
  /**
   * When true, allow requests through if Redis is unavailable.
   * Defaults to false (fail-closed). See ADR 0003.
   */
  failOpen?: boolean;
}

export function redisThrottle(redis: Redis, opts: RedisThrottleOptions) {
  return new Elysia({ name: `redis-throttle-${opts.limit}-${opts.windowMs}` }).onBeforeHandle(
    { as: "scoped" },
    async ({ request, set, status }) => {
      const ip =
        request.headers.get("x-real-ip") ??
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        "unknown";

      const url = new URL(request.url);
      const key = opts.keyFn
        ? opts.keyFn(request)
        : `rate_limit:${url.pathname}:${ip}`;

      const ttlSeconds = Math.ceil(opts.windowMs / 1000);

      try {
        const count = await redis.incr(key);
        if (count === 1) {
          await redis.expire(key, ttlSeconds);
        }

        if (count > opts.limit) {
          set.headers["X-RateLimit-Limit"]     = String(opts.limit);
          set.headers["X-RateLimit-Remaining"] = "0";
          set.headers["Retry-After"]           = String(ttlSeconds);
          return status(429, { error: "Too Many Requests", _tag: "RateLimitExceeded" });
        }

        set.headers["X-RateLimit-Limit"]     = String(opts.limit);
        set.headers["X-RateLimit-Remaining"] = String(Math.max(0, opts.limit - count));
      } catch {
        if (opts.failOpen === true) return;
        set.headers["Retry-After"] = String(ttlSeconds);
        return status(503, { error: "Service Unavailable", _tag: "RateLimiterUnavailable" });
      }
      return;
    }
  );
}
