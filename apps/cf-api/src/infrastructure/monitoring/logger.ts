import type { MiddlewareHandler } from "hono";
import {
  getCorrelationIds,
  runWithCorrelation,
} from "../../shared/correlation/correlation-context";

export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

export interface LogEntry {
  severity: LogLevel;
  service: string;
  message: string;
  [key: string]: unknown;
}

const SERVICE_NAME = process.env.K_SERVICE ?? "cf-api";

const IS_DEV =
  process.env.NODE_ENV === "development" ||
  process.env.NODE_ENV === "test" ||
  process.env.FUNCTIONS_EMULATOR === "true";

const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  DEBUG: "\x1b[36m",
  INFO: "\x1b[32m",
  WARN: "\x1b[33m",
  ERROR: "\x1b[31m",
} as const;

function emit(entry: LogEntry): void {
  if (process.env.LOG_SILENT === "true") return;
  const correlation = getCorrelationIds();
  const enriched: LogEntry = correlation
    ? { ...entry, requestId: correlation.requestId, traceId: correlation.traceId }
    : entry;
  if (IS_DEV) {
    const color = ANSI[enriched.severity as keyof typeof ANSI] ?? ANSI.reset;
    const { severity, service, message, ...rest } = enriched;
    const meta =
      Object.keys(rest).length > 0 ? ` ${ANSI.dim}${JSON.stringify(rest)}${ANSI.reset}` : "";
    console.log(
      `${color}${ANSI.bold}[${severity}]${ANSI.reset} ${ANSI.dim}${service}${ANSI.reset} ${message}${meta}`
    );
  } else {
    console.log(JSON.stringify(enriched));
  }
}

export const log = {
  debug: (message: string, data?: Record<string, unknown>) =>
    emit({ severity: "DEBUG", service: SERVICE_NAME, message, ...data }),

  info: (message: string, data?: Record<string, unknown>) =>
    emit({ severity: "INFO", service: SERVICE_NAME, message, ...data }),

  warn: (message: string, data?: Record<string, unknown>) =>
    emit({ severity: "WARN", service: SERVICE_NAME, message, ...data }),

  error: (message: string, data?: Record<string, unknown>) =>
    emit({ severity: "ERROR", service: SERVICE_NAME, message, ...data }),
};

export function logRequest(opts: {
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  userId?: string;
}) {
  const level: LogLevel =
    opts.statusCode >= 500 ? "ERROR" : opts.statusCode >= 400 ? "WARN" : "INFO";
  emit({
    severity: level,
    service: SERVICE_NAME,
    message: `${opts.method} ${opts.path} ${opts.statusCode} ${opts.durationMs}ms`,
    httpRequest: {
      requestMethod: opts.method,
      requestUrl: opts.path,
      status: opts.statusCode,
      latency: `${opts.durationMs / 1000}s`,
    },
    userId: opts.userId,
  });
}

export function logError(
  message: string,
  opts: {
    error: unknown;
    path?: string;
    userId?: string;
    context?: Record<string, unknown>;
  }
) {
  const errorMessage = opts.error instanceof Error ? opts.error.message : String(opts.error);
  const stack = opts.error instanceof Error ? opts.error.stack : undefined;

  emit({
    severity: "ERROR",
    service: SERVICE_NAME,
    message,
    error: { message: errorMessage, stack },
    path: opts.path,
    userId: opts.userId,
    ...opts.context,
  });
}

export function attachCorrelationIds(): MiddlewareHandler {
  return async (c, next) => {
    const requestId = c.req.header("x-request-id") ?? crypto.randomUUID();
    const traceId = c.req.header("x-trace-id") ?? requestId;
    c.res.headers.set("x-request-id", requestId);
    return runWithCorrelation({ requestId, traceId }, () => next());
  };
}

export function requestLogger(): MiddlewareHandler {
  return async (c, next) => {
    const start = Date.now();
    await next();
    const resolvedUserId = c.get("userId") as string | undefined;
    logRequest({
      method: c.req.method,
      path: c.req.path,
      statusCode: c.res.status,
      durationMs: Date.now() - start,
      ...(resolvedUserId !== undefined && { userId: resolvedUserId }),
    });
  };
}
