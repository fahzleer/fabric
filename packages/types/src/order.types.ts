import type { DomainEvent } from "./events";
import type { TaggedError } from "./kernel";

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

export type OrderId = { readonly __brand: "OrderId"; readonly value: string };
export const makeOrderId = (value: string): OrderId => ({ __brand: "OrderId", value });

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded";

export const VALID_ORDER_STATUS_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> =
  {
    pending: ["confirmed", "cancelled"],
    confirmed: ["processing", "cancelled"],
    processing: ["shipped", "cancelled"],
    shipped: ["delivered"],
    delivered: [],
    cancelled: [],
    refunded: [],
  };

export const canTransitionOrderStatus = (from: OrderStatus, to: OrderStatus): boolean =>
  (VALID_ORDER_STATUS_TRANSITIONS[from] as readonly OrderStatus[]).includes(to);

export interface ShippingAddressError extends TaggedError<"ShippingAddressError"> {}

export type ShippingAddress = {
  readonly recipientName: string;
  readonly street: string;
  readonly district: string;
  readonly city: string;
  readonly province: string;
  readonly postalCode: string;
  readonly country: string;
  readonly phoneNumber: string;
};

export const makeShippingAddress = (
  raw: ShippingAddress
): ShippingAddress | ShippingAddressError => {
  if (!(raw.recipientName.trim() && raw.street.trim() && raw.postalCode.trim())) {
    return {
      _tag: "ShippingAddressError",
      message: "Recipient name, street, and postal code are required",
    };
  }
  return raw;
};

export interface OrderNotFoundError extends TaggedError<"OrderNotFoundError"> {}
export const OrderNotFoundError = (orderId: string): OrderNotFoundError => ({
  _tag: "OrderNotFoundError",
  message: `Order not found: ${orderId}`,
});

export interface OrderAlreadyCancelledError extends TaggedError<"OrderAlreadyCancelledError"> {}
export const OrderAlreadyCancelledError = (orderId: string): OrderAlreadyCancelledError => ({
  _tag: "OrderAlreadyCancelledError",
  message: `Order ${orderId} is already cancelled`,
});

export interface InvalidOrderStateTransitionError
  extends TaggedError<"InvalidOrderStateTransitionError"> {}
export const InvalidOrderStateTransitionError = (
  orderId: string,
  from: OrderStatus,
  to: OrderStatus
): InvalidOrderStateTransitionError => ({
  _tag: "InvalidOrderStateTransitionError",
  message: `Order ${orderId}: cannot transition from '${from}' to '${to}'`,
});

export interface EmptyOrderError extends TaggedError<"EmptyOrderError"> {}
export const EmptyOrderError = (message: string): EmptyOrderError => ({
  _tag: "EmptyOrderError",
  message,
});

export type OrderError =
  | OrderNotFoundError
  | OrderAlreadyCancelledError
  | InvalidOrderStateTransitionError
  | EmptyOrderError;

export type PaymentMethod = "card" | "crypto" | "promptpay";

export type OrderPlacedPayload = {
  readonly orderId: string;
  readonly userId: string;
  readonly totalAmountInCents: number;
  readonly currency: string;
  readonly itemCount: number;
};
export type OrderPlaced = DomainEvent<"OrderPlaced", OrderPlacedPayload>;
export const makeOrderPlaced = (payload: OrderPlacedPayload): OrderPlaced =>
  makeDomainEventInternal("OrderPlaced", payload);

export type OrderConfirmedPayload = { readonly orderId: string; readonly userId: string };
export type OrderConfirmed = DomainEvent<"OrderConfirmed", OrderConfirmedPayload>;
export const makeOrderConfirmed = (payload: OrderConfirmedPayload): OrderConfirmed =>
  makeDomainEventInternal("OrderConfirmed", payload);

export type OrderShippedPayload = {
  readonly orderId: string;
  readonly trackingNumber: string;
  readonly shippedAt: string;
};
export type OrderShipped = DomainEvent<"OrderShipped", OrderShippedPayload>;
export const makeOrderShipped = (payload: OrderShippedPayload): OrderShipped =>
  makeDomainEventInternal("OrderShipped", payload);

export type OrderDeliveredPayload = { readonly orderId: string; readonly deliveredAt: string };
export type OrderDelivered = DomainEvent<"OrderDelivered", OrderDeliveredPayload>;
export const makeOrderDelivered = (payload: OrderDeliveredPayload): OrderDelivered =>
  makeDomainEventInternal("OrderDelivered", payload);

export type OrderCancelledPayload = { readonly orderId: string; readonly reason: string };
export type OrderCancelled = DomainEvent<"OrderCancelled", OrderCancelledPayload>;
export const makeOrderCancelled = (payload: OrderCancelledPayload): OrderCancelled =>
  makeDomainEventInternal("OrderCancelled", payload);

export type StockReservedPayload = {
  readonly orderId: string;
  readonly productId: string;
  readonly size: string;
  readonly quantity: number;
};
export type StockReserved = DomainEvent<"StockReserved", StockReservedPayload>;
export const makeStockReserved = (payload: StockReservedPayload): StockReserved =>
  makeDomainEventInternal("StockReserved", payload);

export type StockReleasedPayload = {
  readonly orderId: string;
  readonly productId: string;
  readonly size: string;
  readonly quantity: number;
};
export type StockReleased = DomainEvent<"StockReleased", StockReleasedPayload>;
export const makeStockReleased = (payload: StockReleasedPayload): StockReleased =>
  makeDomainEventInternal("StockReleased", payload);

export type OrderDomainEvent =
  | OrderPlaced
  | OrderConfirmed
  | OrderShipped
  | OrderDelivered
  | OrderCancelled
  | StockReserved
  | StockReleased;
