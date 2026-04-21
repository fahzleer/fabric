import type { Maybe, NonEmptyArray } from "@fabric/types";
import { InvalidOrderStateTransitionError, OrderAlreadyCancelledError, Some } from "@fabric/types";
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

export const getOrderLineTotal = (line: OrderLine): number =>
  line.unitPrice.displayAmount * line.quantity;

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

export const isOrderShipped = (order: Order): boolean => order.shippedAt._tag === "Some";

export const transitionOrderStatus = (
  order: Order,
  newStatus: OrderStatus
):
  | { _tag: "Ok"; value: Order }
  | {
      _tag: "Err";
      error: InvalidOrderStateTransitionErrorType | OrderAlreadyCancelledErrorType;
    } => {
  if (order.status === "cancelled")
    return {
      _tag: "Err",
      error: OrderAlreadyCancelledError(order.id),
    };

  if (!canTransitionOrderStatus(order.status, newStatus))
    return {
      _tag: "Err",
      error: InvalidOrderStateTransitionError(order.id, order.status, newStatus),
    };

  return {
    _tag: "Ok",
    value: { ...order, status: newStatus, updatedAt: Temporal.Now.instant() },
  };
};

export const markOrderAsShipped = (
  order: Order,
  trackingNumber: string
): { _tag: "Ok"; value: Order } | { _tag: "Err"; error: InvalidOrderStateTransitionErrorType } => {
  if (order.status !== "processing")
    return {
      _tag: "Err",
      error: InvalidOrderStateTransitionError(order.id, order.status, "shipped"),
    };
  return {
    _tag: "Ok",
    value: {
      ...order,
      status: "shipped",
      shippedAt: Some(Temporal.Now.instant()),
      trackingNumber: Some(trackingNumber),
      updatedAt: Temporal.Now.instant(),
    },
  };
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
