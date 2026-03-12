import { Either, pipe } from "effect";
import { calculate as calculateShipping } from "../Domain/Shipping.ts";
import { calculateVat } from "../Domain/Tax.ts";
import { PricingError } from "../Error/PricingError.ts";
import { type Voucher, applyVoucher } from "./Voucher.ts";

export interface CheckoutRequest {
  readonly items: ReadonlyArray<{
    readonly productId: string;
    readonly productName: string;
    readonly priceCents: number;
    readonly quantity: number;
    readonly size: string;
  }>;
  readonly voucher: Either.Either<Voucher, "NoVoucher">;
  readonly shippingAddress: { readonly country: string; readonly province: string };
  readonly currency: string;
}

export interface CheckoutResult {
  readonly subtotalCents: number;
  readonly discountCents: number;
  readonly shippingCents: number;
  readonly taxCents: number;
  readonly totalCents: number;
  readonly currency: string;
  readonly lines: ReadonlyArray<{
    readonly productId: string;
    readonly unitCents: number;
    readonly quantity: number;
  }>;
}

const validateNotEmpty = (req: CheckoutRequest): Either.Either<CheckoutRequest, PricingError> =>
  req.items.length === 0 ? Either.left(PricingError.emptyCart()) : Either.right(req);

const validateItemPrices = (req: CheckoutRequest): Either.Either<CheckoutRequest, PricingError> => {
  for (const item of req.items) {
    if (item.priceCents <= 0) return Either.left(PricingError.invalidPrice(item.productId));
    if (item.quantity === 0) return Either.left(PricingError.zeroQuantity(item.productId));
  }
  return Either.right(req);
};

const calculateSubtotal = (
  req: CheckoutRequest
): Either.Either<{ req: CheckoutRequest; subtotalCents: number }, PricingError> => {
  const subtotal = req.items.reduce((acc, item) => acc + item.priceCents * item.quantity, 0);
  return Either.right({ req, subtotalCents: subtotal });
};

const applyVoucherIfPresent =
  (voucherOpt: Either.Either<Voucher, "NoVoucher">) =>
  (state: {
    req: CheckoutRequest;
    subtotalCents: number;
  }): Either.Either<
    { req: CheckoutRequest; subtotalCents: number; discountCents: number },
    PricingError
  > => {
    if (Either.isLeft(voucherOpt)) {
      return Either.right({ ...state, discountCents: 0 });
    }
    return Either.map(applyVoucher(voucherOpt.right)(state.subtotalCents), (discountCents) => ({
      ...state,
      discountCents,
    }));
  };

const addShipping =
  (address: { country: string; province: string }) =>
  (state: {
    req: CheckoutRequest;
    subtotalCents: number;
    discountCents: number;
  }): Either.Either<CheckoutResult, PricingError> =>
    Either.flatMap(calculateShipping(address)(state.subtotalCents), (shippingCents) => {
      const taxBase = state.subtotalCents - state.discountCents + shippingCents;
      const taxCents = calculateVat(taxBase, address.country);
      const lines = state.req.items.map((item) => ({
        productId: item.productId,
        unitCents: item.priceCents,
        quantity: item.quantity,
      }));
      return Either.right({
        subtotalCents: state.subtotalCents,
        discountCents: state.discountCents,
        shippingCents,
        taxCents,
        totalCents: taxBase + taxCents,
        currency: state.req.currency,
        lines,
      });
    });

const validateCurrency = (result: CheckoutResult): Either.Either<CheckoutResult, PricingError> => {
  switch (result.currency) {
    case "THB":
    case "USD":
    case "EUR":
    case "SGD":
      return Either.right(result);
    default:
      return Either.left(PricingError.invalidCurrency(result.currency));
  }
};

export const checkoutFlow = (req: CheckoutRequest): Either.Either<CheckoutResult, PricingError> =>
  pipe(
    Either.right(req),
    Either.flatMap(validateNotEmpty),
    Either.flatMap(validateItemPrices),
    Either.flatMap(calculateSubtotal),
    Either.flatMap(applyVoucherIfPresent(req.voucher)),
    Either.flatMap(addShipping(req.shippingAddress)),
    Either.flatMap(validateCurrency)
  );
