import { Either } from "effect";
import type { Voucher, VoucherType } from "../Domain/Discount.ts";
import { type PricingError, errorMessage, errorTag } from "../Error/PricingError.ts";
import type { CheckoutRequest, CheckoutResult } from "../Pipeline/Checkout.ts";
import type { Reservation, ReservationRequest } from "../Pipeline/Inventory.ts";
import type { PricingRequest, PricingResult } from "../Pipeline/Pricing.ts";

interface VoucherRaw {
  code: string;
  discountTag: string;
  discountPct: number;
  discountAmount: number;
  discountBuy: number;
  discountGet: number;
  minOrderCents: number;
  maxUsages: number;
  currentUsages: number;
  validUntilEpoch: number;
  currentEpoch: number;
}

interface CheckoutRequestRaw {
  items: Array<{
    productId: string;
    productName: string;
    priceCents: number;
    quantity: number;
    size: string;
  }>;
  voucher: VoucherRaw;
  shippingAddress: { country: string; province: string };
  currency: string;
}

interface VoucherApplyRaw {
  voucher: VoucherRaw;
  subtotalCents: number;
}

export const decodeCheckoutRequest = (
  body: unknown
): Either.Either<CheckoutRequest, PricingError> => {
  try {
    const raw = body as CheckoutRequestRaw;
    return rawToCheckout(raw);
  } catch {
    return Either.left({
      _tag: "ShippingCalculationFailed",
      reason: "JSON parse error at /checkout/calculate",
    });
  }
};

export const decodePricingRequest = (
  body: unknown
): Either.Either<PricingRequest, PricingError> => {
  try {
    return Either.right(body as PricingRequest);
  } catch {
    return Either.left({
      _tag: "ShippingCalculationFailed",
      reason: "JSON parse error at /pricing/validate",
    });
  }
};

export const decodeInventoryRequest = (
  body: unknown
): Either.Either<ReservationRequest, PricingError> => {
  try {
    return Either.right(body as ReservationRequest);
  } catch {
    return Either.left({
      _tag: "ShippingCalculationFailed",
      reason: "JSON parse error at /inventory/reserve",
    });
  }
};

export const decodeVoucherApplyRequest = (
  body: unknown
): Either.Either<{ voucher: Voucher; subtotalCents: number }, PricingError> => {
  try {
    const raw = body as VoucherApplyRaw;
    return Either.flatMap(rawToVoucher(raw.voucher), (voucher) =>
      Either.right({ voucher, subtotalCents: raw.subtotalCents })
    );
  } catch {
    return Either.left({
      _tag: "ShippingCalculationFailed",
      reason: "JSON parse error at /voucher/apply",
    });
  }
};

const rawToCheckout = (raw: CheckoutRequestRaw): Either.Either<CheckoutRequest, PricingError> => {
  if (!raw.voucher?.code) {
    return Either.right({
      items: raw.items,
      voucher: Either.left("NoVoucher" as const),
      shippingAddress: raw.shippingAddress,
      currency: raw.currency,
    });
  }
  return Either.flatMap(rawToVoucher(raw.voucher), (v) =>
    Either.right({
      items: raw.items,
      voucher: Either.right(v),
      shippingAddress: raw.shippingAddress,
      currency: raw.currency,
    })
  );
};

const rawToVoucherType = (raw: VoucherRaw): Either.Either<VoucherType, PricingError> => {
  switch (raw.discountTag) {
    case "PercentOff":
      return Either.right({ _tag: "PercentOff", pct: raw.discountPct });
    case "FixedOff":
      return Either.right({ _tag: "FixedOff", amount: raw.discountAmount });
    case "FreeShipping":
      return Either.right({ _tag: "FreeShipping" });
    case "BuyXGetY":
      return Either.right({ _tag: "BuyXGetY", buy: raw.discountBuy, get: raw.discountGet });
    default:
      return Either.left({ _tag: "InvalidDiscount", code: raw.code });
  }
};

const rawToVoucher = (raw: VoucherRaw): Either.Either<Voucher, PricingError> =>
  Either.flatMap(rawToVoucherType(raw), (discountType) =>
    Either.right({
      code: raw.code,
      discountType,
      minOrderCents: raw.minOrderCents,
      maxUsages: raw.maxUsages,
      currentUsages: raw.currentUsages,
      validUntilEpoch: raw.validUntilEpoch,
      currentEpoch: raw.currentEpoch,
    })
  );

export const encodeResult = <A>(
  result: Either.Either<A, PricingError>,
  encodeOk: (value: A) => unknown
): unknown => {
  if (Either.isRight(result)) {
    return { ok: true, value: encodeOk(result.right) };
  }
  return {
    ok: false,
    error: {
      tag: errorTag(result.left),
      message: errorMessage(result.left),
    },
  };
};

export const encodeCheckoutResult = (r: CheckoutResult): unknown => ({
  subtotalCents: r.subtotalCents,
  discountCents: r.discountCents,
  shippingCents: r.shippingCents,
  taxCents: r.taxCents,
  totalCents: r.totalCents,
  currency: r.currency,
  lines: r.lines.map((line) => ({
    productId: line.productId,
    unitCents: line.unitCents,
    quantity: line.quantity,
  })),
});

export const encodePricingResult = (r: PricingResult): unknown => ({
  productId: r.productId,
  unitPriceCents: r.unitPrice.cents,
  quantity: r.quantity,
  lineTotalCents: r.lineTotalCents,
});

export const encodeInventoryResult = (r: Reservation): unknown => ({
  productId: r.productId,
  quantity: r.quantity,
  expiresInSeconds: r.expiresInSeconds,
  availableAfterReserve: r.availableAfterReserve,
});

export const encodeVoucherResult = (discountCents: number): unknown => ({
  discountCents,
});
