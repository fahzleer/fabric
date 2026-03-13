import { createFirebaseFromEnv } from "@fabric/firebase";
import { Result } from "better-result";
import { deleteApp } from "firebase-admin/app";
import { onRequest } from "firebase-functions/v2/https";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { loadConfig } from "./config";
import { createProductAgg } from "./events/aggregator/ProductAgg.ts";
import { registerEventsRoutes } from "./events/http/Server.ts";
import { createHub } from "./events/notification/Hub.ts";
import { createRouter } from "./events/router/Router.ts";
import {
  registerCleanup,
  setupGracefulShutdown,
} from "./infrastructure/shutdown/graceful-shutdown";
import { logError, requestLogger } from "./monitoring/logger";
import { registerPaymentRoutes } from "./payment/Http/payment.handlers.ts";
import { MockPaymentGateway } from "./payment/adapters/mock-payment-gateway.adapter.ts";
import { MockPromptPayAdapter } from "./payment/adapters/mock-promptpay.adapter.ts";
import { OmisePaymentGateway } from "./payment/adapters/omise-payment-gateway.adapter.ts";
import { PromptPayAdapter } from "./payment/adapters/promptpay.adapter.ts";
import { registerPricingRoutes } from "./pricing/Http/Router.ts";

let bootPromise: ReturnType<typeof startBoot> | null = null;

async function startBoot() {
  const config = loadConfig();

  const firebaseResult = createFirebaseFromEnv();
  if (Result.isError(firebaseResult)) {
    throw new Error(`Firebase init failed: ${firebaseResult.error.message}`);
  }
  const firebase = firebaseResult.value;
  const { db } = firebase;

  const hub = createHub();
  const ctx = { db, hub };
  const aggregator = createProductAgg(ctx);
  const router = createRouter({ aggregator, hub });

  const gateway =
    config.paymentGateway === "omise"
      ? new OmisePaymentGateway(config.omiseSecretKey)
      : new MockPaymentGateway();

  const promptPay: PromptPayAdapter =
    config.paymentGateway === "omise"
      ? new PromptPayAdapter(config.omiseSecretKey)
      : (new MockPromptPayAdapter() as unknown as PromptPayAdapter);

  registerCleanup("firebase", () => deleteApp(firebase.app));
  registerCleanup("sse-hub", () => hub.closeAll());
  setupGracefulShutdown();

  const app = new Hono();
  app.use("*", cors({ origin: config.corsOrigin, credentials: true }));
  app.use("*", requestLogger());
  registerPricingRoutes(app);
  registerEventsRoutes(app, { router, aggregator, hub });
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
    const port = Number.parseInt(process.env.PORT ?? "8082", 10);
    Bun.serve({ fetch: app.fetch.bind(app), port });
    console.log(`[cf-commerce] dev server running on http://localhost:${port}`);
  });
}

export const cfCommerce = onRequest(
  {
    region: "asia-east1",
    memory: "512MiB",
    timeoutSeconds: 120,
    minInstances: 0,
    concurrency: 80,
    secrets: ["INTERNAL_SECRET"],
  },
  (req, res): Promise<void> => {
    return (async (): Promise<void> => {
      const { app } = await boot();
      const honoRes = await Promise.resolve(app.fetch(req as unknown as Request));
      res.status(honoRes.status);
      honoRes.headers.forEach((value: string, key: string) => res.setHeader(key, value));
      const body = await honoRes.text();
      res.send(body);
    })();
  }
);
