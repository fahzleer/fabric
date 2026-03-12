import { Either } from "effect";
import { PricingError } from "../Error/PricingError.ts";

export interface ShippingAddress {
  readonly country: string;
  readonly province: string;
}

interface ShippingRate {
  readonly baseCents: number;
  readonly freeAboveCents: number;
}

const rateFor = (country: string): Either.Either<ShippingRate, PricingError> => {
  switch (country) {
    case "TH":
      return Either.right({ baseCents: 4900, freeAboveCents: 50000 });
    case "SG":
      return Either.right({ baseCents: 29900, freeAboveCents: 150000 });
    case "US":
      return Either.right({ baseCents: 49900, freeAboveCents: 250000 });
    case "GB":
      return Either.right({ baseCents: 59900, freeAboveCents: 300000 });
    case "DE":
      return Either.right({ baseCents: 49900, freeAboveCents: 250000 });
    case "FR":
      return Either.right({ baseCents: 49900, freeAboveCents: 250000 });
    case "AU":
      return Either.right({ baseCents: 69900, freeAboveCents: 350000 });
    default:
      return Either.left(PricingError.undeliverableAddress(country, ""));
  }
};

export const calculate =
  (address: ShippingAddress) =>
  (subtotalCents: number): Either.Either<number, PricingError> =>
    Either.flatMap(rateFor(address.country), (rate) => {
      const shippingCents =
        rate.freeAboveCents > 0 && subtotalCents >= rate.freeAboveCents ? 0 : rate.baseCents;
      return Either.right(shippingCents);
    });
