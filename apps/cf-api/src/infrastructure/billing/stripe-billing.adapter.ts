import { Err, Ok } from "@fabric/types";
import type { Result } from "@fabric/types";
import Stripe from "stripe";
import type { BillingPort, StripeSubscription } from "../../application/ports/billing.port";
import { BillingRepositoryError, StripeCallError } from "../../domain/billing/billing.errors";
import type { BillingError } from "../../domain/billing/billing.errors";

const STRIPE_API_VERSION = "2025-02-24.acacia" as const;

export class StripeBillingAdapter implements BillingPort {
  private readonly stripe: Stripe | null;

  constructor(secretKey: string) {
    this.stripe = secretKey
      ? new Stripe(secretKey, { apiVersion: STRIPE_API_VERSION, typescript: true })
      : null;
  }

  private get s(): Result<Stripe, BillingError> {
    return this.stripe
      ? Ok(this.stripe)
      : Err(
          StripeCallError(
            "stripe_not_configured",
            "STRIPE_SECRET_KEY is not set — billing unavailable in dev"
          )
        );
  }

  async createCustomer(
    email: string,
    name: string,
    userId: string
  ): Promise<Result<string, BillingError>> {
    const r = this.s;
    if (r._tag !== "Ok") return r;
    try {
      const customer = await r.value.customers.create({
        email,
        name,
        metadata: { userId },
      });
      return Ok(customer.id);
    } catch (cause) {
      const err = cause as Stripe.StripeRawError;
      return Err(
        StripeCallError(err.code ?? "customer_create_failed", err.message ?? String(cause))
      );
    }
  }

  async createSubscription(
    customerId: string,
    priceId: string
  ): Promise<Result<StripeSubscription, BillingError>> {
    const r = this.s;
    if (r._tag !== "Ok") return r;
    try {
      const sub = await r.value.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        payment_behavior: "default_incomplete",
        proration_behavior: "create_prorations",
        expand: ["latest_invoice.payment_intent"],
      });
      return Ok(toStripeSubscription(sub));
    } catch (cause) {
      const err = cause as Stripe.StripeRawError;
      return Err(
        StripeCallError(err.code ?? "subscription_create_failed", err.message ?? String(cause))
      );
    }
  }

  async retrieveSubscription(
    subscriptionId: string
  ): Promise<Result<StripeSubscription, BillingError>> {
    const r = this.s;
    if (r._tag !== "Ok") return r;
    try {
      const sub = await r.value.subscriptions.retrieve(subscriptionId);
      return Ok(toStripeSubscription(sub));
    } catch (cause) {
      const err = cause as Stripe.StripeRawError;
      return Err(
        StripeCallError(err.code ?? "subscription_retrieve_failed", err.message ?? String(cause))
      );
    }
  }

  async getCustomerUserId(customerId: string): Promise<Result<string, BillingError>> {
    const r = this.s;
    if (r._tag !== "Ok") return r;
    try {
      const customer = await r.value.customers.retrieve(customerId);
      if (customer.deleted) {
        return Err(StripeCallError("customer_deleted", `Stripe customer ${customerId} is deleted`));
      }

      const userId = (customer as Stripe.Customer).metadata?.userId;
      if (!userId) {
        return Err(
          BillingRepositoryError(
            `Stripe customer ${customerId} has no userId in metadata. Was it created with createCustomer()?`
          )
        );
      }

      return Ok(userId);
    } catch (cause) {
      const err = cause as Stripe.StripeRawError;
      return Err(
        StripeCallError(err.code ?? "customer_retrieve_failed", err.message ?? String(cause))
      );
    }
  }

  async changeSubscriptionPlan(
    subscriptionId: string,
    newPriceId: string
  ): Promise<Result<StripeSubscription, BillingError>> {
    const r = this.s;
    if (r._tag !== "Ok") return r;
    try {
      const existing = await r.value.subscriptions.retrieve(subscriptionId);
      const itemId = existing.items.data[0]?.id;

      if (!itemId) {
        return Err(
          StripeCallError("no_subscription_item", `Subscription ${subscriptionId} has no items`)
        );
      }

      const updated = await r.value.subscriptions.update(subscriptionId, {
        items: [{ id: itemId, price: newPriceId }],
        proration_behavior: "create_prorations",
      });

      return Ok(toStripeSubscription(updated));
    } catch (cause) {
      const err = cause as Stripe.StripeRawError;
      return Err(
        StripeCallError(err.code ?? "subscription_update_failed", err.message ?? String(cause))
      );
    }
  }

  async cancelSubscription(subscriptionId: string): Promise<Result<void, BillingError>> {
    const r = this.s;
    if (r._tag !== "Ok") return r;
    try {
      await r.value.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });
      return Ok(undefined);
    } catch (cause) {
      const err = cause as Stripe.StripeRawError;
      return Err(
        StripeCallError(err.code ?? "subscription_cancel_failed", err.message ?? String(cause))
      );
    }
  }

  async createPortalSession(
    customerId: string,
    returnUrl: string
  ): Promise<Result<string, BillingError>> {
    const r = this.s;
    if (r._tag !== "Ok") return r;
    try {
      const session = await r.value.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
      });
      return Ok(session.url);
    } catch (cause) {
      const err = cause as Stripe.StripeRawError;
      return Err(
        StripeCallError(err.code ?? "portal_session_failed", err.message ?? String(cause))
      );
    }
  }

  constructWebhookEvent(rawBody: string, signature: string, webhookSecret: string): Stripe.Event {
    if (!this.stripe) throw new Error("STRIPE_SECRET_KEY is not configured");
    return this.stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  }
}

function toStripeSubscription(sub: Stripe.Subscription): StripeSubscription {
  const priceId = sub.items.data[0]?.price.id ?? "";
  return {
    subscriptionId: sub.id,
    customerId: String(sub.customer),
    status: sub.status as StripeSubscription["status"],
    currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
    priceId,
  };
}
