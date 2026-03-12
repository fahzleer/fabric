export type DomainEvent<TType extends string, TPayload> = {
  readonly _type: TType;
  readonly _version: number;
  readonly eventId: string;
  readonly occurredAt: string;
  readonly payload: TPayload;
};

export const makeDomainEvent = <TType extends string, TPayload>(
  _type: TType,
  payload: TPayload
): DomainEvent<TType, TPayload> => ({
  _type,
  _version: 1,
  eventId: crypto.randomUUID(),
  occurredAt: new Date().toISOString(),
  payload,
});

export type EventHandler<TPayload> = (payload: TPayload) => Promise<void>;

export interface EventBusPort {
  publish<TType extends string, TPayload>(event: DomainEvent<TType, TPayload>): Promise<void>;

  subscribe<TType extends string, TPayload>(
    eventType: TType,
    handler: EventHandler<TPayload>
  ): void;
}

import type { DomainEvent as DE } from "./events";

export type PaymentProcessedPayload = {
  readonly orderId: string;
  readonly paymentId: string;
  readonly amountInCents: number;
  readonly currency: string;
  readonly processedAt: string;
};

export type PaymentProcessed = DE<"PaymentProcessed", PaymentProcessedPayload>;
export const makePaymentProcessed = (payload: PaymentProcessedPayload): PaymentProcessed =>
  makeDomainEvent("PaymentProcessed", payload);

export type PaymentFailedPayload = {
  readonly orderId: string;
  readonly reason: string;
  readonly failedAt: string;
};

export type PaymentFailed = DE<"PaymentFailed", PaymentFailedPayload>;
export const makePaymentFailed = (payload: PaymentFailedPayload): PaymentFailed =>
  makeDomainEvent("PaymentFailed", payload);

export type PaymentInitiatedPayload = {
  readonly orderId: string;
  readonly amountCents: number;
  readonly currency: string;
  readonly method: "card" | "crypto" | "promptpay";
  readonly initiatedAt: string;
};
export type PaymentInitiated = DE<"PaymentInitiated", PaymentInitiatedPayload>;
export const makePaymentInitiated = (payload: PaymentInitiatedPayload): PaymentInitiated =>
  makeDomainEvent("PaymentInitiated", payload);

export type RefundInitiatedPayload = {
  readonly paymentId: string;
  readonly orderId: string;
  readonly amountCents: number;
  readonly reason: string;
  readonly initiatedAt: string;
};
export type RefundInitiated = DE<"RefundInitiated", RefundInitiatedPayload>;
export const makeRefundInitiated = (payload: RefundInitiatedPayload): RefundInitiated =>
  makeDomainEvent("RefundInitiated", payload);

export type RefundCompletedPayload = {
  readonly paymentId: string;
  readonly orderId: string;
  readonly amountCents: number;
  readonly refundedAt: string;
};
export type RefundCompleted = DE<"RefundCompleted", RefundCompletedPayload>;
export const makeRefundCompleted = (payload: RefundCompletedPayload): RefundCompleted =>
  makeDomainEvent("RefundCompleted", payload);

export type PaymentDomainEvent =
  | PaymentInitiated
  | PaymentProcessed
  | PaymentFailed
  | RefundInitiated
  | RefundCompleted;

export type {
  OrderPlaced,
  OrderConfirmed,
  OrderShipped,
  OrderDelivered,
  OrderCancelled,
  StockReserved,
  StockReleased,
  OrderDomainEvent,
} from "./order.types";

export type OrderDomainEventExtended =
  | import("./order.types").OrderDomainEvent
  | PaymentProcessed
  | PaymentFailed;
