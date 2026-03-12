import type { DomainEvent } from "./events";

const makeDomainEventInternal = <TType extends string, TPayload>(
  _type: TType,
  payload: TPayload
): DomainEvent<TType, TPayload> => ({
  _type,
  _version: 1,
  eventId: crypto.randomUUID(),
  occurredAt: new Date().toISOString(),
  payload,
});

export type MerchantOnboardedPayload = {
  readonly userId: string;
  readonly storeName: string;
  readonly email: string;
  readonly plan: "free";
  readonly onboardedAt: string;
};
export type MerchantOnboarded = DomainEvent<"MerchantOnboarded", MerchantOnboardedPayload>;
export const makeMerchantOnboarded = (payload: MerchantOnboardedPayload): MerchantOnboarded =>
  makeDomainEventInternal("MerchantOnboarded", payload);

export type PlanSubscribedPayload = {
  readonly userId: string;
  readonly planId: "starter" | "professional" | "enterprise";
  readonly stripeSubscriptionId: string;
  readonly stripeCustomerId: string;
  readonly currentPeriodEnd: string;
  readonly subscribedAt: string;
};
export type PlanSubscribed = DomainEvent<"PlanSubscribed", PlanSubscribedPayload>;
export const makePlanSubscribed = (payload: PlanSubscribedPayload): PlanSubscribed =>
  makeDomainEventInternal("PlanSubscribed", payload);

export type PlanUpgradedPayload = {
  readonly userId: string;
  readonly fromPlan: "starter" | "professional" | "enterprise";
  readonly toPlan: "starter" | "professional" | "enterprise";
  readonly stripeSubscriptionId: string;
  readonly currentPeriodEnd: string;
  readonly upgradedAt: string;
};
export type PlanUpgraded = DomainEvent<"PlanUpgraded", PlanUpgradedPayload>;
export const makePlanUpgraded = (payload: PlanUpgradedPayload): PlanUpgraded =>
  makeDomainEventInternal("PlanUpgraded", payload);

export type SubscriptionCancelledPayload = {
  readonly userId: string;
  readonly planId: "starter" | "professional" | "enterprise";
  readonly stripeSubscriptionId: string;
  readonly accessUntil: string;
  readonly cancelledAt: string;
};
export type SubscriptionCancelled = DomainEvent<
  "SubscriptionCancelled",
  SubscriptionCancelledPayload
>;
export const makeSubscriptionCancelled = (
  payload: SubscriptionCancelledPayload
): SubscriptionCancelled => makeDomainEventInternal("SubscriptionCancelled", payload);

export type SubscriptionExpiredPayload = {
  readonly userId: string;
  readonly previousPlanId: "starter" | "professional" | "enterprise";
  readonly expiredAt: string;
};
export type SubscriptionExpired = DomainEvent<"SubscriptionExpired", SubscriptionExpiredPayload>;
export const makeSubscriptionExpired = (payload: SubscriptionExpiredPayload): SubscriptionExpired =>
  makeDomainEventInternal("SubscriptionExpired", payload);

export type BillingPaymentFailedPayload = {
  readonly userId: string;
  readonly planId: string;
  readonly stripeSubscriptionId: string;
  readonly reason: string;
  readonly failedAt: string;
};
export type BillingPaymentFailed = DomainEvent<"BillingPaymentFailed", BillingPaymentFailedPayload>;
export const makeBillingPaymentFailed = (
  payload: BillingPaymentFailedPayload
): BillingPaymentFailed => makeDomainEventInternal("BillingPaymentFailed", payload);

export type BillingDomainEvent =
  | MerchantOnboarded
  | PlanSubscribed
  | PlanUpgraded
  | SubscriptionCancelled
  | SubscriptionExpired
  | BillingPaymentFailed;
