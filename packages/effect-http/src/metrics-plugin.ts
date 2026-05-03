import Elysia from "elysia";
import { Registry, Counter, Histogram, collectDefaultMetrics } from "prom-client";

// ── Per-service Prometheus registry ──────────────────────────────────────────

export function createMetrics(serviceName: string) {
  const registry = new Registry();

  collectDefaultMetrics({ register: registry, prefix: `${serviceName}_` });

  const httpRequestsTotal = new Counter({
    name:       `${serviceName}_http_requests_total`,
    help:       "Total number of HTTP requests",
    labelNames: ["method", "path", "status"] as const,
    registers:  [registry],
  });

  const httpRequestDuration = new Histogram({
    name:       `${serviceName}_http_request_duration_seconds`,
    help:       "HTTP request latency in seconds",
    labelNames: ["method", "path", "status"] as const,
    buckets:    [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers:  [registry],
  });

  return { registry, httpRequestsTotal, httpRequestDuration };
}

// ── Elysia plugin ─────────────────────────────────────────────────────────────

export const metricsPlugin = (serviceName: string) => {
  const { registry, httpRequestsTotal, httpRequestDuration } =
    createMetrics(serviceName);

  return new Elysia({ name: `@fabric/metrics/${serviceName}` })
    .derive({ as: "global" }, () => ({ _metricsStart: Date.now() }))
    .onAfterHandle({ as: "global" }, ({ request, set, _metricsStart }) => {
      const { pathname } = new URL(request.url);
      if (pathname === "/metrics") return;

      const status = String(set.status ?? 200);
      const durationSecs = (Date.now() - _metricsStart) / 1000;

      httpRequestsTotal.inc({ method: request.method, path: pathname, status });
      httpRequestDuration.observe({ method: request.method, path: pathname, status }, durationSecs);
    })
    .onError({ as: "global" }, ({ request, _metricsStart, code }) => {
      const { pathname } = new URL(request.url);
      const durationSecs = (Date.now() - (_metricsStart ?? Date.now())) / 1000;
      const status = code === "NOT_FOUND" ? "404"
        : code === "VALIDATION" ? "422"
        : code === "PARSE" ? "400"
        : "500";

      httpRequestsTotal.inc({ method: request.method, path: pathname, status });
      httpRequestDuration.observe({ method: request.method, path: pathname, status }, durationSecs);
    })
    .get("/metrics", async () => {
      const body = await registry.metrics();
      return new Response(body, {
        headers: { "Content-Type": registry.contentType },
      });
    });
};
