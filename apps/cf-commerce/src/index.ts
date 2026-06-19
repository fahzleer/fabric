import {
  type FirebaseClients,
  type FirebaseInitError,
  createFirebaseFromEnv,
} from "@fabric/firebase";
import { Err, Ok, type Result, isErr } from "@fabric/types";
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

/**
 * Adapter that converts the external `better-result` shape returned by
 * `@fabric/firebase` into the kernel `Result` type from `@fabric/types`.
 * It recognizes the `.ok`, `._tag`, and `.status` discriminants so it stays
 * robust if the upstream Result representation changes.
 */
type ExternalResult<T, E> =
  | { readonly ok: false; readonly error: E }
  | { readonly ok: true; readonly value: T }
  | { readonly _tag: "Err"; readonly error: E }
  | { readonly _tag: "Ok"; readonly value: T }
  | { readonly status: "error"; readonly error: E }
  | { readonly status: "ok"; readonly value: T };

const toKernelResult = <T, E>(result: ExternalResult<T, E>): Result<T, E> => {
  if ("ok" in result) {
    return result.ok === false ? Err(result.error) : Ok(result.value);
  }
  if ("_tag" in result) {
    return result._tag === "Err" ? Err(result.error) : Ok(result.value);
  }
  if ("status" in result) {
    return result.status === "error" ? Err(result.error) : Ok(result.value);
  }
  return Err(new Error("Invalid Result shape") as E);
};

let bootPromise: ReturnType<typeof startBoot> | null = null;

async function startBoot() {
  const config = loadConfig();

  const firebaseResult = toKernelResult<FirebaseClients, FirebaseInitError>(
    createFirebaseFromEnv()
  );
  if (isErr(firebaseResult)) {
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

      const protocol = (req.headers["x-forwarded-proto"] as string | undefined) ?? "https";
      const host = req.headers.host ?? req.hostname;
      const url = `${protocol}://${host}${req.url}`;

      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (value !== undefined) {
          if (Array.isArray(value)) {
            for (const v of value) headers.append(key, v);
          } else {
            headers.set(key, value);
          }
        }
      }

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
    })();
  }
);
