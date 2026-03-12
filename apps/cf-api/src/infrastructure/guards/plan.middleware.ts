import type { MiddlewareHandler } from "hono";
import type { MerchantRepositoryPort } from "../../application/ports/merchant.repository.port";
import type { Merchant, PlanId } from "../../domain/billing/billing.value-objects";
import { isPlanSufficient, isSubscriptionActive } from "../../domain/billing/billing.value-objects";

declare module "hono" {
  interface ContextVariableMap {
    merchantPlan: PlanId;
    merchant: Merchant;
  }
}

export function requireActivePlan(
  merchantRepo: MerchantRepositoryPort,
  minPlan: PlanId = "starter"
): MiddlewareHandler {
  return async (c, next) => {
    const userId = c.get("userId");

    const merchantResult = await merchantRepo.findByUserId(userId);

    if (merchantResult._tag === "Err") {
      if (merchantResult.error._tag === "MerchantNotFoundError") {
        return c.json(
          {
            error: "Store registration required",
            _tag: "MerchantNotFound",
            onboardingUrl: "/merchant/onboarding",
          },
          402
        );
      }
      return c.json({ error: "Billing service error", _tag: "BillingRepositoryError" }, 500);
    }

    const merchant = merchantResult.value;

    if (!isSubscriptionActive(merchant)) {
      return c.json(
        {
          error: "Subscription inactive",
          _tag: "SubscriptionInactive",
          planStatus: merchant.planStatus,
          billingUrl: "/merchant/billing",
        },
        402
      );
    }

    if (!isPlanSufficient(merchant.plan, minPlan)) {
      return c.json(
        {
          error: "Plan upgrade required",
          _tag: "InsufficientPlan",
          currentPlan: merchant.plan,
          requiredPlan: minPlan,
          upgradeUrl: "/merchant/billing/upgrade",
        },
        402
      );
    }

    c.set("merchantPlan", merchant.plan);
    c.set("merchant", merchant);

    await next();
  };
}

export function requireProductCapacity(): MiddlewareHandler {
  return async (c, next) => {
    const merchant = c.get("merchant");
    const { canAddProduct } = await import("../../domain/billing/billing.value-objects");

    if (!canAddProduct(merchant)) {
      const { PLANS } = await import("../../domain/billing/billing.value-objects");
      const limit = PLANS[merchant.plan].maxProducts;
      return c.json(
        {
          error: "Product limit reached",
          _tag: "PlanLimitExceeded",
          plan: merchant.plan,
          limit,
          current: merchant.productCount,
          upgradeUrl: "/merchant/billing/upgrade",
        },
        402
      );
    }

    await next();
  };
}
