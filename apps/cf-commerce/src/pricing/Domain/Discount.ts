export type VoucherType =
  | { readonly _tag: "PercentOff"; readonly pct: number }
  | { readonly _tag: "FixedOff"; readonly amount: number }
  | { readonly _tag: "FreeShipping" }
  | { readonly _tag: "BuyXGetY"; readonly buy: number; readonly get: number };

export interface Voucher {
  readonly code: string;
  readonly discountType: VoucherType;
  readonly minOrderCents: number;
  readonly maxUsages: number;
  readonly currentUsages: number;
  readonly validUntilEpoch: number;
  readonly currentEpoch: number;
}

export const computeDiscount =
  (voucher: Voucher) =>
  (subtotalCents: number): number => {
    switch (voucher.discountType._tag) {
      case "PercentOff":
        return Math.floor((subtotalCents * voucher.discountType.pct) / 100);

      case "FixedOff":
        return Math.min(voucher.discountType.amount, subtotalCents);

      case "FreeShipping":
        return 0;

      case "BuyXGetY": {
        const { buy, get } = voucher.discountType;
        const sets = Math.floor(subtotalCents / (buy + get));
        const itemPrice = Math.floor(subtotalCents / buy);
        return sets * get * itemPrice;
      }
    }
  };
