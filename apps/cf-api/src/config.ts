import type { SecretsMap } from "./infrastructure/secrets/secret-manager.service";

export interface CfApiConfig {
  readonly pasetoKey: string;
  readonly corsOrigin: string;
  readonly memcachedServers: string;
  readonly internalSecret: string;
  readonly eventsServiceUrl: string;
  readonly commerceServiceUrl: string;
  readonly pricingServiceUrl: string;
  readonly paymentServiceUrl: string;
  readonly googleClientId: string;
  readonly stripeSecretKey: string;
  readonly stripeWebhookSecret: string;
  readonly stripePriceStarter: string;
  readonly stripePriceProfessional: string;
  readonly stripePriceEnterprise: string;
  readonly stripePortalReturnUrl: string;
}

const REQUIRED_VARS = ["PASETO_KEY", "INTERNAL_SECRET"] as const;

export function loadConfig(secrets?: SecretsMap): CfApiConfig {
  const get = (key: string): string | undefined =>
    secrets ? (secrets.get(key) ?? process.env[key]) : process.env[key];

  const missing = (REQUIRED_VARS as readonly string[]).filter((key) => !get(key));
  if (missing.length > 0) {
    throw new Error(`[cf-api/config] Missing required env vars: ${missing.join(", ")}`);
  }

  return {
    pasetoKey: get("PASETO_KEY") as string,
    corsOrigin: get("CORS_ORIGIN") ?? "*",
    memcachedServers: get("MEMCACHED_SERVERS") ?? "localhost:11211",
    internalSecret: get("INTERNAL_SECRET") as string,
    eventsServiceUrl: get("EVENTS_SERVICE_URL") ?? "http://localhost:8082",
    commerceServiceUrl: get("COMMERCE_SERVICE_URL") ?? "http://localhost:8083",
    pricingServiceUrl: get("PRICING_SERVICE_URL") ?? "http://localhost:8082",
    paymentServiceUrl: get("PAYMENT_SERVICE_URL") ?? "http://localhost:8082",
    googleClientId: get("GOOGLE_CLIENT_ID") ?? "",
    stripeSecretKey: get("STRIPE_SECRET_KEY") ?? "",
    stripeWebhookSecret: get("STRIPE_WEBHOOK_SECRET") ?? "",
    stripePriceStarter: get("STRIPE_PRICE_STARTER") ?? "",
    stripePriceProfessional: get("STRIPE_PRICE_PROFESSIONAL") ?? "",
    stripePriceEnterprise: get("STRIPE_PRICE_ENTERPRISE") ?? "",
    stripePortalReturnUrl:
      get("STRIPE_PORTAL_RETURN_URL") ?? "http://localhost:3000/merchant/billing",
  };
}
