import { Either, pipe } from "effect";
import { type ProductPrice, validatePrice } from "../Domain/Price.ts";
import { PricingError } from "../Error/PricingError.ts";

export interface PricingRequest {
  readonly productId: string;
  readonly priceCents: number;
  readonly currency: string;
  readonly quantity: number;
}

export interface PricingResult {
  readonly productId: string;
  readonly unitPrice: ProductPrice;
  readonly quantity: number;
  readonly lineTotalCents: number;
}

const validateQuantity = (req: PricingRequest): Either.Either<PricingRequest, PricingError> =>
  req.quantity === 0 ? Either.left(PricingError.zeroQuantity(req.productId)) : Either.right(req);

const validateAndBuildPrice = (req: PricingRequest): Either.Either<PricingResult, PricingError> =>
  Either.flatMap(
    validatePrice({ cents: req.priceCents, currency: req.currency, productId: req.productId }),
    (unitPrice) =>
      Either.right({
        productId: req.productId,
        unitPrice,
        quantity: req.quantity,
        lineTotalCents: unitPrice.cents * req.quantity,
      })
  );

export const validatePricing = (req: PricingRequest): Either.Either<PricingResult, PricingError> =>
  pipe(Either.right(req), Either.flatMap(validateQuantity), Either.flatMap(validateAndBuildPrice));
