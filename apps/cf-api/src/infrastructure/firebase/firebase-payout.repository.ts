import { Err, None, Ok, Some } from "@fabric/types";
import type { Result } from "@fabric/types";
import type { Database } from "firebase-admin/database";
import type {
  PayoutBalance,
  PayoutRepositoryPort,
  PayoutRequest,
  PayoutStatus,
} from "../../application/ports/payout.repository.port";
import {
  InsufficientBalanceError,
  PayoutNotFoundError,
  PayoutRepositoryError,
} from "../../application/ports/payout.repository.port";
import { firebaseQuery } from "../../shared/abort/abort-context";

const MIN_PAYOUT_CENTS = 10_000;

interface FirebasePayoutRecord {
  id: string;
  userId: string;
  requestedAt: string;
  amountCents: number;
  bankInfo: string;
  status: PayoutStatus;
  resolvedAt: string | null;
  adminNote: string | null;
}

function fromRecord(record: FirebasePayoutRecord): PayoutRequest {
  return {
    id: record.id,
    userId: record.userId,
    requestedAt: record.requestedAt,
    amountCents: record.amountCents,
    bankInfo: record.bankInfo,
    status: record.status,
    resolvedAt: record.resolvedAt !== null ? Some(record.resolvedAt) : None<string>(),
    adminNote: record.adminNote !== null ? Some(record.adminNote) : None<string>(),
  };
}

export class FirebasePayoutRepository implements PayoutRepositoryPort {
  constructor(
    private readonly db: Database,
    private readonly platformFeePct: number
  ) {}

  async getBalance(
    userId: string
  ): Promise<Result<PayoutBalance, ReturnType<typeof PayoutRepositoryError>>> {
    try {
      const [revenueSnap, paidSnap] = await Promise.all([
        firebaseQuery(this.db.ref(`merchants/${userId}/totalRevenueCents`).once("value")),
        firebaseQuery(this.db.ref(`merchants/${userId}/paidOutCents`).once("value")),
      ]);

      const totalRevenueCents = (revenueSnap.val() as number | null) ?? 0;
      const paidOutCents = (paidSnap.val() as number | null) ?? 0;
      const availableBalanceCents = Math.max(
        0,
        Math.floor(totalRevenueCents * (1 - this.platformFeePct)) - paidOutCents
      );

      return Ok({
        totalRevenueCents,
        paidOutCents,
        platformFeePct: this.platformFeePct,
        availableBalanceCents,
      });
    } catch (cause) {
      return Err(PayoutRepositoryError("Failed to get payout balance", Some(cause)));
    }
  }

  async requestPayout(
    userId: string,
    amountCents: number,
    bankInfo: string
  ): Promise<
    Result<
      PayoutRequest,
      ReturnType<typeof InsufficientBalanceError> | ReturnType<typeof PayoutRepositoryError>
    >
  > {
    try {
      if (amountCents < MIN_PAYOUT_CENTS) {
        return Err(InsufficientBalanceError(0, amountCents));
      }

      const balanceResult = await this.getBalance(userId);
      if (balanceResult._tag === "Err") return Err(balanceResult.error);
      const balance = balanceResult.value;

      if (amountCents > balance.availableBalanceCents) {
        return Err(InsufficientBalanceError(balance.availableBalanceCents, amountCents));
      }

      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const record: FirebasePayoutRecord = {
        id,
        userId,
        requestedAt: now,
        amountCents,
        bankInfo,
        status: "pending",
        resolvedAt: null,
        adminNote: null,
      };

      await this.db.ref().update({
        [`merchants/${userId}/payoutRequests/${id}`]: record,
        [`payoutRequests/${id}`]: record,
      });

      return Ok(fromRecord(record));
    } catch (cause) {
      return Err(PayoutRepositoryError("Failed to create payout request", Some(cause)));
    }
  }

  async listPayouts(
    userId: string
  ): Promise<Result<PayoutRequest[], ReturnType<typeof PayoutRepositoryError>>> {
    try {
      const snap = await firebaseQuery(
        this.db.ref(`merchants/${userId}/payoutRequests`).orderByChild("requestedAt").once("value")
      );

      const requests: PayoutRequest[] = [];
      snap.forEach((child) => {
        requests.push(fromRecord(child.val() as FirebasePayoutRecord));
      });

      return Ok(requests.reverse());
    } catch (cause) {
      return Err(PayoutRepositoryError("Failed to list payout requests", Some(cause)));
    }
  }

  async listAllPending(): Promise<
    Result<PayoutRequest[], ReturnType<typeof PayoutRepositoryError>>
  > {
    try {
      const snap = await firebaseQuery(
        this.db.ref("payoutRequests").orderByChild("status").equalTo("pending").once("value")
      );

      const requests: PayoutRequest[] = [];
      snap.forEach((child) => {
        requests.push(fromRecord(child.val() as FirebasePayoutRecord));
      });

      requests.sort((a, b) => a.requestedAt.localeCompare(b.requestedAt));

      return Ok(requests);
    } catch (cause) {
      return Err(PayoutRepositoryError("Failed to list pending payouts", Some(cause)));
    }
  }

  async approvePayout(
    requestId: string,
    ownerUserId: string
  ): Promise<
    Result<void, ReturnType<typeof PayoutNotFoundError> | ReturnType<typeof PayoutRepositoryError>>
  > {
    try {
      const snap = await firebaseQuery(
        this.db.ref(`merchants/${ownerUserId}/payoutRequests/${requestId}`).once("value")
      );
      if (!snap.exists()) return Err(PayoutNotFoundError(requestId));

      const record = snap.val() as FirebasePayoutRecord;
      const now = new Date().toISOString();

      await this.db.ref().update({
        [`merchants/${ownerUserId}/payoutRequests/${requestId}/status`]: "approved",
        [`merchants/${ownerUserId}/payoutRequests/${requestId}/resolvedAt`]: now,
        [`payoutRequests/${requestId}/status`]: "approved",
        [`payoutRequests/${requestId}/resolvedAt`]: now,
      });

      await this.db
        .ref(`merchants/${ownerUserId}/paidOutCents`)
        .transaction((current: number | null) => (current ?? 0) + record.amountCents);

      return Ok(undefined);
    } catch (cause) {
      return Err(PayoutRepositoryError("Failed to approve payout", Some(cause)));
    }
  }

  async rejectPayout(
    requestId: string,
    ownerUserId: string,
    reason: string
  ): Promise<
    Result<void, ReturnType<typeof PayoutNotFoundError> | ReturnType<typeof PayoutRepositoryError>>
  > {
    try {
      const snap = await firebaseQuery(
        this.db.ref(`merchants/${ownerUserId}/payoutRequests/${requestId}`).once("value")
      );
      if (!snap.exists()) return Err(PayoutNotFoundError(requestId));

      const now = new Date().toISOString();

      await this.db.ref().update({
        [`merchants/${ownerUserId}/payoutRequests/${requestId}/status`]: "rejected",
        [`merchants/${ownerUserId}/payoutRequests/${requestId}/resolvedAt`]: now,
        [`merchants/${ownerUserId}/payoutRequests/${requestId}/adminNote`]: reason,
        [`payoutRequests/${requestId}/status`]: "rejected",
        [`payoutRequests/${requestId}/resolvedAt`]: now,
        [`payoutRequests/${requestId}/adminNote`]: reason,
      });

      return Ok(undefined);
    } catch (cause) {
      return Err(PayoutRepositoryError("Failed to reject payout", Some(cause)));
    }
  }
}
