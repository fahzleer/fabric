import type { Result } from "@fabric/types";
import type { BillingError } from "../../domain/billing/billing.errors";

export interface StripeSubscription {
  readonly subscriptionId: string;
  readonly customerId: string;
  readonly status: "active" | "trialing" | "past_due" | "canceled" | "unpaid" | "incomplete";
  readonly currentPeriodEnd: string;
  readonly priceId: string;
}

export interface BillingPort {
  createCustomer(
    email: string,
    name: string,
    userId: string
  ): Promise<Result<string, BillingError>>;

  retrieveSubscription(subscriptionId: string): Promise<Result<StripeSubscription, BillingError>>;

  getCustomerUserId(customerId: string): Promise<Result<string, BillingError>>;

  createSubscription(
    customerId: string,
    priceId: string
  ): Promise<Result<StripeSubscription, BillingError>>;

  changeSubscriptionPlan(
    subscriptionId: string,
    newPriceId: string
  ): Promise<Result<StripeSubscription, BillingError>>;

  cancelSubscription(subscriptionId: string): Promise<Result<void, BillingError>>;

  createPortalSession(customerId: string, returnUrl: string): Promise<Result<string, BillingError>>;
}

export const BILLING_PORT = Symbol("BillingPort");
