import { onRequest } from "firebase-functions/v2/https";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { loadConfig } from "./config";
import { logError, requestLogger } from "./monitoring/logger";
import { registerPaymentRoutes } from "./payment/Http/payment.handlers.ts";
import { MockPaymentGateway } from "./payment/adapters/mock-payment-gateway.adapter.ts";
import { MockPromptPayAdapter } from "./payment/adapters/mock-promptpay.adapter.ts";
import { OmisePaymentGateway } from "./payment/adapters/omise-payment-gateway.adapter.ts";
import { PromptPayAdapter } from "./payment/adapters/promptpay.adapter.ts";

let bootPromise: ReturnType<typeof startBoot> | null = null;

async function startBoot() {
  const config = loadConfig();

  const gateway =
    config.paymentGateway === "omise"
      ? new OmisePaymentGateway(config.omiseSecretKey)
      : new MockPaymentGateway();

  const promptPay: PromptPayAdapter =
    config.paymentGateway === "omise"
      ? new PromptPayAdapter(config.omiseSecretKey)
      : (new MockPromptPayAdapter() as unknown as PromptPayAdapter);

  const app = new Hono();
  app.use("*", cors({ origin: config.corsOrigin, credentials: true }));
  app.use("*", requestLogger());
  registerPaymentRoutes(app, gateway, promptPay);
  app.onError((err, c) => {
    const status = "status" in err ? (err as { status: number }).status : 500;
    if (status >= 500) {
      logError("Unhandled error", { error: err, path: c.req.path });
    }
    return c.json({ error: err.message }, status as never);
  });

  return { app };
}

function boot() {
  if (!bootPromise) bootPromise = startBoot();
  return bootPromise;
}

if (typeof Bun !== "undefined") {
  boot().then(({ app }) => {
    const port = Number.parseInt(process.env.PORT ?? "8083", 10);
    Bun.serve({ fetch: app.fetch.bind(app), port });
    console.log(`[cf-payment] dev server running on http://localhost:${port}`);
  });
}

type FnHandler = Parameters<typeof onRequest>[0];
type FnRequest = Parameters<FnHandler>[0];
type FnResponse = Parameters<FnHandler>[1];

function buildHeaders(reqHeaders: Record<string, string | string[] | undefined>): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(reqHeaders)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v);
    } else {
      headers.set(key, value);
    }
  }
  return headers;
}

async function handleCloudFunctionRequest(req: FnRequest, res: FnResponse): Promise<void> {
  const { app } = await boot();

  const protocol = (req.headers["x-forwarded-proto"] as string | undefined) ?? "https";
  const host = req.headers.host ?? req.hostname;
  const url = `${protocol}://${host}${req.url}`;

  const headers = buildHeaders(req.headers as Record<string, string | string[] | undefined>);
  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const webReq = new Request(url, {
    method: req.method,
    headers,
    body: hasBody ? JSON.stringify(req.body) : undefined,
  });

  const honoRes = await app.fetch(webReq);
  res.status(honoRes.status);
  honoRes.headers.forEach((value: string, key: string) => res.setHeader(key, value));
  const body = await honoRes.text();
  res.send(body);
}

export const cfPayment = onRequest(
  {
    region: "asia-east1",
    memory: "256MiB",
    timeoutSeconds: 120,
    minInstances: 0,
    concurrency: 80,
    secrets: ["INTERNAL_SECRET"],
  },
  (req, res) => handleCloudFunctionRequest(req, res)
);
