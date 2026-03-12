import { makeDomainEvent } from "./events";
import type { DomainEvent } from "./events";

export type LotId = { readonly __brand: "LotId"; readonly value: string };
export type LotIdError = { readonly _tag: "LotIdError"; readonly message: string };
export const makeLotId = (raw: string): LotId | LotIdError =>
  raw.trim().length > 0
    ? { __brand: "LotId", value: raw.trim() }
    : { _tag: "LotIdError", message: "LotId cannot be empty" };

export type AuditId = { readonly __brand: "AuditId"; readonly value: string };
export type AuditIdError = { readonly _tag: "AuditIdError"; readonly message: string };
export const makeAuditId = (raw: string): AuditId | AuditIdError =>
  raw.trim().length > 0
    ? { __brand: "AuditId", value: raw.trim() }
    : { _tag: "AuditIdError", message: "AuditId cannot be empty" };

export type AuditType = "spot_10pct" | "full_50pct" | "full_100pct";

export interface PriceChangedError {
  readonly _tag: "PriceChangedError";
  readonly message: string;
}
export const makePriceChangedError = (
  productName: string,
  cartCents: number,
  currentCents: number
): PriceChangedError => ({
  _tag: "PriceChangedError",
  message: `Price for "${productName}" has changed from ฿${(cartCents / 100).toFixed(2)} to ฿${(currentCents / 100).toFixed(2)}. Please refresh your cart.`,
});

export type InventoryReceivedPayload = {
  readonly productId: string;
  readonly storeId: string;
  readonly lotId: string;
  readonly quantityCounted: number;
  readonly retailPricePerUnit: number;
  readonly currency: string;
  readonly receivedBy: string;
  readonly receivedAt: string;
};

export type InventoryReceived = DomainEvent<"InventoryReceived", InventoryReceivedPayload>;
export const makeInventoryReceived = (payload: InventoryReceivedPayload): InventoryReceived =>
  makeDomainEvent("InventoryReceived", payload);

export type StockAuditRecordedPayload = {
  readonly productId: string;
  readonly storeId: string;
  readonly auditId: string;
  readonly auditType: AuditType;
  readonly expectedQuantity: number;
  readonly countedQuantity: number;
  readonly varianceUnits: number;
  readonly varianceBaht: number;
  readonly retailPricePerUnit: number;
  readonly auditedBy: string;
  readonly auditedAt: string;
};

export type StockAuditRecorded = DomainEvent<"StockAuditRecorded", StockAuditRecordedPayload>;
export const makeStockAuditRecorded = (payload: StockAuditRecordedPayload): StockAuditRecorded =>
  makeDomainEvent("StockAuditRecorded", payload);

export type ShrinkageChargedPayload = {
  readonly auditId: string;
  readonly productId: string;
  readonly storeId: string;
  readonly totalVarianceBaht: number;
  readonly chargedAmountBaht: number;
  readonly chargedToEmployeeIds: readonly string[];
  readonly splitMethod: "equal" | "proportional";
  readonly chargedAt: string;
  readonly chargedBy: string;
};

export type ShrinkageCharged = DomainEvent<"ShrinkageCharged", ShrinkageChargedPayload>;
export const makeShrinkageCharged = (payload: ShrinkageChargedPayload): ShrinkageCharged =>
  makeDomainEvent("ShrinkageCharged", payload);

export type InventoryBalance = {
  readonly productId: string;
  readonly productName: string;
  readonly storeId: string;
  readonly totalReceived: number;
  readonly totalSold: number;
  readonly expectedOnHand: number;
  readonly retailPricePerUnit: number;
  readonly currency: string;
  readonly lastAuditedAt: string | null;
  readonly lastCountedQuantity: number | null;
  readonly lastVarianceUnits: number | null;
  readonly lastVarianceBaht: number | null;
  readonly lastAuditType: AuditType | null;
};
