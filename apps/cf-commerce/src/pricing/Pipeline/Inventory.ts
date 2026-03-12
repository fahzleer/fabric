import { Either, pipe } from "effect";
import { PricingError } from "../Error/PricingError.ts";

export interface ReservationRequest {
  readonly productId: string;
  readonly variant: { readonly size: string; readonly color: string };
  readonly quantity: number;
  readonly currentStock: number;
  readonly reservedStock: number;
  readonly reservationTtlSeconds: number;
}

export interface Reservation {
  readonly productId: string;
  readonly variant: { readonly size: string; readonly color: string };
  readonly quantity: number;
  readonly expiresInSeconds: number;
  readonly availableAfterReserve: number;
}

const validateQuantityPositive = (
  req: ReservationRequest
): Either.Either<ReservationRequest, PricingError> =>
  req.quantity === 0 ? Either.left(PricingError.zeroQuantity(req.productId)) : Either.right(req);

const computeAvailable = (
  req: ReservationRequest
): Either.Either<{ req: ReservationRequest; available: number }, PricingError> => {
  const available =
    req.currentStock >= req.reservedStock ? req.currentStock - req.reservedStock : 0;
  return Either.right({ req, available });
};

const checkSufficient = ({
  req,
  available,
}: {
  req: ReservationRequest;
  available: number;
}): Either.Either<{ req: ReservationRequest; available: number }, PricingError> =>
  available < req.quantity
    ? Either.left(PricingError.insufficientStock(req.productId, req.quantity, available))
    : Either.right({ req, available });

const buildReservation = ({
  req,
  available,
}: {
  req: ReservationRequest;
  available: number;
}): Either.Either<Reservation, PricingError> =>
  Either.right({
    productId: req.productId,
    variant: req.variant,
    quantity: req.quantity,
    expiresInSeconds: req.reservationTtlSeconds,
    availableAfterReserve: available - req.quantity,
  });
  
export const reserveStock = (req: ReservationRequest): Either.Either<Reservation, PricingError> =>
  pipe(
    Either.right(req),
    Either.flatMap(validateQuantityPositive),
    Either.flatMap(computeAvailable),
    Either.flatMap(checkSufficient),
    Either.flatMap(buildReservation)
  );
