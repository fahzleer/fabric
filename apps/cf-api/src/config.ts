import type { SecretsMap } from "./infrastructure/secrets/secret-manager.service";

export interface CfApiConfig {
  readonly pasetoKey: string;
  readonly corsOrigin: string;
  readonly memcachedServers: string;
  readonly internalSecret: string;
  readonly eventsServiceUrl: string;
  readonly pricingServiceUrl: string;
  readonly paymentServiceUrl: string;
  readonly googleClientId: string;
  readonly stripeSecretKey: string;
  readonly stripeWebhookSecret: string;
  readonly stripePriceStarter: string;
  readonly stripePriceProfessional: string;
  readonly stripePriceEnterprise: string;
  readonly stripePortalReturnUrl: string;
  readonly lineNotifyToken: string | undefined;
  readonly lineOaChannelToken: string | undefined;
  readonly lineOaAdminUid: string | undefined;
  readonly sendgridApiKey: string | undefined;
  readonly sendgridFromEmail: string;
  readonly twilioAccountSid: string | undefined;
  readonly twilioAuthToken: string | undefined;
  readonly twilioFromPhone: string | undefined;
  readonly hubspotAccessToken: string | undefined;
  readonly segmentWriteKey: string | undefined;
}

const REQUIRED_VARS = ["PASETO_KEY", "INTERNAL_SECRET", "CORS_ORIGIN"] as const;

export function loadConfig(secrets?: SecretsMap): CfApiConfig {
  const get = (key: string): string | undefined =>
    secrets ? (secrets.get(key) ?? process.env[key]) : process.env[key];

  const missing = (REQUIRED_VARS as readonly string[]).filter((key) => !get(key));
  if (missing.length > 0) {
    throw new Error(`[cf-api/config] Missing required env vars: ${missing.join(", ")}`);
  }

  return {
    pasetoKey: get("PASETO_KEY") as string,
    corsOrigin: get("CORS_ORIGIN") as string,
    memcachedServers: get("MEMCACHED_SERVERS") ?? "localhost:11211",
    internalSecret: get("INTERNAL_SECRET") as string,
    eventsServiceUrl: get("EVENTS_SERVICE_URL") ?? "http://localhost:8082",
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
    lineNotifyToken: get("LINE_NOTIFY_TOKEN"),
    lineOaChannelToken: get("LINE_OA_CHANNEL_TOKEN"),
    lineOaAdminUid: get("LINE_OA_ADMIN_UID"),
    sendgridApiKey: get("SENDGRID_API_KEY"),
    sendgridFromEmail: get("SENDGRID_FROM_EMAIL") ?? "noreply@fabric.cool",
    twilioAccountSid: get("TWILIO_ACCOUNT_SID"),
    twilioAuthToken: get("TWILIO_AUTH_TOKEN"),
    twilioFromPhone: get("TWILIO_FROM_PHONE"),
    hubspotAccessToken: get("HUBSPOT_ACCESS_TOKEN"),
    segmentWriteKey: get("SEGMENT_WRITE_KEY"),
  };
}
