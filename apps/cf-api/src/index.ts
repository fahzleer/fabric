import { MemcachedAdapter } from "@fabric/cache/memcached";
import { createFirebaseFromEnv } from "@fabric/firebase";
import { Result } from "better-result";
import { deleteApp } from "firebase-admin/app";
import { onRequest } from "firebase-functions/v2/https";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { loadConfig } from "./config";
import { registerAuthRoutes } from "./features/auth/auth.handlers";
import { registerInternalRoutes } from "./features/auth/internal.handlers";
import { registerBillingRoutes } from "./features/billing/billing.handlers";
import { BillingService } from "./features/billing/billing.service";
import { registerCartRoutes } from "./features/cart/cart.handlers";
import { CartService } from "./features/cart/cart.service";
import { registerOrderRoutes } from "./features/order/order.handlers";
import { OrderService } from "./features/order/order.service";
import { registerPromptPayRoutes } from "./features/payment/promptpay.handlers";
import { registerPayoutRoutes } from "./features/payout/payout.handlers";
import { PayoutService } from "./features/payout/payout.service";
import { registerProductRoutes } from "./features/product/product.handlers";
import { ProductService } from "./features/product/product.service";
import { registerStoreRoutes } from "./features/store/store.handlers";
import { PasetoVerifierService } from "./infrastructure/auth/paseto-verifier.service";
import { StripeBillingAdapter } from "./infrastructure/billing/stripe-billing.adapter";
import { HttpEventPublisherAdapter } from "./infrastructure/events/http-event-publisher.adapter";
import { FirebaseActivityRepository } from "./infrastructure/firebase/firebase-activity.repository";
import { FirebaseCartRepository } from "./infrastructure/firebase/firebase-cart.repository";
import { FirebaseLockoutAdapter } from "./infrastructure/firebase/firebase-lockout.adapter";
import { FirebaseMerchantRepository } from "./infrastructure/firebase/firebase-merchant.repository";
import { FirebaseOrderRepository } from "./infrastructure/firebase/firebase-order.repository";
import { FirebasePayoutRepository } from "./infrastructure/firebase/firebase-payout.repository";
import { FirebaseProductRepository } from "./infrastructure/firebase/firebase-product.repository";
import { FirebaseTokenRepository } from "./infrastructure/firebase/firebase-token.repository";
import { FirebaseUserAdapter } from "./infrastructure/firebase/firebase-user.adapter";
import { FirebaseVoucherRepository } from "./infrastructure/firebase/firebase-voucher.repository";
import { attachRequestSignal } from "./infrastructure/guards/auth.middleware";
import { csrf } from "./infrastructure/guards/csrf.middleware";
import { logError, requestLogger } from "./infrastructure/monitoring/logger";
import { HttpPaymentAdapter } from "./infrastructure/payment/http-payment.adapter";
import { HttpPricingAdapter } from "./infrastructure/pricing/pricing.adapter";
import { loadSecrets } from "./infrastructure/secrets/secret-manager.service";
import {
  registerCleanup,
  setupGracefulShutdown,
} from "./infrastructure/shutdown/graceful-shutdown";

const bootPromise = (async () => {
  const secrets = await loadSecrets();
  const config = loadConfig(secrets);
  const DEPLOY_REGIONS = (process.env.CLOUD_FUNCTION_REGIONS ?? "asia-east1")
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean);

  const firebaseResult = createFirebaseFromEnv();
  if (Result.isError(firebaseResult)) {
    throw new Error(`Firebase init failed: ${firebaseResult.error.message}`);
  }
  const firebase = firebaseResult.value;
  const { db } = firebase;

  const memcached = new MemcachedAdapter({ servers: config.memcachedServers });
  const productRepo = new FirebaseProductRepository(db);
  const orderRepo = new FirebaseOrderRepository(db);
  const cartRepo = new FirebaseCartRepository(db);
  const voucherRepo = new FirebaseVoucherRepository(db);
  const userAdapter = new FirebaseUserAdapter(db);
  const tokenRepo = new FirebaseTokenRepository(db);
  const activityRepo = new FirebaseActivityRepository(db);
  const lockoutStore = new FirebaseLockoutAdapter(db);
  const eventPublisher = new HttpEventPublisherAdapter(config.eventsServiceUrl);
  const pricing = new HttpPricingAdapter(config.pricingServiceUrl);
  const payment = new HttpPaymentAdapter(config.paymentServiceUrl);
  const verifier = new PasetoVerifierService();
  const merchantRepo = new FirebaseMerchantRepository(db);
  const stripeAdapter = new StripeBillingAdapter(config.stripeSecretKey);
  const billingService = new BillingService(stripeAdapter, stripeAdapter, merchantRepo, {
    stripePriceIds: {
      starter: config.stripePriceStarter,
      professional: config.stripePriceProfessional,
      enterprise: config.stripePriceEnterprise,
    },
    portalReturnUrl: config.stripePortalReturnUrl,
    webhookSecret: config.stripeWebhookSecret,
  });

  registerCleanup("firebase", () => deleteApp(firebase.app));
  registerCleanup("memcached", () => memcached.quit());
  setupGracefulShutdown();

  const payoutRepo = new FirebasePayoutRepository(db);
  const payoutService = new PayoutService(payoutRepo);
  const productService = new ProductService(productRepo, eventPublisher, activityRepo);
  const cartService = new CartService(cartRepo, productRepo, activityRepo);
  const orderService = new OrderService(
    orderRepo,
    cartRepo,
    payment,
    productRepo,
    pricing,
    voucherRepo,
    eventPublisher,
    activityRepo,
    merchantRepo
  );

  const app = new Hono();
  app.use("*", cors({ origin: config.corsOrigin, credentials: true }));
  app.use("*", requestLogger());
  app.use("*", attachRequestSignal());
  app.use(
    "*",
    csrf({
      ...(config.corsOrigin !== "*" && { trustedOrigin: config.corsOrigin }),
    })
  );
  app.use("*", async (c, next) => {
    await next();
    c.header("X-Content-Type-Options", "nosniff");
    c.header("X-Frame-Options", "DENY");
    c.header("X-XSS-Protection", "1; mode=block");
    c.header("Referrer-Policy", "strict-origin-when-cross-origin");
    c.header("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
    c.header("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
    c.header(
      "Content-Security-Policy",
      "default-src 'none'; connect-src 'self' https://graph.facebook.com https://oauth2.googleapis.com; frame-ancestors 'none'"
    );
  });

  registerProductRoutes(app, productService, verifier, merchantRepo);
  registerCartRoutes(app, cartService, verifier);
  registerOrderRoutes(app, orderService, verifier);
  registerAuthRoutes(app, userAdapter, tokenRepo, lockoutStore, verifier, activityRepo, memcached);
  registerBillingRoutes(app, billingService, verifier);
  registerPromptPayRoutes(app, orderService, verifier);
  registerInternalRoutes(app, config.pasetoKey, config.internalSecret);
  registerStoreRoutes(app, merchantRepo, productRepo);
  registerPayoutRoutes(app, payoutService, verifier);
  app.get("/api/health", (c) =>
    c.json({ status: "ok", service: "cf-api", regions: DEPLOY_REGIONS })
  );
  app.onError((err, c) => {
    const status = "status" in err ? (err as { status: number }).status : 500;
    const message = err.message;
    if (status >= 500) {
      logError("Unhandled error", { error: err, path: c.req.path });
    }
    return c.json(
      { error: message },
      status as import("hono/utils/http-status").ContentfulStatusCode
    );
  });

  return { app, config, DEPLOY_REGIONS };
})();

if (!process.env.K_SERVICE) {
  bootPromise.then(({ app }) => {
    const port = Number.parseInt(process.env.PORT ?? "3010", 10);
    Bun.serve({ fetch: app.fetch.bind(app), port });
    console.log(`[cf-api] dev server running on http://localhost:${port}`);
  });
}

export const cfApi = onRequest(
  {
    region: (process.env.CLOUD_FUNCTION_REGIONS ?? "asia-east1")
      .split(",")
      .map((r) => r.trim())
      .filter(Boolean),
    memory: "512MiB",
    timeoutSeconds: 60,
    minInstances: Number.parseInt(process.env.CF_MIN_INSTANCES ?? "1", 10),
    concurrency: 80,
  },
  async (req, res) => {
    const { app } = await bootPromise;
    const honoRes = await Promise.resolve(app.fetch(req as unknown as Request));
    res.status(honoRes.status);
    honoRes.headers.forEach((value: string, key: string) => res.setHeader(key, value));
    const body = await honoRes.text();
    res.send(body);
  }
);
