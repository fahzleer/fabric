import { Err, None, Ok, Some, isSome } from "@fabric/types";
import type { Result } from "@fabric/types";
import type { BillingPort, StripeSubscription } from "../../application/ports/billing.port";
import type { MerchantRepositoryPort } from "../../application/ports/merchant.repository.port";
import type {
  BillingError,
  BillingRepositoryError as BillingRepositoryErrorType,
  MerchantNotFoundError as MerchantNotFoundErrorType,
} from "../../domain/billing/billing.errors";
import {
  AlreadySubscribedError,
  StripeCallError,
  SubscriptionNotFoundError,
} from "../../domain/billing/billing.errors";
import type { Merchant, PlanId, PlanStatus } from "../../domain/billing/billing.value-objects";
import type { StripeBillingAdapter } from "../../infrastructure/billing/stripe-billing.adapter";

export interface BillingConfig {
  readonly stripePriceIds: Readonly<Partial<Record<PlanId, string>>>;
  readonly portalReturnUrl: string;
  readonly webhookSecret: string;
}

interface StripeSubscriptionEvent {
  readonly id: string;
  readonly customer: string;
  readonly status: string;
  readonly current_period_end: number;
}

interface StripeInvoiceEvent {
  readonly subscription: string | null;
}

interface StripeWebhookEvent {
  readonly type: string;
  readonly data: { readonly object: unknown };
}

export interface MerchantAnalytics {
  readonly completedOrderCount: number;
  readonly totalRevenueCents: number;
  readonly productCount: number;
  readonly plan: string;
  readonly planStatus: string;
}

export class BillingService {
  constructor(
    private readonly billing: BillingPort,
    private readonly stripeAdapter: StripeBillingAdapter,
    private readonly merchantRepo: MerchantRepositoryPort,
    private readonly config: BillingConfig
  ) {}

  async onboardMerchant(
    userId: string,
    storeName: string,
    email: string
  ): Promise<Result<Merchant, BillingError>> {
    const existing = await this.merchantRepo.findByUserId(userId);
    if (existing._tag === "Ok") return Ok(existing.value);

    if (existing.error._tag !== "MerchantNotFoundError") {
      return Err(existing.error as BillingRepositoryErrorType);
    }

    return this.merchantRepo.create({
      userId,
      storeName,
      email,
      plan: "free",
      planStatus: "active",
      stripeCustomerId: None<string>(),
      stripeSubscriptionId: None<string>(),
      productCount: 0,
      planExpiresAt: None<string>(),
      storeSlug: None<string>(),
    });
  }

  async subscribeToPlan(
    userId: string,
    planId: Exclude<PlanId, "free">
  ): Promise<Result<Merchant, BillingError>> {
    const priceId = this.config.stripePriceIds[planId];
    if (!priceId) {
      return Err(
        StripeCallError("no_price_id", `No Stripe price ID configured for plan '${planId}'`)
      );
    }

    const merchantResult = await this.merchantRepo.findByUserId(userId);
    if (merchantResult._tag === "Err") return Err(merchantResult.error);
    const merchant = merchantResult.value;

    if (
      merchant.plan === planId &&
      (merchant.planStatus === "active" || merchant.planStatus === "trialing")
    ) {
      return Err(AlreadySubscribedError(planId));
    }

    let customerId: string;
    if (isSome(merchant.stripeCustomerId)) {
      customerId = merchant.stripeCustomerId.value;
    } else {
      const customerResult = await this.billing.createCustomer(
        merchant.email,
        merchant.storeName,
        userId
      );
      if (customerResult._tag === "Err") return Err(customerResult.error);
      customerId = customerResult.value;
    }

    if (isSome(merchant.stripeSubscriptionId)) {
      const upgradeResult = await this.billing.changeSubscriptionPlan(
        merchant.stripeSubscriptionId.value,
        priceId
      );
      if (upgradeResult._tag === "Err") return Err(upgradeResult.error);

      return this.merchantRepo.save(
        applySubscription(merchant, planId, upgradeResult.value, customerId)
      );
    }

    const subResult = await this.billing.createSubscription(customerId, priceId);
    if (subResult._tag === "Err") return Err(subResult.error);

    return this.merchantRepo.save(applySubscription(merchant, planId, subResult.value, customerId));
  }

  async cancelSubscription(userId: string): Promise<Result<void, BillingError>> {
    const merchantResult = await this.merchantRepo.findByUserId(userId);
    if (merchantResult._tag === "Err") return Err(merchantResult.error);
    const merchant = merchantResult.value;

    if (!isSome(merchant.stripeSubscriptionId)) {
      return Err(SubscriptionNotFoundError(userId));
    }

    return this.billing.cancelSubscription(merchant.stripeSubscriptionId.value);
  }

  async getPortalUrl(userId: string): Promise<Result<string, BillingError>> {
    const merchantResult = await this.merchantRepo.findByUserId(userId);
    if (merchantResult._tag === "Err") return Err(merchantResult.error);
    const merchant = merchantResult.value;

    if (!isSome(merchant.stripeCustomerId)) {
      return Err(SubscriptionNotFoundError(userId));
    }

    return this.billing.createPortalSession(
      merchant.stripeCustomerId.value,
      this.config.portalReturnUrl
    );
  }

  async getMerchantStatus(
    userId: string
  ): Promise<Result<Merchant, MerchantNotFoundErrorType | BillingRepositoryErrorType>> {
    return this.merchantRepo.findByUserId(userId);
  }

  async getAnalytics(
    userId: string
  ): Promise<{ ok: true; value: MerchantAnalytics } | { ok: false; error: string; _tag: string }> {
    const result = await this.merchantRepo.findByUserId(userId);
    if (result._tag === "Err") {
      return { ok: false, error: result.error.message, _tag: result.error._tag };
    }
    const m = result.value as Merchant & {
      completedOrderCount?: number;
      totalRevenueCents?: number;
    };
    return {
      ok: true,
      value: {
        completedOrderCount: m.completedOrderCount ?? 0,
        totalRevenueCents: m.totalRevenueCents ?? 0,
        productCount: m.productCount,
        plan: m.plan,
        planStatus: m.planStatus,
      },
    };
  }

  async handleStripeWebhook(
    rawBody: string,
    signature: string
  ): Promise<Result<void, BillingError>> {
    if (!this.config.webhookSecret) {
      return Err(
        StripeCallError("webhook_secret_not_configured", "STRIPE_WEBHOOK_SECRET is not configured")
      );
    }

    let event: StripeWebhookEvent;

    try {
      event = this.stripeAdapter.constructWebhookEvent(
        rawBody,
        signature,
        this.config.webhookSecret
      ) as StripeWebhookEvent;
    } catch (cause) {
      return Err(
        StripeCallError(
          "webhook_signature_invalid",
          `Webhook signature verification failed: ${String(cause)}`
        )
      );
    }

    switch (event.type) {
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as StripeSubscriptionEvent;
        return this.syncSubscriptionFromEvent(sub);
      }
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as StripeInvoiceEvent;
        if (invoice.subscription) {
          return this.syncSubscriptionById(invoice.subscription);
        }
        return Ok(undefined);
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as StripeInvoiceEvent;
        if (invoice.subscription) {
          return this.syncSubscriptionById(invoice.subscription);
        }
        return Ok(undefined);
      }
      default:
        return Ok(undefined);
    }
  }

  private async syncSubscriptionFromEvent(
    sub: StripeSubscriptionEvent
  ): Promise<Result<void, BillingError>> {
    const userIdResult = await this.billing.getCustomerUserId(sub.customer);
    if (userIdResult._tag === "Err") return Err(userIdResult.error);

    const merchantResult = await this.merchantRepo.findByUserId(userIdResult.value);
    if (merchantResult._tag === "Err") return Err(merchantResult.error);
    const merchant = merchantResult.value;

    const planStatus = stripeStatusToPlanStatus(sub.status);
    const planId: PlanId =
      sub.status === "canceled" || sub.status === "unpaid" ? "free" : merchant.plan;

    return this.merchantRepo.updatePlan(
      merchant.userId,
      planId,
      planStatus,
      sub.id,
      new Date(sub.current_period_end * 1000).toISOString()
    );
  }

  private async syncSubscriptionById(subscriptionId: string): Promise<Result<void, BillingError>> {
    const subResult = await this.billing.retrieveSubscription(subscriptionId);
    if (subResult._tag === "Err") return Err(subResult.error);

    const sub = subResult.value;
    return this.syncSubscriptionFromEvent({
      id: sub.subscriptionId,
      customer: sub.customerId,
      status: sub.status,
      current_period_end: new Date(sub.currentPeriodEnd).getTime() / 1000,
    });
  }
}

function applySubscription(
  merchant: Merchant,
  planId: PlanId,
  sub: StripeSubscription,
  stripeCustomerId: string
): Merchant {
  return {
    ...merchant,
    plan: planId,
    planStatus: stripeStatusToPlanStatus(sub.status),
    stripeCustomerId: Some(stripeCustomerId),
    stripeSubscriptionId: Some(sub.subscriptionId),
    planExpiresAt: Some(sub.currentPeriodEnd),
  };
}

function stripeStatusToPlanStatus(status: string): PlanStatus {
  switch (status) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
    case "unpaid":
      return "past_due";
    default:
      return "cancelled";
  }
}
