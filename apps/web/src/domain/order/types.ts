import type {
  OrderAlreadyCancelledError,
  OrderId,
  OrderStatus,
  ProductSize,
  ShippingAddress,
} from "@fabric/types";
import { formatPrice } from "../../lib/price";

export type {
  OrderId,
  OrderStatus,
  ShippingAddress,
  ShippingAddressError,
  OrderNotFoundError,
  OrderAlreadyCancelledError,
  InvalidOrderStateTransitionError,
  EmptyOrderError,
  OrderError,
  OrderDomainEvent,
  OrderPlaced,
  OrderConfirmed,
  OrderShipped,
  OrderDelivered,
  OrderCancelled,
  StockReserved,
  StockReleased,
} from "@fabric/types";

export {
  makeOrderId,
  makeShippingAddress,
  VALID_ORDER_STATUS_TRANSITIONS,
  canTransitionOrderStatus,
  makeOrderPlaced,
  makeOrderConfirmed,
  makeOrderShipped,
  makeOrderDelivered,
  makeOrderCancelled,
  makeStockReserved,
  makeStockReleased,
} from "@fabric/types";

export interface OrderLine {
  readonly productId: string;
  readonly productName: string;
  readonly unitPriceInCents: number;
  readonly currency: string;
  readonly size: ProductSize;
  readonly quantity: number;
}

export const getOrderLineTotal = (line: OrderLine): number => line.unitPriceInCents * line.quantity;

export interface OrderSummary {
  readonly id: OrderId;
  readonly status: OrderStatus;
  readonly itemCount: number;
  readonly totalAmountInCents: number;
  readonly currency: string;
  readonly placedAt: string;
}

export const formatOrderTotal = (summary: OrderSummary): string =>
  formatPrice({ amount: summary.totalAmountInCents / 100, currency: summary.currency });

export const isOrderActive = (summary: OrderSummary): boolean =>
  !["cancelled", "refunded", "delivered"].includes(summary.status);

export interface OrderDetail {
  readonly id: OrderId;
  readonly status: OrderStatus;
  readonly lines: readonly OrderLine[];
  readonly totalAmountInCents: number;
  readonly currency: string;
  readonly shippingAddress: ShippingAddress;
  readonly placedAt: string;
  readonly trackingNumber: string | "not_assigned";
}

export const isOrderShipped = (order: OrderDetail): boolean =>
  order.trackingNumber !== "not_assigned";

export type OrderCannotBeCancelledError = OrderAlreadyCancelledError;
