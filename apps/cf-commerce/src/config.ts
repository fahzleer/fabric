import { EnvValidationError, httpUrl, nonEmpty, parseEnv, portNumber } from "@fabric/config";
import { type } from "arktype";

export type PaymentGateway = "mock" | "omise";

export interface CfCommerceConfig {
  readonly corsOrigin: string;
  readonly apiServiceUrl: string;
  readonly cfApiUrl: string;
  readonly internalSecret: string;
  readonly paymentGateway: PaymentGateway;
  readonly omiseSecretKey: string;
  readonly omiseWebhookSecret: string;
  readonly memcachedServers: string;
  readonly port: number;
}

const paymentGateway = type("'mock' | 'omise'");

const CfCommerceEnvSchema = type({
  INTERNAL_SECRET: nonEmpty,
  CORS_ORIGIN: nonEmpty,
  "API_SERVICE_URL?": httpUrl,
  "CF_API_URL?": httpUrl,
  "PAYMENT_GATEWAY?": paymentGateway,
  "OMISE_SECRET_KEY?": "string",
  "OMISE_WEBHOOK_SECRET?": type("string >= 32"),
  "MEMCACHED_SERVERS?": "string",
  "PORT?": portNumber,
}).narrow((env, ctx) => {
  if (env.PAYMENT_GATEWAY === "omise") {
    if (!env.OMISE_SECRET_KEY) return ctx.mustBe("OMISE_SECRET_KEY when PAYMENT_GATEWAY=omise");
    if (!env.OMISE_WEBHOOK_SECRET)
      return ctx.mustBe("OMISE_WEBHOOK_SECRET (≥32 chars) when PAYMENT_GATEWAY=omise");
  }
  return true;
});

export function loadConfig(): CfCommerceConfig {
  const parsed = parseEnv(CfCommerceEnvSchema);
  if (parsed.isErr()) {
    throw new Error(
      `[cf-commerce/config] ${parsed.error.message}:\n  - ${parsed.error.issues.join("\n  - ")}`
    );
  }
  const env = parsed.value;

  return {
    corsOrigin: env.CORS_ORIGIN,
    apiServiceUrl: env.API_SERVICE_URL ?? "http://localhost:3010",
    cfApiUrl: env.CF_API_URL ?? env.API_SERVICE_URL ?? "http://localhost:3010",
    internalSecret: env.INTERNAL_SECRET,
    paymentGateway: env.PAYMENT_GATEWAY ?? "mock",
    omiseSecretKey: env.OMISE_SECRET_KEY ?? "",
    omiseWebhookSecret: env.OMISE_WEBHOOK_SECRET ?? "",
    memcachedServers: env.MEMCACHED_SERVERS ?? "localhost:11211",
    port: env.PORT ?? 8082,
  };
}

export { EnvValidationError };
