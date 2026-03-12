import { describe, expect, it } from "bun:test";
import { None, Some } from "@fabric/types";
import {
  AlreadySubscribedError,
  BillingRepositoryError,
  InvalidPlanTransitionError,
  MerchantNotFoundError,
  PaymentFailedError,
  PlanLimitExceededError,
  StripeCallError,
  SubscriptionNotFoundError,
} from "./billing.errors";
import {
  PLANS,
  canAddProduct,
  getPlanLimits,
  isPlanSufficient,
  isSubscriptionActive,
  planDisplayName,
} from "./billing.value-objects";
import type { Merchant, PlanId } from "./billing.value-objects";

const makeMerchant = (overrides: Partial<Merchant> = {}): Merchant => ({
  userId: "user-123",
  storeName: "Test Store",
  email: "test@example.com",
  plan: "starter",
  planStatus: "active",
  stripeCustomerId: None(),
  stripeSubscriptionId: None(),
  productCount: 0,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
  planExpiresAt: None(),
  storeSlug: None(),
  ...overrides,
});

describe("isPlanSufficient", () => {
  it("returns true when user plan equals required plan", () => {
    expect(isPlanSufficient("starter", "starter")).toBe(true);
    expect(isPlanSufficient("professional", "professional")).toBe(true);
    expect(isPlanSufficient("enterprise", "enterprise")).toBe(true);
    expect(isPlanSufficient("free", "free")).toBe(true);
  });

  it("returns true when user plan is higher than required", () => {
    expect(isPlanSufficient("starter", "free")).toBe(true);
    expect(isPlanSufficient("professional", "free")).toBe(true);
    expect(isPlanSufficient("professional", "starter")).toBe(true);
    expect(isPlanSufficient("enterprise", "professional")).toBe(true);
    expect(isPlanSufficient("enterprise", "starter")).toBe(true);
    expect(isPlanSufficient("enterprise", "free")).toBe(true);
  });

  it("returns false when user plan is lower than required", () => {
    expect(isPlanSufficient("free", "starter")).toBe(false);
    expect(isPlanSufficient("free", "professional")).toBe(false);
    expect(isPlanSufficient("free", "enterprise")).toBe(false);
    expect(isPlanSufficient("starter", "professional")).toBe(false);
    expect(isPlanSufficient("starter", "enterprise")).toBe(false);
    expect(isPlanSufficient("professional", "enterprise")).toBe(false);
  });
});

describe("canAddProduct", () => {
  it("returns true when product count is below limit", () => {
    const merchant = makeMerchant({ plan: "starter", productCount: 10 });
    expect(canAddProduct(merchant)).toBe(true);
  });

  it("returns false when product count equals limit", () => {
    const merchant = makeMerchant({ plan: "starter", productCount: 50 });
    expect(canAddProduct(merchant)).toBe(false);
  });

  it("returns false when product count exceeds limit (safety)", () => {
    const merchant = makeMerchant({ plan: "starter", productCount: 99 });
    expect(canAddProduct(merchant)).toBe(false);
  });

  it("returns true for enterprise (unlimited = -1)", () => {
    const merchant = makeMerchant({ plan: "enterprise", productCount: 99999 });
    expect(canAddProduct(merchant)).toBe(true);
  });

  it("returns true for professional below 500 limit", () => {
    const merchant = makeMerchant({ plan: "professional", productCount: 499 });
    expect(canAddProduct(merchant)).toBe(true);
  });

  it("returns false for professional at 500 limit", () => {
    const merchant = makeMerchant({ plan: "professional", productCount: 500 });
    expect(canAddProduct(merchant)).toBe(false);
  });

  it("enforces free plan limit of 5 products", () => {
    expect(canAddProduct(makeMerchant({ plan: "free", productCount: 4 }))).toBe(true);
    expect(canAddProduct(makeMerchant({ plan: "free", productCount: 5 }))).toBe(false);
  });
});

describe("isSubscriptionActive", () => {
  it("returns true for active status", () => {
    expect(isSubscriptionActive(makeMerchant({ planStatus: "active" }))).toBe(true);
  });

  it("returns true for trialing status", () => {
    expect(isSubscriptionActive(makeMerchant({ planStatus: "trialing" }))).toBe(true);
  });

  it("returns false for past_due status", () => {
    expect(isSubscriptionActive(makeMerchant({ planStatus: "past_due" }))).toBe(false);
  });

  it("returns false for cancelled status", () => {
    expect(isSubscriptionActive(makeMerchant({ planStatus: "cancelled" }))).toBe(false);
  });
});

describe("PLANS", () => {
  it("plans are ordered by strictness (free < starter < professional < enterprise)", () => {
    const planOrder: PlanId[] = ["free", "starter", "professional", "enterprise"];
    for (let i = 0; i < planOrder.length - 1; i++) {
      const current = PLANS[planOrder[i] as PlanId];
      const next = PLANS[planOrder[i + 1] as PlanId];
      const currentMax =
        current.maxProducts === -1 ? Number.POSITIVE_INFINITY : current.maxProducts;
      const nextMax = next.maxProducts === -1 ? Number.POSITIVE_INFINITY : next.maxProducts;
      expect(nextMax).toBeGreaterThan(currentMax);
    }
  });

  it("enterprise plan has unlimited products and orders (-1)", () => {
    expect(PLANS.enterprise.maxProducts).toBe(-1);
    expect(PLANS.enterprise.maxOrdersPerMonth).toBe(-1);
  });

  it("free plan has no analytics", () => {
    expect(PLANS.free.hasAnalytics).toBe(false);
  });

  it("starter and above have analytics", () => {
    expect(PLANS.starter.hasAnalytics).toBe(true);
    expect(PLANS.professional.hasAnalytics).toBe(true);
    expect(PLANS.enterprise.hasAnalytics).toBe(true);
  });

  it("professional and above have priority support and custom domain", () => {
    expect(PLANS.professional.hasPrioritySupport).toBe(true);
    expect(PLANS.professional.hasCustomDomain).toBe(true);
    expect(PLANS.enterprise.hasPrioritySupport).toBe(true);
    expect(PLANS.enterprise.hasCustomDomain).toBe(true);
  });
});

describe("planDisplayName", () => {
  it("returns human-readable names", () => {
    expect(planDisplayName("free")).toBe("Free");
    expect(planDisplayName("starter")).toBe("Starter");
    expect(planDisplayName("professional")).toBe("Professional");
    expect(planDisplayName("enterprise")).toBe("Enterprise");
  });
});

describe("getPlanLimits", () => {
  it("returns the limits for a given plan", () => {
    const limits = getPlanLimits("starter");
    expect(limits.maxProducts).toBe(50);
    expect(limits.hasAnalytics).toBe(true);
  });
});

describe("BillingError factories", () => {
  it("PlanLimitExceededError contains correct fields", () => {
    const err = PlanLimitExceededError("starter", 50, 50);
    expect(err._tag).toBe("PlanLimitExceededError");
    expect(err.planId).toBe("starter");
    expect(err.limit).toBe(50);
    expect(err.current).toBe(50);
    expect(typeof err.message).toBe("string");
  });

  it("SubscriptionNotFoundError contains userId", () => {
    const err = SubscriptionNotFoundError("user-123");
    expect(err._tag).toBe("SubscriptionNotFoundError");
    expect(err.userId).toBe("user-123");
  });

  it("PaymentFailedError contains reason", () => {
    const err = PaymentFailedError("card_declined");
    expect(err._tag).toBe("PaymentFailedError");
    expect(err.reason).toBe("card_declined");
  });

  it("InvalidPlanTransitionError contains from and to", () => {
    const err = InvalidPlanTransitionError("professional", "starter");
    expect(err._tag).toBe("InvalidPlanTransitionError");
    expect(err.from).toBe("professional");
    expect(err.to).toBe("starter");
  });

  it("StripeCallError contains code", () => {
    const err = StripeCallError("card_declined", "Your card was declined");
    expect(err._tag).toBe("StripeCallError");
    expect(err.code).toBe("card_declined");
    expect(err.message).toBe("Your card was declined");
  });

  it("MerchantNotFoundError contains userId", () => {
    const err = MerchantNotFoundError("user-999");
    expect(err._tag).toBe("MerchantNotFoundError");
    expect(err.userId).toBe("user-999");
  });

  it("AlreadySubscribedError contains planId", () => {
    const err = AlreadySubscribedError("professional");
    expect(err._tag).toBe("AlreadySubscribedError");
    expect(err.planId).toBe("professional");
  });

  it("BillingRepositoryError accepts optional cause", () => {
    const err = BillingRepositoryError("DB write failed", Some(new Error("timeout")));
    expect(err._tag).toBe("BillingRepositoryError");
    expect(err.cause._tag).toBe("Some");
    if (err.cause._tag === "Some") {
      expect(err.cause.value).toBeInstanceOf(Error);
    }

    const errNoCause = BillingRepositoryError("simple error");
    expect(errNoCause.cause._tag).toBe("None");
  });

  it("all error factories produce objects with _tag and message", () => {
    const errors = [
      PlanLimitExceededError("free", 5, 5),
      SubscriptionNotFoundError("u"),
      PaymentFailedError("declined"),
      InvalidPlanTransitionError("professional", "free"),
      StripeCallError("code", "msg"),
      MerchantNotFoundError("u"),
      AlreadySubscribedError("starter"),
      BillingRepositoryError("oops"),
    ];

    for (const err of errors) {
      expect(typeof err._tag).toBe("string");
      expect(typeof err.message).toBe("string");
      expect(err.message.length).toBeGreaterThan(0);
    }
  });
});
