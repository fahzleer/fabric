import type { Result } from "@fabric/types";

export const VOUCHER_REPOSITORY = Symbol("VOUCHER_REPOSITORY");

export type VoucherForRoc = {
  code: string;
  discountTag: "PercentOff" | "FixedOff" | "FreeShipping" | "BuyXGetY";
  discountPct: number;
  discountAmount: number;
  discountBuy: number;
  discountGet: number;
  minOrderCents: number;
  maxUsages: number;
  currentUsages: number;
  validUntilEpoch: number;
  currentEpoch: number;
};

export type VoucherNotFoundError = { _tag: "VoucherNotFoundError"; code: string };
export type VoucherLimitReachedError = {
  _tag: "VoucherLimitReachedError";
  code: string;
  maxUsages: number;
};

export interface VoucherRepositoryPort {
  findByCode(code: string): Promise<Result<VoucherForRoc, VoucherNotFoundError>>;

  atomicCheckAndUseVoucher(
    code: string,
    tx: unknown
  ): Promise<Result<VoucherForRoc, VoucherNotFoundError | VoucherLimitReachedError>>;
}
