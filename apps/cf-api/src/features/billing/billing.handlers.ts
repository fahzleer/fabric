import { None, Some, isSome } from "@fabric/types";
import { type } from "arktype";
import type { Hono } from "hono";
import { PLANS } from "../../domain/billing/billing.value-objects";
import type { PlanId } from "../../domain/billing/billing.value-objects";
import type { PasetoVerifierService } from "../../infrastructure/auth/paseto-verifier.service";
import { requireAuth } from "../../infrastructure/guards/auth.middleware";
import type { BillingService } from "./billing.service";

const OnboardBody = type({
  storeName: "string >= 2 & string <= 80",
});

const SubscribeBody = type({
  planId: '"starter" | "professional" | "enterprise"',
});

export function registerBillingRoutes(
  app: Hono,
  billingService: BillingService,
  verifier: PasetoVerifierService
): void {
  app.post("/merchant/onboard", requireAuth(verifier), async (c) => {
    const body = await c.req.json<unknown>();
    const validated = OnboardBody(body);
    if (validated instanceof type.errors) {
      return c.json({ error: validated.summary }, 400);
    }

    const userId = c.get("userId");
    const email = c.get("userEmail");

    const result = await billingService.onboardMerchant(userId, validated.storeName, email);

    if (result._tag === "Err") {
      return c.json({ error: result.error.message, _tag: result.error._tag }, 500);
    }

    return c.json(
      {
        userId: result.value.userId,
        storeName: result.value.storeName,
        plan: result.value.plan,
        planStatus: result.value.planStatus,
        limits: PLANS[result.value.plan],
        storeSlug: result.value.storeSlug,
      },
      201
    );
  });

  app.post("/merchant/billing/subscribe", requireAuth(verifier), async (c) => {
    const body = await c.req.json<unknown>();
    const validated = SubscribeBody(body);
    if (validated instanceof type.errors) {
      return c.json({ error: validated.summary }, 400);
    }

    const userId = c.get("userId");
    const result = await billingService.subscribeToPlan(
      userId,
      validated.planId as Exclude<PlanId, "free">
    );

    if (result._tag === "Err") {
      const status = result.error._tag === "AlreadySubscribedError" ? 409 : 502;
      return c.json({ error: result.error.message, _tag: result.error._tag }, status);
    }

    return c.json({
      plan: result.value.plan,
      planStatus: result.value.planStatus,
      limits: PLANS[result.value.plan],
      planExpiresAt: result.value.planExpiresAt,
    });
  });

  app.post("/merchant/billing/cancel", requireAuth(verifier), async (c) => {
    const userId = c.get("userId");
    const result = await billingService.cancelSubscription(userId);

    if (result._tag === "Err") {
      const status = result.error._tag === "SubscriptionNotFoundError" ? 404 : 502;
      return c.json({ error: result.error.message, _tag: result.error._tag }, status);
    }

    return c.json({
      message: "Subscription will be cancelled at the end of the billing period",
    });
  });

  app.get("/merchant/billing/portal", requireAuth(verifier), async (c) => {
    const userId = c.get("userId");
    const result = await billingService.getPortalUrl(userId);

    if (result._tag === "Err") {
      const status = result.error._tag === "SubscriptionNotFoundError" ? 404 : 502;
      return c.json({ error: result.error.message, _tag: result.error._tag }, status);
    }

    return c.json({ url: result.value });
  });

  app.get("/merchant/billing/status", requireAuth(verifier), async (c) => {
    const userId = c.get("userId");
    const result = await billingService.getMerchantStatus(userId);

    if (result._tag === "Err") {
      if (result.error._tag === "MerchantNotFoundError") {
        return c.json({
          plan: "free",
          planStatus: "active",
          limits: PLANS.free,
          productCount: 0,
          productCapacityUsed: None<number>(),
          planExpiresAt: None<string>(),
          hasStripeAccount: false,
          storeName: "",
          storeSlug: None<string>(),
          onboarded: Some(false),
        });
      }
      return c.json({ error: result.error.message, _tag: result.error._tag }, 500);
    }

    const merchant = result.value;
    const limits = PLANS[merchant.plan];

    return c.json({
      plan: merchant.plan,
      planStatus: merchant.planStatus,
      limits,
      productCount: merchant.productCount,
      productCapacityUsed:
        limits.maxProducts === -1
          ? None<number>()
          : Some(Math.round((merchant.productCount / limits.maxProducts) * 100)),
      planExpiresAt: merchant.planExpiresAt,
      hasStripeAccount: isSome(merchant.stripeCustomerId),
      storeSlug: merchant.storeSlug,
      storeName: merchant.storeName,
      onboarded: Some(true),
    });
  });

  app.get("/merchant/analytics/summary", requireAuth(verifier), async (c) => {
    const userId = c.get("userId");
    const result = await billingService.getAnalytics(userId);

    if (!result.ok) {
      if (result._tag === "MerchantNotFoundError") {
        return c.json({
          completedOrderCount: 0,
          totalRevenueCents: 0,
          productCount: 0,
          plan: "free",
          planStatus: "active",
          onboarded: Some(false),
        });
      }
      return c.json({ error: result.error, _tag: result._tag }, 500);
    }

    return c.json(result.value);
  });

  app.post("/webhooks/stripe", async (c) => {
    const signature = c.req.header("stripe-signature");
    if (!signature) {
      return c.json({ error: "Missing Stripe-Signature header" }, 400);
    }

    const rawBody = await c.req.text();

    const result = await billingService.handleStripeWebhook(rawBody, signature);

    if (result._tag === "Err") {
      if (result.error._tag === "StripeCallError") {
        return c.json({ error: result.error.message, _tag: result.error._tag }, 400);
      }
      return c.json({ error: result.error.message, _tag: result.error._tag }, 500);
    }

    return c.json({ received: true });
  });
}
