import type { Result } from "@fabric/types";
import type {
  BillingRepositoryError,
  MerchantNotFoundError,
} from "../../domain/billing/billing.errors";
import type { Merchant, PlanId, PlanStatus } from "../../domain/billing/billing.value-objects";

export interface MerchantRepositoryPort {
  findByUserId(
    userId: string
  ): Promise<Result<Merchant, MerchantNotFoundError | BillingRepositoryError>>;

  save(merchant: Merchant): Promise<Result<Merchant, BillingRepositoryError>>;

  create(
    merchant: Omit<Merchant, "createdAt" | "updatedAt">
  ): Promise<Result<Merchant, BillingRepositoryError>>;

  incrementProductCount(
    userId: string
  ): Promise<Result<number, MerchantNotFoundError | BillingRepositoryError>>;

  decrementProductCount(
    userId: string
  ): Promise<Result<number, MerchantNotFoundError | BillingRepositoryError>>;

  updatePlan(
    userId: string,
    plan: PlanId,
    planStatus: PlanStatus,
    stripeSubscriptionId: string | null,
    planExpiresAt: string | null
  ): Promise<Result<void, MerchantNotFoundError | BillingRepositoryError>>;

  recordCompletedOrder(
    userId: string,
    amountCents: number
  ): Promise<Result<void, BillingRepositoryError>>;

  findBySlug(
    slug: string
  ): Promise<Result<Merchant, MerchantNotFoundError | BillingRepositoryError>>;

  findAll(): Promise<Result<Merchant[], BillingRepositoryError>>;

  findAllForAdmin(): Promise<Result<AdminMerchantSummary[], BillingRepositoryError>>;
}

export interface AdminMerchantSummary {
  userId: string;
  storeName: string;
  storeSlug: string | null;
  plan: string;
  planStatus: string;
  productCount: number;
  totalRevenueCents: number;
  completedOrderCount: number;
  paidOutCents: number;
  createdAt: string;
}
