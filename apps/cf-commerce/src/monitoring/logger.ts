import type { MiddlewareHandler } from "hono";

export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

export interface LogEntry {
  severity: LogLevel;
  service: string;
  message: string;
  [key: string]: unknown;
}

const SERVICE_NAME = process.env.K_SERVICE ?? "cf-commerce";

function emit(entry: LogEntry): void {
  console.log(JSON.stringify(entry));
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
