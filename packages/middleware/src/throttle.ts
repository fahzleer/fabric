import { CacheKeys, type MemcachedAdapter } from "@fabric/cache";
import type { MiddlewareHandler } from "hono";

export interface ThrottleOptions {
  limit: number;
  windowMs: number;
  /** Key extractor — defaults to IP-based key */
  keyFn?: (c: import("hono").Context) => string;
  /**
   * When true, allow requests through if Memcached is unavailable instead of 503.
   * Defaults to false (fail-closed). Only set for non-critical endpoints.
   */
  failOpen?: boolean;
}

export function throttle(
  memcached: MemcachedAdapter,
  opts: ThrottleOptions
): MiddlewareHandler {
  return async (c, next) => {
    const ip =
      c.req.header("x-real-ip") ??
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown";
    const key = opts.keyFn
      ? opts.keyFn(c)
      : CacheKeys.rateLimitKey(ip, c.req.path);
    const ttlSeconds = Math.ceil(opts.windowMs / 1000);

    const count = await memcached.increment(key, ttlSeconds);

    if (count === null) {
      if (opts.failOpen === true) {
        await next();
        return;
      }
      c.header("Retry-After", String(ttlSeconds));
      return c.json({ error: "Service Unavailable", _tag: "RateLimiterUnavailable" }, 503);
    }

    if (count > opts.limit) {
      c.header("X-RateLimit-Limit", String(opts.limit));
      c.header("X-RateLimit-Remaining", "0");
      c.header("Retry-After", String(ttlSeconds));
      return c.json({ error: "Too Many Requests", _tag: "RateLimitExceeded" }, 429);
    }

    c.header("X-RateLimit-Limit", String(opts.limit));
    c.header("X-RateLimit-Remaining", String(Math.max(0, opts.limit - count)));
    return next();
  };
}
