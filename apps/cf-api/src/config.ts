import {
  type EnvSource,
  EnvValidationError,
  httpUrl,
  nonEmpty,
  parseEnv,
  pasetoKey,
  portNumber,
  positiveInt,
} from "@fabric/config";
import { type } from "arktype";
import type { SecretsMap } from "./infrastructure/secrets/secret-manager.service";

export interface CfApiConfig {
  readonly pasetoKey: string;
  readonly corsOrigin: string;
  readonly memcachedServers: string;
  readonly internalSecret: string;
  readonly eventsServiceUrl: string;
  readonly pricingServiceUrl: string;
  readonly paymentServiceUrl: string;
  readonly commerceServiceUrl: string;
  readonly googleClientId: string;
  readonly stripeSecretKey: string;
  readonly stripeWebhookSecret: string;
  readonly stripePriceStarter: string;
  readonly stripePriceProfessional: string;
  readonly stripePriceEnterprise: string;
  readonly stripePortalReturnUrl: string;
  readonly bcryptRounds: number;
  readonly accessTokenTtlSeconds: number;
  readonly refreshTokenTtlSeconds: number;
  readonly platformFeePct: number;
  readonly cloudFunctionRegions: readonly string[];
  readonly cfMinInstances: number;
  readonly port: number;
  readonly payoutsEnabled: boolean;
}

const commaList = type("string").pipe((s) =>
  s
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean)
);

const feePct = type("string.numeric.parse").narrow((n, ctx) =>
  n >= 0 && n <= 1 ? true : ctx.mustBe("a fraction between 0 and 1")
);

const CfApiEnvSchema = type({
  PASETO_KEY: pasetoKey,
  INTERNAL_SECRET: nonEmpty,
  CORS_ORIGIN: nonEmpty,
  "MEMCACHED_SERVERS?": "string",
  "EVENTS_SERVICE_URL?": httpUrl,
  "PRICING_SERVICE_URL?": httpUrl,
  "PAYMENT_SERVICE_URL?": httpUrl,
  "COMMERCE_SERVICE_URL?": httpUrl,
  "GOOGLE_CLIENT_ID?": "string",
  "STRIPE_SECRET_KEY?": "string",
  "STRIPE_WEBHOOK_SECRET?": "string",
  "STRIPE_PRICE_STARTER?": "string",
  "STRIPE_PRICE_PROFESSIONAL?": "string",
  "STRIPE_PRICE_ENTERPRISE?": "string",
  "STRIPE_PORTAL_RETURN_URL?": httpUrl,
  "BCRYPT_ROUNDS?": positiveInt,
  "ACCESS_TOKEN_TTL_SECONDS?": positiveInt,
  "REFRESH_TOKEN_TTL_SECONDS?": positiveInt,
  "PLATFORM_FEE_PCT?": feePct,
  "CLOUD_FUNCTION_REGIONS?": commaList,
  "CF_MIN_INSTANCES?": positiveInt,
  "PORT?": portNumber,
  "PAYOUTS_ENABLED?": type('"true" | "false"'),
});

function mergeSources(secrets: SecretsMap | undefined): EnvSource {
  const merged: Record<string, string | undefined> = { ...process.env };
  if (secrets) {
    for (const key of ["PASETO_KEY", "INTERNAL_SECRET"] as const) {
      const fromSecrets = secrets.get(key);
      if (fromSecrets !== undefined) merged[key] = fromSecrets;
    }
  }
  return merged;
}

export function loadConfig(secrets?: SecretsMap): CfApiConfig {
  const parsed = parseEnv(CfApiEnvSchema, mergeSources(secrets));
  if (parsed.isErr()) {
    throw new Error(
      `[cf-api/config] ${parsed.error.message}:\n  - ${parsed.error.issues.join("\n  - ")}`
    );
  }
  const env = parsed.value;

  return {
    pasetoKey: env.PASETO_KEY,
    corsOrigin: env.CORS_ORIGIN,
    memcachedServers: env.MEMCACHED_SERVERS ?? "localhost:11211",
    internalSecret: env.INTERNAL_SECRET,
    eventsServiceUrl: env.EVENTS_SERVICE_URL ?? "http://localhost:8082",
    pricingServiceUrl: env.PRICING_SERVICE_URL ?? "http://localhost:8082",
    paymentServiceUrl: env.PAYMENT_SERVICE_URL ?? "http://localhost:8082",
    commerceServiceUrl: env.COMMERCE_SERVICE_URL ?? "http://localhost:8082",
    googleClientId: env.GOOGLE_CLIENT_ID ?? "",
    stripeSecretKey: env.STRIPE_SECRET_KEY ?? "",
    stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET ?? "",
    stripePriceStarter: env.STRIPE_PRICE_STARTER ?? "",
    stripePriceProfessional: env.STRIPE_PRICE_PROFESSIONAL ?? "",
    stripePriceEnterprise: env.STRIPE_PRICE_ENTERPRISE ?? "",
    stripePortalReturnUrl: env.STRIPE_PORTAL_RETURN_URL ?? "http://localhost:3000/merchant/billing",
    bcryptRounds: env.BCRYPT_ROUNDS ?? 12,
    accessTokenTtlSeconds: env.ACCESS_TOKEN_TTL_SECONDS ?? 900,
    refreshTokenTtlSeconds: env.REFRESH_TOKEN_TTL_SECONDS ?? 604_800,
    platformFeePct: env.PLATFORM_FEE_PCT ?? 0.05,
    cloudFunctionRegions: env.CLOUD_FUNCTION_REGIONS ?? ["asia-east1"],
    cfMinInstances: env.CF_MIN_INSTANCES ?? 1,
    port: env.PORT ?? 3010,
    payoutsEnabled: (env.PAYOUTS_ENABLED ?? "false") === "true",
  };
}

export { EnvValidationError };
