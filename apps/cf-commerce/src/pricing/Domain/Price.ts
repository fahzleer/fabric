import { Either } from "effect";
import { PricingError } from "../Error/PricingError.ts";

export type CurrencyCode = "THB" | "USD" | "EUR" | "SGD";

export interface ProductPrice {
  readonly cents: number;
  readonly currency: CurrencyCode;
}

export const validatePrice = ({
  cents,
  currency,
  productId,
}: {
  cents: number;
  currency: string;
  productId: string;
}): Either.Either<ProductPrice, PricingError> => {
  if (cents <= 0) return Either.left(PricingError.invalidPrice(productId));
  return Either.flatMap(parseCurrency(currency), (code) => Either.right({ cents, currency: code }));
};

export const makeProductPrice =
  (cents: number) =>
  (currency: CurrencyCode): ProductPrice => ({ cents, currency });

export const parseCurrency = (code: string): Either.Either<CurrencyCode, PricingError> => {
  switch (code) {
    case "THB":
      return Either.right("THB");
    case "USD":
      return Either.right("USD");
    case "EUR":
      return Either.right("EUR");
    case "SGD":
      return Either.right("SGD");
    default:
      return Either.left(PricingError.invalidCurrency(code));
  }
};
