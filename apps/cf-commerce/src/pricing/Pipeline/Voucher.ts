import { Either, pipe } from "effect";
import { type Voucher, computeDiscount } from "../Domain/Discount.ts";
import { PricingError } from "../Error/PricingError.ts";

export type { Voucher, VoucherType } from "../Domain/Discount.ts";

const checkExpiry = (voucher: Voucher): Either.Either<Voucher, PricingError> =>
  voucher.currentEpoch > voucher.validUntilEpoch
    ? Either.left(PricingError.voucherExpired(voucher.code))
    : Either.right(voucher);

const checkUsageLimit = (voucher: Voucher): Either.Either<Voucher, PricingError> =>
  voucher.currentUsages >= voucher.maxUsages
    ? Either.left(PricingError.voucherExhausted(voucher.code))
    : Either.right(voucher);

const checkMinOrder =
  (subtotalCents: number) =>
  (voucher: Voucher): Either.Either<Voucher, PricingError> =>
    subtotalCents < voucher.minOrderCents
      ? Either.left(PricingError.orderBelowMinimum(voucher.code, voucher.minOrderCents))
      : Either.right(voucher);

const discountStep =
  (subtotalCents: number) =>
  (voucher: Voucher): Either.Either<number, PricingError> =>
    Either.right(computeDiscount(voucher)(subtotalCents));

export const applyVoucher =
  (voucher: Voucher) =>
  (subtotalCents: number): Either.Either<number, PricingError> =>
    pipe(
      Either.right(voucher),
      Either.flatMap(checkExpiry),
      Either.flatMap(checkUsageLimit),
      Either.flatMap(checkMinOrder(subtotalCents)),
      Either.flatMap(discountStep(subtotalCents))
    );
