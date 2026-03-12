import type { Result } from "@fabric/types";
import { Err } from "@fabric/types";
import type {
  PayoutBalance,
  PayoutError,
  PayoutRepositoryPort,
  PayoutRequest,
} from "../../application/ports/payout.repository.port";
import {
  InsufficientBalanceError,
  PayoutRepositoryError,
} from "../../application/ports/payout.repository.port";

export class PayoutService {
  constructor(private readonly payoutRepo: PayoutRepositoryPort) {}

  async getBalance(userId: string): Promise<Result<PayoutBalance, PayoutError>> {
    return this.payoutRepo.getBalance(userId);
  }

  async requestPayout(
    userId: string,
    amountCents: number,
    bankInfo: string
  ): Promise<Result<PayoutRequest, PayoutError>> {
    const MIN_PAYOUT_CENTS = 10_000;

    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      return Err(PayoutRepositoryError("Amount must be a positive integer (cents)"));
    }

    if (amountCents < MIN_PAYOUT_CENTS) {
      return Err(InsufficientBalanceError(0, amountCents));
    }

    if (!bankInfo.trim()) {
      return Err(PayoutRepositoryError("Bank account information is required"));
    }

    return this.payoutRepo.requestPayout(userId, amountCents, bankInfo.trim());
  }

  async listPayouts(userId: string): Promise<Result<PayoutRequest[], PayoutError>> {
    return this.payoutRepo.listPayouts(userId);
  }

  async listAllPending(): Promise<Result<PayoutRequest[], PayoutError>> {
    return this.payoutRepo.listAllPending();
  }

  async approvePayout(requestId: string, ownerUserId: string): Promise<Result<void, PayoutError>> {
    return this.payoutRepo.approvePayout(requestId, ownerUserId);
  }

  async rejectPayout(
    requestId: string,
    ownerUserId: string,
    reason: string
  ): Promise<Result<void, PayoutError>> {
    if (!reason.trim()) {
      return Err(PayoutRepositoryError("Rejection reason is required"));
    }
    return this.payoutRepo.rejectPayout(requestId, ownerUserId, reason.trim());
  }
}
