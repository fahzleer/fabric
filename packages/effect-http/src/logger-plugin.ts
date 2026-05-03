import Elysia from "elysia";
import { createLogger } from "@fabric/observability";
import { generateTraceId } from "@fabric/observability";

// ── requestLogger ─────────────────────────────────────────────────────────────
// Elysia plugin that:
//   1. Reads or generates x-trace-id per request
//   2. Decorates context with `log` (structured JSON logger bound to traceId)
//   3. Decorates context with `traceId`
//   4. Logs → and ← with method, path, status, and durationMs

export const requestLogger = (service: string) =>
  new Elysia({ name: `@fabric/request-logger/${service}` })
    .derive({ as: "global" }, ({ request }) => {
      const traceId = request.headers.get("x-trace-id") ?? generateTraceId()
      const log = createLogger(service, traceId)
      const startMs = Date.now()
      return { log, traceId, _startMs: startMs }
    })
    .onBeforeHandle({ as: "global" }, ({ log, request }) => {
      const { pathname } = new URL(request.url)
      log.info("→", { method: request.method, path: pathname })
    })
    .onAfterHandle({ as: "global" }, ({ log, set, request, _startMs }) => {
      const { pathname } = new URL(request.url)
      log.info("←", {
        method: request.method,
        path: pathname,
        status: set.status ?? 200,
        durationMs: Date.now() - _startMs,
      })
    })
    .onError({ as: "global" }, ({ log, error, code, request }) => {
      const { pathname } = new URL(request.url)
      const logger = log ?? createLogger(service, request.headers.get("x-trace-id") ?? generateTraceId())
      logger.error("request error", { code, path: pathname, error: String(error) })
    })
