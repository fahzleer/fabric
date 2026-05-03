import { CacheKeys, type MemcachedAdapter } from "@fabric/cache";
import Elysia from "elysia";

export interface ThrottleOptions {
  limit: number;
  windowMs: number;
  /** Key extractor — defaults to IP-based key */
  keyFn?: (request: Request) => string;
  /**
   * When true, allow requests through if Memcached is unavailable instead of 503.
   * Defaults to false (fail-closed). Only set for non-critical endpoints.
   */
  failOpen?: boolean;
}

export function throttle(memcached: MemcachedAdapter, opts: ThrottleOptions) {
  return new Elysia({ name: `throttle-${opts.limit}-${opts.windowMs}` }).onBeforeHandle(
    { as: "scoped" },
    async ({ request, set, status }) => {
      const ip =
        request.headers.get("x-real-ip") ??
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        "unknown";

      const url = new URL(request.url);
      const key = opts.keyFn ? opts.keyFn(request) : CacheKeys.rateLimitKey(ip, url.pathname);
      const ttlSeconds = Math.ceil(opts.windowMs / 1000);

      const count = await memcached.increment(key, ttlSeconds);

      if (count === null) {
        if (opts.failOpen === true) return;
        set.headers["Retry-After"] = String(ttlSeconds);
        return status(503, { error: "Service Unavailable", _tag: "RateLimiterUnavailable" });
      }

      if (count > opts.limit) {
        set.headers["X-RateLimit-Limit"] = String(opts.limit);
        set.headers["X-RateLimit-Remaining"] = "0";
        set.headers["Retry-After"] = String(ttlSeconds);
        return status(429, { error: "Too Many Requests", _tag: "RateLimitExceeded" });
      }

      set.headers["X-RateLimit-Limit"] = String(opts.limit);
      set.headers["X-RateLimit-Remaining"] = String(Math.max(0, opts.limit - count));
      return;
    }
  );
}
