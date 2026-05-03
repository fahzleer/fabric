import { SpanStatusCode, trace } from "@opentelemetry/api";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Resource } from "@opentelemetry/resources";
import { NodeTracerProvider, BatchSpanProcessor } from "@opentelemetry/sdk-trace-node";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

export const tracer = trace.getTracer("fabric", "1.0.0");

/**
 * Initialise OpenTelemetry tracing for a microservice.
 * Reads OTEL_EXPORTER_OTLP_ENDPOINT from env (default: http://localhost:4318).
 * No-ops if already initialised or if OTEL_DISABLED=true.
 */
export function initTracing(serviceName: string): void {
  if (process.env["OTEL_DISABLED"] === "true") return;

  const endpoint =
    process.env["OTEL_EXPORTER_OTLP_ENDPOINT"] ?? "http://localhost:4318";

  const exporter = new OTLPTraceExporter({ url: `${endpoint}/v1/traces` });

  const provider = new NodeTracerProvider({
    resource: new Resource({ [ATTR_SERVICE_NAME]: serviceName }),
    spanProcessors: [new BatchSpanProcessor(exporter)],
  });

  provider.register();
}

export function generateTraceId(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

export async function withSpan<T>(
  name: string,
  fn: () => Promise<T>,
  attributes?: Record<string, string | number | boolean>
): Promise<T> {
  return tracer.startActiveSpan(name, { attributes: attributes ?? {} }, async (span) => {
    try {
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: String(err) });
      span.recordException(err as Error);
      throw err;
    } finally {
      span.end();
    }
  });
}
