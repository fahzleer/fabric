import { Data } from "effect";

// ── Value Objects ─────────────────────────────────────────────────────────────

export type PromotionId = string & { readonly _brand: "PromotionId" };
export type CouponCode  = string & { readonly _brand: "CouponCode" };

export const makePromotionId = (): PromotionId => crypto.randomUUID() as PromotionId;

// ── Domain Errors ─────────────────────────────────────────────────────────────

export class PromotionNotFoundError extends Data.TaggedError("PromotionNotFoundError")<{
  readonly code: CouponCode;
}> {}

export class CouponExpiredError extends Data.TaggedError("CouponExpiredError")<{
  readonly code: CouponCode;
}> {}

export class CouponExhaustedError extends Data.TaggedError("CouponExhaustedError")<{
  readonly code: CouponCode;
}> {}

export class MinimumOrderNotMetError extends Data.TaggedError("MinimumOrderNotMetError")<{
  readonly code:        CouponCode;
  readonly minimumCents: number;
  readonly orderCents:  number;
}> {}

// ── Aggregate ─────────────────────────────────────────────────────────────────

export type DiscountType = "percentage" | "fixed_amount" | "free_shipping";

export interface Promotion {
  readonly id:             PromotionId;
  readonly code:           CouponCode;
  readonly description:    string;
  readonly discountType:   DiscountType;
  readonly discountValue:  number;       // percent (0-100) or cents
  readonly minimumCents:   number;       // minimum order total
  readonly maxUsageTotal:  number | null; // null = unlimited
  readonly maxUsagePerUser: number;
  readonly usageCount:     number;
  readonly startsAt:       string;
  readonly expiresAt:      string | null;
  readonly isActive:       boolean;
  readonly createdAt:      string;
  readonly updatedAt:      string;
}

// ── Domain Logic ──────────────────────────────────────────────────────────────

export const isValid = (promo: Promotion, nowIso: string): boolean => {
  const now = new Date(nowIso).getTime();
  if (!promo.isActive) return false;
  if (new Date(promo.startsAt).getTime() > now) return false;
  if (promo.expiresAt && new Date(promo.expiresAt).getTime() < now) return false;
  if (promo.maxUsageTotal !== null && promo.usageCount >= promo.maxUsageTotal) return false;
  return true;
};

export const calculateDiscount = (promo: Promotion, orderCents: number): number => {
  switch (promo.discountType) {
    case "percentage":
      return Math.round(orderCents * (promo.discountValue / 100));
    case "fixed_amount":
      return Math.min(promo.discountValue, orderCents);
    case "free_shipping":
      return 0; // handled by shipping service
  }
};
