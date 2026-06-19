import { type BrandedId, CURRENCY_CODES, type CurrencyCode, makeBrandedId } from "@fabric/types";

export const PRODUCT_SIZES = Object.freeze(["XS", "S", "M", "L", "XL", "XXL"] as const);
export type ProductSizeValue = (typeof PRODUCT_SIZES)[number];

// Currency codes live in the kernel (Contract === single source of truth).
// Re-exported here so existing cf-api call sites keep their import path.
export { CURRENCY_CODES };
export type CurrencyCodeValue = CurrencyCode;

export const ORDER_STATUSES = Object.freeze([
  "pending",
  "confirmed",
  "shipped",
  "delivered",
  "cancelled",
] as const);
export type OrderStatusValue = (typeof ORDER_STATUSES)[number];

export const USER_ROLES = Object.freeze(["customer", "admin", "store_owner"] as const);
export type UserRoleValue = (typeof USER_ROLES)[number];

export const VOUCHER_TYPES = Object.freeze(["percentage", "fixed", "free_shipping"] as const);
export type VoucherTypeValue = (typeof VOUCHER_TYPES)[number];

type CurrencyBrand = BrandedId<"CurrencyCode">;

export const CURRENCY_FLYWEIGHTS: Readonly<Record<CurrencyCodeValue, CurrencyBrand>> =
  Object.freeze(
    Object.fromEntries(
      CURRENCY_CODES.map((code) => [code, Object.freeze(makeBrandedId("CurrencyCode", code))])
    ) as Record<CurrencyCodeValue, CurrencyBrand>
  );

export const ORDER_STATUS = Object.freeze({
  PENDING: "pending",
  CONFIRMED: "confirmed",
  SHIPPED: "shipped",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
} as const satisfies Record<string, OrderStatusValue>);
