import { describe, expect, mock, test } from "bun:test";
import { Err, None, Ok, Some } from "@fabric/types";
import type { BillingPort, StripeSubscription } from "../../application/ports/billing.port";
import type { MerchantRepositoryPort } from "../../application/ports/merchant.repository.port";
import {
  BillingRepositoryError,
  MerchantNotFoundError,
  StripeCallError,
} from "../../domain/billing/billing.errors";
import type { StripeCallError as StripeCallErrorType } from "../../domain/billing/billing.errors";
import type { Merchant } from "../../domain/billing/billing.value-objects";
import type { StripeBillingAdapter } from "../../infrastructure/billing/stripe-billing.adapter";
import { BillingService } from "./billing.service";
import type { BillingConfig } from "./billing.service";

const BASE_CONFIG: BillingConfig = {
  stripePriceIds: {
    starter: "price_starter_test",
    professional: "price_professional_test",
  },
  portalReturnUrl: "https://example.com/merchant/billing",
  webhookSecret: "whsec_test_secret",
};

const MERCHANT_FREE: Merchant = {
  userId: "user-001",
  storeName: "Test Store",
  email: "test@store.com",
  plan: "free",
  planStatus: "active",
  stripeCustomerId: None<string>(),
  stripeSubscriptionId: None<string>(),
  productCount: 0,
  completedOrderCount: 0,
  totalRevenueCents: 0,
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2025-01-01T00:00:00Z",
  planExpiresAt: None<string>(),
  storeSlug: None<string>(),
};

const MERCHANT_STARTER: Merchant = {
  ...MERCHANT_FREE,
  plan: "starter",
  planStatus: "active",
  stripeCustomerId: Some("cus_test123"),
  stripeSubscriptionId: Some("sub_test123"),
};

const MOCK_STRIPE_SUB: StripeSubscription = {
  subscriptionId: "sub_new_test",
  customerId: "cus_test123",
  status: "active",
  currentPeriodEnd: "2026-01-01T00:00:00Z",
  priceId: "price_starter_test",
};

function makeBillingPort(overrides: Partial<BillingPort> = {}): BillingPort {
  return {
    createCustomer: mock(async () => Ok("cus_test123")),
    retrieveSubscription: mock(async () => Ok(MOCK_STRIPE_SUB)),
    getCustomerUserId: mock(async () => Ok(MERCHANT_FREE.userId)),
    createSubscription: mock(async () => Ok(MOCK_STRIPE_SUB)),
    changeSubscriptionPlan: mock(async () => Ok(MOCK_STRIPE_SUB)),
    cancelSubscription: mock(async () => Ok(undefined)),
    createPortalSession: mock(async () => Ok("https://billing.stripe.com/session/test")),
    ...overrides,
  };
}

function makeMerchantRepo(overrides: Partial<MerchantRepositoryPort> = {}): MerchantRepositoryPort {
  return {
    findByUserId: mock(async () => Ok(MERCHANT_FREE)),
    save: mock(async (m: Merchant) => Ok(m)),
    create: mock(async () =>
      Ok({
        ...MERCHANT_FREE,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    ),
    incrementProductCount: mock(async () => Ok(1)),
    decrementProductCount: mock(async () => Ok(0)),
    updatePlan: mock(async () => Ok(undefined)),
    recordCompletedOrder: mock(async () => Ok(undefined)),
    findBySlug: mock(async () => Err(MerchantNotFoundError("unknown"))),
    findAll: mock(async () => Ok([])),
    findAllForAdmin: mock(async () => Ok([])),
    ...overrides,
  };
}

type StripeAdapterMock = { constructWebhookEvent: ReturnType<typeof mock> };

function makeStripeAdapter(overrides: Partial<StripeAdapterMock> = {}): StripeBillingAdapter {
  return {
    constructWebhookEvent: mock((_body: string, _sig: string, _secret: string) => ({
      type: "unknown.event",
      data: { object: {} },
    })),
    ...overrides,
  } as unknown as StripeBillingAdapter;
}

function makeService(
  billingOverrides: Partial<BillingPort> = {},
  repoOverrides: Partial<MerchantRepositoryPort> = {},
  adapterOverrides: Partial<StripeAdapterMock> = {},
  configOverrides: Partial<BillingConfig> = {}
): BillingService {
  return new BillingService(
    makeBillingPort(billingOverrides),
    makeStripeAdapter(adapterOverrides),
    makeMerchantRepo(repoOverrides),
    { ...BASE_CONFIG, ...configOverrides }
  );
}

describe("BillingService.onboardMerchant", () => {
  test("returns existing merchant when already onboarded (idempotent)", async () => {
    const service = makeService({}, { findByUserId: mock(async () => Ok(MERCHANT_STARTER)) });

    const result = await service.onboardMerchant("user-001", "Test Store", "test@store.com");

    expect(result._tag).toBe("Ok");
    if (result._tag === "Ok") {
      expect(result.value.plan).toBe("starter");
    }
  });

  test("creates free-plan merchant when not found", async () => {
    const mockCreate = mock(async () =>
      Ok({
        ...MERCHANT_FREE,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    );

    const service = makeService(
      {},
      {
        findByUserId: mock(async () => Err(MerchantNotFoundError("user-001"))),
        create: mockCreate,
      }
    );

    const result = await service.onboardMerchant("user-001", "Test Store", "test@store.com");

    expect(result._tag).toBe("Ok");
    expect(mockCreate).toHaveBeenCalledTimes(1);

    const callArg = ((mockCreate.mock.calls.at(0) ?? []) as unknown as [typeof MERCHANT_FREE])[0];
    expect(callArg.plan).toBe("free");
    expect(callArg.planStatus).toBe("active");
    expect(callArg.stripeCustomerId._tag).toBe("None");
    expect(callArg.stripeSubscriptionId._tag).toBe("None");
  });

  test("propagates BillingRepositoryError from findByUserId (not MerchantNotFoundError)", async () => {
    const service = makeService(
      {},
      {
        findByUserId: mock(async () => Err(BillingRepositoryError("DB connection lost"))),
      }
    );

    const result = await service.onboardMerchant("user-001", "Store", "e@test.com");

    expect(result._tag).toBe("Err");
    if (result._tag === "Err") {
      expect(result.error._tag).toBe("BillingRepositoryError");
    }
  });
});

describe("BillingService.subscribeToPlan", () => {
  test("no Stripe price ID configured for plan → Err(StripeCallError)", async () => {
    const service = makeService({}, {}, {}, { stripePriceIds: {} });

    const result = await service.subscribeToPlan("user-001", "starter");

    expect(result._tag).toBe("Err");
    if (result._tag === "Err") {
      expect(result.error._tag).toBe("StripeCallError");
      expect((result.error as StripeCallErrorType).code).toBe("no_price_id");
    }
  });

  test("merchant not found → Err(MerchantNotFoundError)", async () => {
    const service = makeService(
      {},
      {
        findByUserId: mock(async () => Err(MerchantNotFoundError("user-001"))),
      }
    );

    const result = await service.subscribeToPlan("user-001", "starter");

    expect(result._tag).toBe("Err");
    if (result._tag === "Err") {
      expect(result.error._tag).toBe("MerchantNotFoundError");
    }
  });

  test("already on same active plan → Err(AlreadySubscribedError)", async () => {
    const service = makeService(
      {},
      {
        findByUserId: mock(async () => Ok(MERCHANT_STARTER)),
      }
    );

    const result = await service.subscribeToPlan("user-001", "starter");

    expect(result._tag).toBe("Err");
    if (result._tag === "Err") {
      expect(result.error._tag).toBe("AlreadySubscribedError");
    }
  });

  test("free merchant (no Stripe customer): creates customer + new subscription", async () => {
    const mockCreateCustomer = mock(async () => Ok("cus_new123"));
    const mockCreateSubscription = mock(async () => Ok(MOCK_STRIPE_SUB));
    const mockSave = mock(async (m: Merchant) => Ok(m));

    const service = makeService(
      { createCustomer: mockCreateCustomer, createSubscription: mockCreateSubscription },
      { findByUserId: mock(async () => Ok(MERCHANT_FREE)), save: mockSave }
    );

    const result = await service.subscribeToPlan("user-001", "starter");

    expect(result._tag).toBe("Ok");
    expect(mockCreateCustomer).toHaveBeenCalledTimes(1);
    expect(mockCreateSubscription).toHaveBeenCalledWith("cus_new123", "price_starter_test");
    expect(mockSave).toHaveBeenCalledTimes(1);
  });

  test("merchant with existing subscription: changes plan (upgrade path)", async () => {
    const mockChangePlan = mock(async () => Ok(MOCK_STRIPE_SUB));
    const mockSave = mock(async (m: Merchant) => Ok(m));

    const service = makeService(
      { changeSubscriptionPlan: mockChangePlan },
      {
        findByUserId: mock(async () => Ok(MERCHANT_STARTER)),
        save: mockSave,
      }
    );

    const result = await service.subscribeToPlan("user-001", "professional");

    expect(result._tag).toBe("Ok");
    expect(mockChangePlan).toHaveBeenCalledTimes(1);
    expect(mockChangePlan).toHaveBeenCalledWith("sub_test123", "price_professional_test");
    expect(mockSave).toHaveBeenCalledTimes(1);
  });

  test("createCustomer fails → Err(StripeCallError), no subscription created", async () => {
    const mockCreateSubscription = mock(async () => Ok(MOCK_STRIPE_SUB));

    const service = makeService(
      {
        createCustomer: mock(async () =>
          Err(StripeCallError("card_declined", "Card was declined"))
        ),
        createSubscription: mockCreateSubscription,
      },
      { findByUserId: mock(async () => Ok(MERCHANT_FREE)) }
    );

    const result = await service.subscribeToPlan("user-001", "starter");

    expect(result._tag).toBe("Err");
    if (result._tag === "Err") {
      expect(result.error._tag).toBe("StripeCallError");
    }
    expect(mockCreateSubscription).not.toHaveBeenCalled();
  });

  test("already trialing same plan → Err(AlreadySubscribedError)", async () => {
    const merchantTrialing: Merchant = { ...MERCHANT_STARTER, planStatus: "trialing" };

    const service = makeService(
      {},
      {
        findByUserId: mock(async () => Ok(merchantTrialing)),
      }
    );

    const result = await service.subscribeToPlan("user-001", "starter");

    expect(result._tag).toBe("Err");
    if (result._tag === "Err") {
      expect(result.error._tag).toBe("AlreadySubscribedError");
    }
  });
});

describe("BillingService.cancelSubscription", () => {
  test("no stripeSubscriptionId → Err(SubscriptionNotFoundError)", async () => {
    const service = makeService(
      {},
      {
        findByUserId: mock(async () => Ok(MERCHANT_FREE)),
      }
    );

    const result = await service.cancelSubscription("user-001");

    expect(result._tag).toBe("Err");
    if (result._tag === "Err") {
      expect(result.error._tag).toBe("SubscriptionNotFoundError");
    }
  });

  test("success → Ok(void), billing.cancelSubscription called with subscriptionId", async () => {
    const mockCancel = mock(async () => Ok(undefined));

    const service = makeService(
      { cancelSubscription: mockCancel },
      { findByUserId: mock(async () => Ok(MERCHANT_STARTER)) }
    );

    const result = await service.cancelSubscription("user-001");

    expect(result._tag).toBe("Ok");
    expect(mockCancel).toHaveBeenCalledTimes(1);
    expect(mockCancel).toHaveBeenCalledWith("sub_test123");
  });

  test("merchant not found → Err propagated from repo", async () => {
    const service = makeService(
      {},
      {
        findByUserId: mock(async () => Err(MerchantNotFoundError("user-001"))),
      }
    );

    const result = await service.cancelSubscription("user-001");

    expect(result._tag).toBe("Err");
    if (result._tag === "Err") {
      expect(result.error._tag).toBe("MerchantNotFoundError");
    }
  });
});

describe("BillingService.getPortalUrl", () => {
  test("no stripeCustomerId → Err(SubscriptionNotFoundError)", async () => {
    const service = makeService(
      {},
      {
        findByUserId: mock(async () => Ok(MERCHANT_FREE)),
      }
    );

    const result = await service.getPortalUrl("user-001");

    expect(result._tag).toBe("Err");
    if (result._tag === "Err") {
      expect(result.error._tag).toBe("SubscriptionNotFoundError");
    }
  });

  test("success → Ok(portalUrl), createPortalSession called with customerId + returnUrl", async () => {
    const PORTAL_URL = "https://billing.stripe.com/session/abc123";
    const mockPortal = mock(async () => Ok(PORTAL_URL));

    const service = makeService(
      { createPortalSession: mockPortal },
      { findByUserId: mock(async () => Ok(MERCHANT_STARTER)) }
    );

    const result = await service.getPortalUrl("user-001");

    expect(result._tag).toBe("Ok");
    if (result._tag === "Ok") {
      expect(result.value).toBe(PORTAL_URL);
    }
    expect(mockPortal).toHaveBeenCalledWith("cus_test123", BASE_CONFIG.portalReturnUrl);
  });
});

describe("BillingService.getMerchantStatus", () => {
  test("delegates to repo.findByUserId → Ok(merchant)", async () => {
    const service = makeService(
      {},
      {
        findByUserId: mock(async () => Ok(MERCHANT_STARTER)),
      }
    );

    const result = await service.getMerchantStatus("user-001");

    expect(result._tag).toBe("Ok");
    if (result._tag === "Ok") {
      expect(result.value.userId).toBe("user-001");
      expect(result.value.plan).toBe("starter");
    }
  });

  test("delegates to repo.findByUserId → Err(MerchantNotFoundError)", async () => {
    const service = makeService(
      {},
      {
        findByUserId: mock(async () => Err(MerchantNotFoundError("user-001"))),
      }
    );

    const result = await service.getMerchantStatus("user-001");

    expect(result._tag).toBe("Err");
    if (result._tag === "Err") {
      expect(result.error._tag).toBe("MerchantNotFoundError");
    }
  });
});

describe("BillingService.handleStripeWebhook", () => {
  test("invalid webhook signature → Err(StripeCallError) with code webhook_signature_invalid", async () => {
    const service = makeService(
      {},
      {},
      {
        constructWebhookEvent: mock(() => {
          throw new Error("No signatures found");
        }),
      }
    );

    const result = await service.handleStripeWebhook("raw-body", "bad-sig");

    expect(result._tag).toBe("Err");
    if (result._tag === "Err") {
      expect(result.error._tag).toBe("StripeCallError");
      expect((result.error as StripeCallErrorType).code).toBe("webhook_signature_invalid");
    }
  });

  test("unknown event type → Ok(undefined) — silently ignored", async () => {
    const service = makeService(
      {},
      {},
      {
        constructWebhookEvent: mock(() => ({
          type: "payment_intent.created",
          data: { object: {} },
        })),
      }
    );

    const result = await service.handleStripeWebhook("raw-body", "valid-sig");

    expect(result._tag).toBe("Ok");
  });

  test("customer.subscription.updated → syncs plan via getCustomerUserId + updatePlan", async () => {
    const mockUpdatePlan = mock(async () => Ok(undefined));
    const subEvent = {
      id: "sub_test123",
      customer: "cus_test123",
      status: "active",
      current_period_end: Math.floor(Date.now() / 1000) + 3600,
    };

    const service = makeService(
      { getCustomerUserId: mock(async () => Ok("user-001")) },
      {
        findByUserId: mock(async () => Ok(MERCHANT_STARTER)),
        updatePlan: mockUpdatePlan,
      },
      {
        constructWebhookEvent: mock(() => ({
          type: "customer.subscription.updated",
          data: { object: subEvent },
        })),
      }
    );

    const result = await service.handleStripeWebhook("raw-body", "valid-sig");

    expect(result._tag).toBe("Ok");
    expect(mockUpdatePlan).toHaveBeenCalledTimes(1);

    const [, planId, planStatus] = (mockUpdatePlan.mock.calls.at(0) ?? []) as unknown as [
      string,
      string,
      string,
    ];
    expect(planStatus).toBe("active");
    expect(planId).toBe("starter");
  });

  test('customer.subscription.deleted (canceled) → plan resets to "free"', async () => {
    const mockUpdatePlan = mock(async () => Ok(undefined));
    const subEvent = {
      id: "sub_test123",
      customer: "cus_test123",
      status: "canceled",
      current_period_end: Math.floor(Date.now() / 1000),
    };

    const service = makeService(
      { getCustomerUserId: mock(async () => Ok("user-001")) },
      {
        findByUserId: mock(async () => Ok(MERCHANT_STARTER)),
        updatePlan: mockUpdatePlan,
      },
      {
        constructWebhookEvent: mock(() => ({
          type: "customer.subscription.deleted",
          data: { object: subEvent },
        })),
      }
    );

    const result = await service.handleStripeWebhook("raw-body", "valid-sig");

    expect(result._tag).toBe("Ok");
    const [, planId, planStatus] = (mockUpdatePlan.mock.calls.at(0) ?? []) as unknown as [
      string,
      string,
      string,
    ];
    expect(planId).toBe("free");
    expect(planStatus).toBe("cancelled");
  });

  test("invoice.payment_succeeded with subscription → calls retrieveSubscription + updatePlan", async () => {
    const mockUpdatePlan = mock(async () => Ok(undefined));
    const mockRetrieveSub = mock(async () =>
      Ok({
        ...MOCK_STRIPE_SUB,
        subscriptionId: "sub_test123",
        customerId: "cus_test123",
        status: "active" as const,
      })
    );

    const service = makeService(
      {
        getCustomerUserId: mock(async () => Ok("user-001")),
        retrieveSubscription: mockRetrieveSub,
      },
      {
        findByUserId: mock(async () => Ok(MERCHANT_STARTER)),
        updatePlan: mockUpdatePlan,
      },
      {
        constructWebhookEvent: mock(() => ({
          type: "invoice.payment_succeeded",
          data: { object: { subscription: "sub_test123" } },
        })),
      }
    );

    const result = await service.handleStripeWebhook("raw-body", "valid-sig");

    expect(result._tag).toBe("Ok");
    expect(mockRetrieveSub).toHaveBeenCalledWith("sub_test123");
    expect(mockUpdatePlan).toHaveBeenCalledTimes(1);
  });

  test("invoice.payment_failed with subscription → past_due status propagated", async () => {
    const mockUpdatePlan = mock(async () => Ok(undefined));
    const mockRetrieveSub = mock(async () =>
      Ok({
        ...MOCK_STRIPE_SUB,
        status: "past_due" as const,
      })
    );

    const service = makeService(
      {
        getCustomerUserId: mock(async () => Ok("user-001")),
        retrieveSubscription: mockRetrieveSub,
      },
      {
        findByUserId: mock(async () => Ok(MERCHANT_STARTER)),
        updatePlan: mockUpdatePlan,
      },
      {
        constructWebhookEvent: mock(() => ({
          type: "invoice.payment_failed",
          data: { object: { subscription: "sub_test123" } },
        })),
      }
    );

    const result = await service.handleStripeWebhook("raw-body", "valid-sig");

    expect(result._tag).toBe("Ok");
    const [, , planStatus] = (mockUpdatePlan.mock.calls.at(0) ?? []) as unknown as [
      string,
      string,
      string,
    ];
    expect(planStatus).toBe("past_due");
  });

  test("invoice.payment_succeeded without subscription field → Ok, no sync", async () => {
    const mockRetrieveSub = mock(async () => Ok(MOCK_STRIPE_SUB));

    const service = makeService(
      { retrieveSubscription: mockRetrieveSub },
      {},
      {
        constructWebhookEvent: mock(() => ({
          type: "invoice.payment_succeeded",
          data: { object: { subscription: null } },
        })),
      }
    );

    const result = await service.handleStripeWebhook("raw-body", "valid-sig");

    expect(result._tag).toBe("Ok");
    expect(mockRetrieveSub).not.toHaveBeenCalled();
  });

  test("getCustomerUserId fails on subscription event → Err propagated", async () => {
    const subEvent = {
      id: "sub_test123",
      customer: "cus_test123",
      status: "active",
      current_period_end: Math.floor(Date.now() / 1000) + 3600,
    };

    const service = makeService(
      {
        getCustomerUserId: mock(async () =>
          Err(StripeCallError("customer_not_found", "Customer metadata missing"))
        ),
      },
      {},
      {
        constructWebhookEvent: mock(() => ({
          type: "customer.subscription.updated",
          data: { object: subEvent },
        })),
      }
    );

    const result = await service.handleStripeWebhook("raw-body", "valid-sig");

    expect(result._tag).toBe("Err");
    if (result._tag === "Err") {
      expect(result.error._tag).toBe("StripeCallError");
    }
  });
});
