import type { Maybe, TaggedError } from "@fabric/types";
import { None } from "@fabric/types";
import type { PlanId } from "./billing.value-objects";

export interface PlanLimitExceededError extends TaggedError<"PlanLimitExceededError"> {
  readonly planId: PlanId;
  readonly limit: number;
  readonly current: number;
}

export interface SubscriptionNotFoundError extends TaggedError<"SubscriptionNotFoundError"> {
  readonly userId: string;
}

export interface PaymentFailedError extends TaggedError<"PaymentFailedError"> {
  readonly reason: string;
}

export interface InvalidPlanTransitionError extends TaggedError<"InvalidPlanTransitionError"> {
  readonly from: PlanId;
  readonly to: PlanId;
}

export interface StripeCallError extends TaggedError<"StripeCallError"> {
  readonly code: string;
}

export interface MerchantNotFoundError extends TaggedError<"MerchantNotFoundError"> {
  readonly userId: string;
}

export interface AlreadySubscribedError extends TaggedError<"AlreadySubscribedError"> {
  readonly planId: PlanId;
}

export interface BillingRepositoryError extends TaggedError<"BillingRepositoryError"> {
  readonly cause: Maybe<unknown>;
}

export type BillingError =
  | PlanLimitExceededError
  | SubscriptionNotFoundError
  | PaymentFailedError
  | InvalidPlanTransitionError
  | StripeCallError
  | MerchantNotFoundError
  | AlreadySubscribedError
  | BillingRepositoryError;

export const PlanLimitExceededError = (
  planId: PlanId,
  limit: number,
  current: number
): PlanLimitExceededError => ({
  _tag: "PlanLimitExceededError",
  message: `Plan '${planId}' allows ${limit} products; currently at ${current}`,
  planId,
  limit,
  current,
});

export const SubscriptionNotFoundError = (userId: string): SubscriptionNotFoundError => ({
  _tag: "SubscriptionNotFoundError",
  message: `No subscription found for user ${userId}`,
  userId,
});

export const PaymentFailedError = (reason: string): PaymentFailedError => ({
  _tag: "PaymentFailedError",
  message: `Payment failed: ${reason}`,
  reason,
});

export const InvalidPlanTransitionError = (
  from: PlanId,
  to: PlanId
): InvalidPlanTransitionError => ({
  _tag: "InvalidPlanTransitionError",
  message: `Cannot transition from plan '${from}' to '${to}'`,
  from,
  to,
});

export const StripeCallError = (code: string, message: string): StripeCallError => ({
  _tag: "StripeCallError",
  message,
  code,
});

export const MerchantNotFoundError = (userId: string): MerchantNotFoundError => ({
  _tag: "MerchantNotFoundError",
  message: `Merchant profile not found for user ${userId}`,
  userId,
});

export const AlreadySubscribedError = (planId: PlanId): AlreadySubscribedError => ({
  _tag: "AlreadySubscribedError",
  message: `User is already subscribed to plan '${planId}'`,
  planId,
});

export const BillingRepositoryError = (
  message: string,
  cause: Maybe<unknown> = None()
): BillingRepositoryError => ({
  _tag: "BillingRepositoryError",
  message,
  cause,
});
