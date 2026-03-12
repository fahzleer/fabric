import type { DomainEvent } from "./events";

const makeDomainEventInternal = <TType extends string, TPayload>(
  _type: TType,
  payload: TPayload
): DomainEvent<TType, TPayload> => ({
  _type,
  _version: 1,
  eventId: crypto.randomUUID(),
  occurredAt: new Date().toISOString(),
  payload,
});

export type CheckoutCalculatedPayload = {
  readonly orderId: string;
  readonly userId?: string;
  readonly subtotalCents: number;
  readonly discountCents: number;
  readonly shippingCents: number;
  readonly taxCents: number;
  readonly totalCents: number;
  readonly currency: string;
  readonly country: string;
  readonly voucherCode?: string;
  readonly calculatedAt: string;
};
export type CheckoutCalculated = DomainEvent<"CheckoutCalculated", CheckoutCalculatedPayload>;
export const makeCheckoutCalculated = (payload: CheckoutCalculatedPayload): CheckoutCalculated =>
  makeDomainEventInternal("CheckoutCalculated", payload);

export type VoucherAppliedPayload = {
  readonly voucherCode: string;
  readonly orderId: string;
  readonly discountCents: number;
  readonly discountType: "PercentOff" | "FixedOff" | "FreeShipping" | "BuyXGetY";
  readonly appliedAt: string;
};
export type VoucherApplied = DomainEvent<"VoucherApplied", VoucherAppliedPayload>;
export const makeVoucherApplied = (payload: VoucherAppliedPayload): VoucherApplied =>
  makeDomainEventInternal("VoucherApplied", payload);

export type VoucherRejectedReason =
  | "MinOrderNotMet"
  | "Expired"
  | "MaxUsagesReached"
  | "InvalidCode"
  | "AlreadyUsed";

export type VoucherRejectedPayload = {
  readonly voucherCode: string;
  readonly orderId: string;
  readonly reason: VoucherRejectedReason;
  readonly rejectedAt: string;
};
export type VoucherRejected = DomainEvent<"VoucherRejected", VoucherRejectedPayload>;
export const makeVoucherRejected = (payload: VoucherRejectedPayload): VoucherRejected =>
  makeDomainEventInternal("VoucherRejected", payload);

export type ReservedItem = {
  readonly productId: string;
  readonly size: string;
  readonly quantity: number;
};

export type InventoryReservedPayload = {
  readonly orderId: string;
  readonly userId: string;
  readonly items: readonly ReservedItem[];
  readonly reservedAt: string;
};
export type InventoryReserved = DomainEvent<"InventoryReserved", InventoryReservedPayload>;
export const makeInventoryReserved = (payload: InventoryReservedPayload): InventoryReserved =>
  makeDomainEventInternal("InventoryReserved", payload);

export type InventoryReservationFailedPayload = {
  readonly orderId: string;
  readonly userId: string;
  readonly failedItem: ReservedItem;
  readonly availableQuantity: number;
  readonly failedAt: string;
};
export type InventoryReservationFailed = DomainEvent<
  "InventoryReservationFailed",
  InventoryReservationFailedPayload
>;
export const makeInventoryReservationFailed = (
  payload: InventoryReservationFailedPayload
): InventoryReservationFailed => makeDomainEventInternal("InventoryReservationFailed", payload);

export type PricingDomainEvent =
  | CheckoutCalculated
  | VoucherApplied
  | VoucherRejected
  | InventoryReserved
  | InventoryReservationFailed;
