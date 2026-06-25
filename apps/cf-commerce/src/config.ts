export interface CfCommerceConfig {
  readonly corsOrigin: string;
  readonly apiServiceUrl: string;
  readonly internalSecret: string;
}

const REQUIRED_VARS = ["INTERNAL_SECRET", "CORS_ORIGIN"] as const;

export function loadConfig(): CfCommerceConfig {
  const missing = (REQUIRED_VARS as readonly string[]).filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`[cf-commerce/config] Missing required env vars: ${missing.join(", ")}`);
  }

  return {
    corsOrigin: process.env.CORS_ORIGIN as string,
    apiServiceUrl: process.env.API_SERVICE_URL ?? "http://localhost:3010",
    internalSecret: process.env.INTERNAL_SECRET as string,
  };
}
