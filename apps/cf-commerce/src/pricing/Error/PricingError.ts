export type PricingError =
  | { readonly _tag: "EmptyCart" }
  | { readonly _tag: "InvalidPrice"; readonly productId: string }
  | { readonly _tag: "ZeroQuantity"; readonly productId: string }
  | {
      readonly _tag: "InsufficientStock";
      readonly productId: string;
      readonly requested: number;
      readonly available: number;
    }
  | { readonly _tag: "StockLockFailed"; readonly productId: string }
  | { readonly _tag: "VoucherExpired"; readonly code: string }
  | { readonly _tag: "VoucherExhausted"; readonly code: string }
  | { readonly _tag: "VoucherNotFound"; readonly code: string }
  | {
      readonly _tag: "OrderBelowMinimum";
      readonly code: string;
      readonly minCents: number;
    }
  | { readonly _tag: "InvalidDiscount"; readonly code: string }
  | {
      readonly _tag: "UndeliverableAddress";
      readonly country: string;
      readonly province: string;
    }
  | { readonly _tag: "ShippingCalculationFailed"; readonly reason: string }
  | { readonly _tag: "InvalidCurrency"; readonly code: string };

export const PricingError = {
  emptyCart: (): PricingError => ({ _tag: "EmptyCart" }),
  invalidPrice: (productId: string): PricingError => ({
    _tag: "InvalidPrice",
    productId,
  }),
  zeroQuantity: (productId: string): PricingError => ({
    _tag: "ZeroQuantity",
    productId,
  }),
  insufficientStock: (productId: string, requested: number, available: number): PricingError => ({
    _tag: "InsufficientStock",
    productId,
    requested,
    available,
  }),
  stockLockFailed: (productId: string): PricingError => ({
    _tag: "StockLockFailed",
    productId,
  }),
  voucherExpired: (code: string): PricingError => ({ _tag: "VoucherExpired", code }),
  voucherExhausted: (code: string): PricingError => ({
    _tag: "VoucherExhausted",
    code,
  }),
  voucherNotFound: (code: string): PricingError => ({ _tag: "VoucherNotFound", code }),
  orderBelowMinimum: (code: string, minCents: number): PricingError => ({
    _tag: "OrderBelowMinimum",
    code,
    minCents,
  }),
  invalidDiscount: (code: string): PricingError => ({ _tag: "InvalidDiscount", code }),
  undeliverableAddress: (country: string, province: string): PricingError => ({
    _tag: "UndeliverableAddress",
    country,
    province,
  }),
  shippingCalculationFailed: (reason: string): PricingError => ({
    _tag: "ShippingCalculationFailed",
    reason,
  }),
  invalidCurrency: (code: string): PricingError => ({
    _tag: "InvalidCurrency",
    code,
  }),
} as const;

export const errorTag = (err: PricingError): string => err._tag;

export const errorMessage = (err: PricingError): string => {
  switch (err._tag) {
    case "EmptyCart":
      return "Cart is empty";
    case "InvalidPrice":
      return `Invalid price for product: ${err.productId}`;
    case "ZeroQuantity":
      return `Zero quantity for product: ${err.productId}`;
    case "InsufficientStock":
      return `Insufficient stock for ${err.productId}: requested ${err.requested}, available ${err.available}`;
    case "StockLockFailed":
      return `Failed to lock stock for: ${err.productId}`;
    case "VoucherExpired":
      return `Voucher expired: ${err.code}`;
    case "VoucherExhausted":
      return `Voucher exhausted: ${err.code}`;
    case "VoucherNotFound":
      return `Voucher not found: ${err.code}`;
    case "OrderBelowMinimum":
      return `Order below minimum for voucher ${err.code}: minimum is ${err.minCents} cents`;
    case "InvalidDiscount":
      return `Invalid discount for voucher: ${err.code}`;
    case "UndeliverableAddress":
      return `Cannot deliver to ${err.country}, ${err.province}`;
    case "ShippingCalculationFailed":
      return `Shipping calculation failed: ${err.reason}`;
    case "InvalidCurrency":
      return `Invalid currency: ${err.code}`;
  }
};
