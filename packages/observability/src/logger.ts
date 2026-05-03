type LogLevel = "debug" | "info" | "warn" | "error"

const write = (
  level: LogLevel,
  service: string,
  message: string,
  meta?: Record<string, unknown>,
  traceId?: string,
) => {
  const entry = JSON.stringify({
    level,
    service,
    timestamp: new Date().toISOString(),
    ...(traceId ? { traceId } : {}),
    message,
    ...meta,
  })
  if (level === "error") process.stderr.write(`${entry}\n`)
  else process.stdout.write(`${entry}\n`)
}

export const createLogger = (service: string, traceId?: string) => ({
  debug: (message: string, meta?: Record<string, unknown>) =>
    write("debug", service, message, meta, traceId),
  info: (message: string, meta?: Record<string, unknown>) =>
    write("info", service, message, meta, traceId),
  warn: (message: string, meta?: Record<string, unknown>) =>
    write("warn", service, message, meta, traceId),
  error: (message: string, meta?: Record<string, unknown>) =>
    write("error", service, message, meta, traceId),
  child: (childTraceId: string) => createLogger(service, childTraceId),
})

export type Logger = ReturnType<typeof createLogger>
