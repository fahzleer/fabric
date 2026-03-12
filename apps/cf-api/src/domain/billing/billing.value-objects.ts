import type { Maybe } from "@fabric/types";

export type PlanId = "free" | "starter" | "professional" | "enterprise";

export type PlanStatus = "active" | "trialing" | "past_due" | "cancelled";

const PLAN_RANK: Readonly<Record<PlanId, number>> = {
  free: 0,
  starter: 1,
  professional: 2,
  enterprise: 3,
};

export interface PlanLimits {
  readonly maxProducts: number;
  readonly maxOrdersPerMonth: number;
  readonly hasAnalytics: boolean;
  readonly hasPrioritySupport: boolean;
  readonly hasCustomDomain: boolean;
  readonly hasBulkImport: boolean;
}

export const PLANS: Readonly<Record<PlanId, PlanLimits>> = {
  free: {
    maxProducts: 5,
    maxOrdersPerMonth: 50,
    hasAnalytics: false,
    hasPrioritySupport: false,
    hasCustomDomain: false,
    hasBulkImport: false,
  },
  starter: {
    maxProducts: 50,
    maxOrdersPerMonth: 500,
    hasAnalytics: true,
    hasPrioritySupport: false,
    hasCustomDomain: false,
    hasBulkImport: false,
  },
  professional: {
    maxProducts: 500,
    maxOrdersPerMonth: -1,
    hasAnalytics: true,
    hasPrioritySupport: true,
    hasCustomDomain: true,
    hasBulkImport: true,
  },
  enterprise: {
    maxProducts: -1,
    maxOrdersPerMonth: -1,
    hasAnalytics: true,
    hasPrioritySupport: true,
    hasCustomDomain: true,
    hasBulkImport: true,
  },
};

export interface Merchant {
  readonly userId: string;
  readonly storeName: string;
  readonly email: string;
  readonly plan: PlanId;
  readonly planStatus: PlanStatus;
  readonly stripeCustomerId: Maybe<string>;
  readonly stripeSubscriptionId: Maybe<string>;
  readonly productCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly planExpiresAt: Maybe<string>;
  readonly storeSlug: Maybe<string>;
}

export const isPlanSufficient = (userPlan: PlanId, requiredPlan: PlanId): boolean =>
  PLAN_RANK[userPlan] >= PLAN_RANK[requiredPlan];

export const canAddProduct = (merchant: Merchant): boolean => {
  const limits = PLANS[merchant.plan];
  if (limits.maxProducts === -1) return true;
  return merchant.productCount < limits.maxProducts;
};

export const isSubscriptionActive = (merchant: Merchant): boolean =>
  merchant.planStatus === "active" || merchant.planStatus === "trialing";

export const planDisplayName = (planId: PlanId): string => {
  const names: Readonly<Record<PlanId, string>> = {
    free: "Free",
    starter: "Starter",
    professional: "Professional",
    enterprise: "Enterprise",
  };
  return names[planId];
};

export const getPlanLimits = (planId: PlanId): PlanLimits => PLANS[planId];
