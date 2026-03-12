import type { FirebaseMerchantRecord } from "@fabric/firebase";
import { Err, None, Ok, Some, isSome } from "@fabric/types";
import type { Result } from "@fabric/types";
import type { Database } from "firebase-admin/database";
import type { MerchantRepositoryPort } from "../../application/ports/merchant.repository.port";
import { BillingRepositoryError, MerchantNotFoundError } from "../../domain/billing/billing.errors";
import type {
  BillingRepositoryError as BillingRepositoryErrorType,
  MerchantNotFoundError as MerchantNotFoundErrorType,
} from "../../domain/billing/billing.errors";
import type { Merchant, PlanId, PlanStatus } from "../../domain/billing/billing.value-objects";
import { firebaseQuery } from "../../shared/abort/abort-context";
import { randomSuffix, slugify } from "../../utils/slugify";

function fromRecord(record: FirebaseMerchantRecord): Merchant {
  return {
    userId: record.userId,
    storeName: record.storeName,
    email: record.email,
    plan: record.plan as PlanId,
    planStatus: record.planStatus as PlanStatus,
    stripeCustomerId:
      record.stripeCustomerId != null ? Some(record.stripeCustomerId) : None<string>(),
    stripeSubscriptionId:
      record.stripeSubscriptionId != null ? Some(record.stripeSubscriptionId) : None<string>(),
    productCount: record.productCount,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    planExpiresAt: record.planExpiresAt != null ? Some(record.planExpiresAt) : None<string>(),
    storeSlug: record.storeSlug != null ? Some(record.storeSlug) : None<string>(),
  };
}

function toRecord(merchant: Merchant): FirebaseMerchantRecord {
  return {
    userId: merchant.userId,
    storeName: merchant.storeName,
    email: merchant.email,
    plan: merchant.plan,
    planStatus: merchant.planStatus,
    stripeCustomerId: isSome(merchant.stripeCustomerId) ? merchant.stripeCustomerId.value : null,
    stripeSubscriptionId: isSome(merchant.stripeSubscriptionId)
      ? merchant.stripeSubscriptionId.value
      : null,
    productCount: merchant.productCount,
    createdAt: merchant.createdAt,
    updatedAt: merchant.updatedAt,
    planExpiresAt: isSome(merchant.planExpiresAt) ? merchant.planExpiresAt.value : null,
    storeSlug: isSome(merchant.storeSlug) ? merchant.storeSlug.value : null,
  };
}

export class FirebaseMerchantRepository implements MerchantRepositoryPort {
  constructor(private readonly db: Database) {}

  async findByUserId(
    userId: string
  ): Promise<Result<Merchant, MerchantNotFoundErrorType | BillingRepositoryErrorType>> {
    try {
      const snap = await firebaseQuery(this.db.ref(`merchants/${userId}`).once("value"));
      if (!snap.exists()) return Err(MerchantNotFoundError(userId));
      return Ok(fromRecord(snap.val() as FirebaseMerchantRecord));
    } catch (cause) {
      return Err(BillingRepositoryError("Failed to find merchant", Some(cause)));
    }
  }

  async save(merchant: Merchant): Promise<Result<Merchant, BillingRepositoryErrorType>> {
    try {
      const now = new Date().toISOString();
      const updated: Merchant = { ...merchant, updatedAt: now };
      await this.db.ref(`merchants/${merchant.userId}`).set(toRecord(updated));
      return Ok(updated);
    } catch (cause) {
      return Err(BillingRepositoryError("Failed to save merchant", Some(cause)));
    }
  }

  async create(
    merchant: Omit<Merchant, "createdAt" | "updatedAt">
  ): Promise<Result<Merchant, BillingRepositoryErrorType>> {
    try {
      const now = new Date().toISOString();

      let slug = slugify(merchant.storeName);
      if (!slug) slug = `store-${merchant.userId.slice(0, 8)}`;

      const existing = await firebaseQuery(this.db.ref(`merchantsBySlug/${slug}`).once("value"));
      if (existing.exists()) {
        slug = `${slug}-${randomSuffix()}`;
      }

      const full: Merchant = {
        ...merchant,
        storeSlug: Some(slug),
        createdAt: now,
        updatedAt: now,
      };

      await this.db.ref().update({
        [`merchants/${merchant.userId}`]: toRecord(full),
        [`merchantsBySlug/${slug}`]: merchant.userId,
      });

      return Ok(full);
    } catch (cause) {
      return Err(BillingRepositoryError("Failed to create merchant", Some(cause)));
    }
  }

  async incrementProductCount(
    userId: string
  ): Promise<Result<number, MerchantNotFoundErrorType | BillingRepositoryErrorType>> {
    try {
      let newCount = 0;
      let merchantExists = true;

      await this.db
        .ref(`merchants/${userId}/productCount`)
        .transaction((current: number | null) => {
          if (current === null) {
            merchantExists = false;
            return;
          }
          newCount = (current ?? 0) + 1;
          return newCount;
        });

      if (!merchantExists) return Err(MerchantNotFoundError(userId));

      await this.db.ref(`merchants/${userId}/updatedAt`).set(new Date().toISOString());

      return Ok(newCount);
    } catch (cause) {
      return Err(BillingRepositoryError("Failed to increment product count", Some(cause)));
    }
  }

  async decrementProductCount(
    userId: string
  ): Promise<Result<number, MerchantNotFoundErrorType | BillingRepositoryErrorType>> {
    try {
      let newCount = 0;
      let merchantExists = true;

      await this.db
        .ref(`merchants/${userId}/productCount`)
        .transaction((current: number | null) => {
          if (current === null) {
            merchantExists = false;
            return;
          }
          newCount = Math.max(0, (current ?? 0) - 1);
          return newCount;
        });

      if (!merchantExists) return Err(MerchantNotFoundError(userId));

      await this.db.ref(`merchants/${userId}/updatedAt`).set(new Date().toISOString());

      return Ok(newCount);
    } catch (cause) {
      return Err(BillingRepositoryError("Failed to decrement product count", Some(cause)));
    }
  }

  async updatePlan(
    userId: string,
    plan: PlanId,
    planStatus: PlanStatus,
    stripeSubscriptionId: string | null,
    planExpiresAt: string | null
  ): Promise<Result<void, MerchantNotFoundErrorType | BillingRepositoryErrorType>> {
    try {
      const snap = await firebaseQuery(this.db.ref(`merchants/${userId}`).once("value"));
      if (!snap.exists()) return Err(MerchantNotFoundError(userId));

      await this.db.ref(`merchants/${userId}`).update({
        plan,
        planStatus,
        stripeSubscriptionId,
        planExpiresAt,
        updatedAt: new Date().toISOString(),
      });

      return Ok(undefined);
    } catch (cause) {
      return Err(BillingRepositoryError("Failed to update plan", Some(cause)));
    }
  }

  async recordCompletedOrder(
    userId: string,
    amountCents: number
  ): Promise<Result<void, BillingRepositoryErrorType>> {
    try {
      await this.db
        .ref(`merchants/${userId}/completedOrderCount`)
        .transaction((current: number | null) => (current ?? 0) + 1);

      await this.db
        .ref(`merchants/${userId}/totalRevenueCents`)
        .transaction((current: number | null) => (current ?? 0) + amountCents);

      return Ok(undefined);
    } catch (cause) {
      return Err(BillingRepositoryError("Failed to record completed order", Some(cause)));
    }
  }

  async findBySlug(
    slug: string
  ): Promise<Result<Merchant, MerchantNotFoundErrorType | BillingRepositoryErrorType>> {
    try {
      const indexSnap = await firebaseQuery(this.db.ref(`merchantsBySlug/${slug}`).once("value"));
      if (!indexSnap.exists()) {
        return Err(MerchantNotFoundError(`slug:${slug}`));
      }
      const userId = indexSnap.val() as string;

      const snap = await firebaseQuery(this.db.ref(`merchants/${userId}`).once("value"));
      if (!snap.exists()) return Err(MerchantNotFoundError(userId));
      return Ok(fromRecord(snap.val() as FirebaseMerchantRecord));
    } catch (cause) {
      return Err(BillingRepositoryError("Failed to find merchant by slug", Some(cause)));
    }
  }
}
