import type { Maybe, Result } from "@fabric/types";
import { None } from "@fabric/types";

export type PayoutStatus = "pending" | "approved" | "rejected";

export interface PayoutRequest {
  readonly id: string;
  readonly userId: string;
  readonly requestedAt: string;
  readonly amountCents: number;
  readonly bankInfo: string;
  readonly status: PayoutStatus;
  readonly resolvedAt: Maybe<string>;
  readonly adminNote: Maybe<string>;
}

export interface PayoutBalance {
  readonly totalRevenueCents: number;
  readonly paidOutCents: number;
  readonly platformFeePct: number;
  readonly availableBalanceCents: number;
}

export interface PayoutRepositoryError {
  readonly _tag: "PayoutRepositoryError";
  readonly message: string;
  readonly cause: Maybe<unknown>;
}

export interface InsufficientBalanceError {
  readonly _tag: "InsufficientBalanceError";
  readonly message: string;
  readonly availableCents: number;
  readonly requestedCents: number;
}

export interface PayoutNotFoundError {
  readonly _tag: "PayoutNotFoundError";
  readonly message: string;
  readonly requestId: string;
}

export type PayoutError = PayoutRepositoryError | InsufficientBalanceError | PayoutNotFoundError;

export const PayoutRepositoryError = (
  message: string,
  cause: Maybe<unknown> = None()
): PayoutRepositoryError => ({ _tag: "PayoutRepositoryError", message, cause });

export const InsufficientBalanceError = (
  availableCents: number,
  requestedCents: number
): InsufficientBalanceError => ({
  _tag: "InsufficientBalanceError",
  message: `Insufficient balance: available ฿${(availableCents / 100).toFixed(0)}, requested ฿${(requestedCents / 100).toFixed(0)}`,
  availableCents,
  requestedCents,
});

export const PayoutNotFoundError = (requestId: string): PayoutNotFoundError => ({
  _tag: "PayoutNotFoundError",
  message: `Payout request not found: ${requestId}`,
  requestId,
});

export const PAYOUT_REPOSITORY = Symbol("PAYOUT_REPOSITORY");

export interface PayoutRepositoryPort {
  getBalance(userId: string): Promise<Result<PayoutBalance, PayoutRepositoryError>>;

  requestPayout(
    userId: string,
    amountCents: number,
    bankInfo: string
  ): Promise<Result<PayoutRequest, InsufficientBalanceError | PayoutRepositoryError>>;

  listPayouts(userId: string): Promise<Result<PayoutRequest[], PayoutRepositoryError>>;

  listAllPending(): Promise<Result<PayoutRequest[], PayoutRepositoryError>>;

  approvePayout(
    requestId: string,
    ownerUserId: string
  ): Promise<Result<void, PayoutNotFoundError | PayoutRepositoryError>>;

  rejectPayout(
    requestId: string,
    ownerUserId: string,
    reason: string
  ): Promise<Result<void, PayoutNotFoundError | PayoutRepositoryError>>;
}
