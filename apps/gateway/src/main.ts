import Elysia from "elysia";
import { cors } from "@elysiajs/cors";
import Redis from "ioredis";
import { requestLogger, metricsPlugin } from "@fabric/effect-http";
import { redisThrottle } from "@fabric/middleware";
import { initTracing } from "@fabric/observability";
import { buildProxyRoutes, POOLS } from "./routes/proxy.ts";

initTracing("gateway");

const redis = new Redis(process.env["REDIS_URL"] ?? "redis://localhost:6379", {
  lazyConnect: true,
  enableAutoPipelining: true,
  maxRetriesPerRequest: 2,
});
redis.connect().catch(() => {
  console.warn("[gateway] Redis unavailable — rate limiting will fail-closed");
});

const PORT = Number(process.env["PORT"] ?? 4000);

const allowedOrigins = (process.env["ALLOWED_ORIGINS"] ?? "http://localhost:3000").split(",");

// Global throttle: 200 req/min per IP across all downstream routes
const globalThrottle = redisThrottle(redis, {
  limit: 200,
  windowMs: 60_000,
  failOpen: process.env["NODE_ENV"] !== "production",
});

const app = new Elysia()
  .use(cors({ origin: allowedOrigins }))
  .use(requestLogger("gateway"))
  .use(metricsPlugin("gateway"))
  .use(globalThrottle)

  .get("/health", () => ({ status: "ok", service: "gateway" }))

  .get("/health/services", async () => {
    // Probe every upstream instance across all pools — supports multi-instance deploys
    const probes = Object.entries(POOLS).flatMap(([service, pool]) =>
      pool.allUrls().map(async (url) => {
        const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(3_000) }).catch(() => null);
        const label = pool.size() > 1 ? `${service}[${url}]` : service;
        return { service: label, url, ok: res?.ok ?? false };
      })
    );

    const results = await Promise.allSettled(probes);
    return results.map((r) =>
      r.status === "fulfilled" ? r.value : { service: "unknown", url: "?", ok: false }
    );
  })

  // Pool diagnostics — circuit breaker state per upstream instance
  .get("/health/pools", () =>
    Object.fromEntries(
      Object.entries(POOLS).map(([name, pool]) => [name, pool.stats()])
    )
  )

  .use(buildProxyRoutes(redis))

  .listen(PORT);

console.log(`[gateway] listening on http://localhost:${PORT}`);

export type App = typeof app;
