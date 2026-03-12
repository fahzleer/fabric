import type { FirebaseVoucherRecord } from "@fabric/firebase";
import type { Result } from "@fabric/types";
import type { Database } from "firebase-admin/database";
import { makeRepositoryError } from "../../application/ports/product.repository.port";
import type {
  VoucherForRoc,
  VoucherLimitReachedError,
  VoucherNotFoundError,
  VoucherRepositoryPort,
} from "../../application/ports/voucher.repository.port";

function toVoucherForRoc(record: FirebaseVoucherRecord): VoucherForRoc {
  return {
    code: record.code,
    discountTag: record.discountTag,
    discountPct: record.discountPct,
    discountAmount: record.discountAmount,
    discountBuy: record.discountBuy,
    discountGet: record.discountGet,
    minOrderCents: record.minOrderCents,
    maxUsages: record.maxUsages,
    currentUsages: record.currentUsages,
    validUntilEpoch: record.validUntilEpoch,
    currentEpoch: Math.floor(Date.now() / 1000),
  };
}

export class FirebaseVoucherRepository implements VoucherRepositoryPort {
  constructor(private readonly db: Database) {}

  async findByCode(code: string): Promise<Result<VoucherForRoc, VoucherNotFoundError>> {
    const snap = await this.db.ref(`vouchers/${code}`).once("value");
    if (!snap.exists()) {
      return { _tag: "Err", error: { _tag: "VoucherNotFoundError", code } };
    }
    return { _tag: "Ok", value: toVoucherForRoc(snap.val() as FirebaseVoucherRecord) };
  }

  async atomicCheckAndUseVoucher(
    code: string,
    _tx: unknown
  ): Promise<Result<VoucherForRoc, VoucherNotFoundError | VoucherLimitReachedError>> {
    let domainError: VoucherNotFoundError | VoucherLimitReachedError | null = null;
    let result: VoucherForRoc | null = null;

    await this.db.ref(`vouchers/${code}`).transaction((current: FirebaseVoucherRecord | null) => {
      if (current === null) {
        domainError = { _tag: "VoucherNotFoundError", code };
        return;
      }
      if (!current.isActive) {
        domainError = { _tag: "VoucherNotFoundError", code };
        return;
      }
      if (current.currentUsages >= current.maxUsages) {
        domainError = { _tag: "VoucherLimitReachedError", code, maxUsages: current.maxUsages };
        return;
      }
      const updated = { ...current, currentUsages: current.currentUsages + 1 };
      result = toVoucherForRoc(updated);
      return updated;
    });

    if (domainError !== null) {
      return { _tag: "Err", error: domainError };
    }
    if (result === null) {
      return {
        _tag: "Err",
        error: makeRepositoryError(
          `Failed to use voucher ${code}`,
          null
        ) as unknown as VoucherNotFoundError,
      };
    }
    return { _tag: "Ok", value: result };
  }
}
