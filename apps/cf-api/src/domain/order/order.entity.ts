import type { Maybe, NonEmptyArray, Result } from "@fabric/types";
import {
  Err,
  InvalidOrderStateTransitionError,
  Ok,
  OrderAlreadyCancelledError,
  Some,
  isSome,
} from "@fabric/types";
import { Temporal } from "@js-temporal/polyfill";
import type { ProductId, ProductPrice, ProductSize } from "../product/product.value-objects";
import type { UserId } from "../user/user.value-objects";
import type {
  InvalidOrderStateTransitionError as InvalidOrderStateTransitionErrorType,
  OrderAlreadyCancelledError as OrderAlreadyCancelledErrorType,
} from "./order.errors";
import type { OrderId, OrderStatus, ShippingAddress } from "./order.value-objects";
import { canTransitionOrderStatus } from "./order.value-objects";

export interface OrderLine {
  readonly productId: ProductId;
  readonly productName: string;
  readonly unitPrice: ProductPrice;
  readonly size: ProductSize;
  readonly quantity: number;
}

export const getOrderLineTotal = (line: OrderLine): number => line.unitPrice.amount * line.quantity;

export interface Order {
  readonly id: OrderId;
  readonly userId: UserId;
  readonly cartId: string;
  readonly lines: NonEmptyArray<OrderLine>;
  readonly status: OrderStatus;
  readonly shippingAddress: ShippingAddress;
  readonly totalAmountInCents: number;
  readonly shippingCents: number;
  readonly discountCents: number;
  readonly currency: string;
  readonly placedAt: Temporal.Instant;
  readonly updatedAt: Temporal.Instant;
  readonly shippedAt: Maybe<Temporal.Instant>;
  readonly trackingNumber: Maybe<string>;
}

export const calculateOrderTotal = (lines: readonly OrderLine[]): number =>
  lines.reduce((sum, line) => sum + getOrderLineTotal(line), 0);

export const isOrderShipped = (order: Order): boolean => isSome(order.shippedAt);

export const transitionOrderStatus = (
  order: Order,
  newStatus: OrderStatus
): Result<Order, InvalidOrderStateTransitionErrorType | OrderAlreadyCancelledErrorType> => {
  if (order.status === "cancelled") return Err(OrderAlreadyCancelledError(order.id.value));

  if (!canTransitionOrderStatus(order.status, newStatus))
    return Err(InvalidOrderStateTransitionError(order.id.value, order.status, newStatus));

  return Ok({ ...order, status: newStatus, updatedAt: Temporal.Now.instant() });
};

export const markOrderAsShipped = (
  order: Order,
  trackingNumber: string
): Result<Order, InvalidOrderStateTransitionErrorType> => {
  if (order.status !== "processing")
    return Err(InvalidOrderStateTransitionError(order.id.value, order.status, "shipped"));
  return Ok({
    ...order,
    status: "shipped",
    shippedAt: Some(Temporal.Now.instant()),
    trackingNumber: Some(trackingNumber),
    updatedAt: Temporal.Now.instant(),
  });
};

export interface OrderSummary {
  readonly id: OrderId;
  readonly status: OrderStatus;
  readonly itemCount: number;
  readonly totalAmountInCents: number;
  readonly currency: string;
  readonly placedAt: Temporal.Instant;
}

export const toOrderSummary = (order: Order): OrderSummary => ({
  id: order.id,
  status: order.status,
  itemCount: order.lines.reduce((sum, line) => sum + line.quantity, 0),
  totalAmountInCents: order.totalAmountInCents,
  currency: order.currency,
  placedAt: order.placedAt,
});
