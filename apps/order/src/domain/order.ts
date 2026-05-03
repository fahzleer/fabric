import { Data } from "effect";

// ── Value Objects ─────────────────────────────────────────────────────────────

export type OrderId = string & { readonly _brand: "OrderId" };
export type UserId  = string & { readonly _brand: "UserId" };

export const makeOrderId = (): OrderId => crypto.randomUUID() as OrderId;

// ── Domain Errors ─────────────────────────────────────────────────────────────

export class OrderNotFoundError extends Data.TaggedError(
  "OrderNotFoundError"
)<{ readonly orderId: OrderId }> {}

export class OrderAlreadyPaidError extends Data.TaggedError(
  "OrderAlreadyPaidError"
)<{ readonly orderId: OrderId }> {}

export class InvalidOrderStateError extends Data.TaggedError(
  "InvalidOrderStateError"
)<{ readonly orderId: OrderId; readonly currentStatus: OrderStatus }> {}

// ── Aggregate ─────────────────────────────────────────────────────────────────

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "paid"
  | "shipped"
  | "delivered"
  | "cancelled";

export type PaymentMethod = "card" | "promptpay" | "crypto";

export interface OrderItem {
  readonly productId:      string;
  readonly name:           string;
  readonly size:           string;
  readonly quantity:       number;
  readonly unitPriceCents: number;
}

export interface ShippingAddress {
  readonly recipientName: string;
  readonly street:        string;
  readonly city:          string;
  readonly province:      string;
  readonly postalCode:    string;
  readonly country:       string;
  readonly phone:         string;
}

export interface Order {
  readonly id:              OrderId;
  readonly userId:          UserId;
  readonly items:           OrderItem[];
  readonly totalCents:      number;
  readonly currency:        string;
  readonly status:          OrderStatus;
  readonly paymentMethod:   PaymentMethod;
  readonly shippingAddress: ShippingAddress;
  readonly createdAt:       string;
  readonly updatedAt:       string;
}

// ── Domain Events ─────────────────────────────────────────────────────────────

export type OrderEventType =
  | "OrderPlaced"
  | "OrderConfirmed"
  | "OrderPaid"
  | "OrderCancelled"
  | "OrderShipped"
  | "OrderDelivered";

export interface StoredEvent {
  readonly id:          string;
  readonly aggregateId: OrderId;
  readonly version:     number;
  readonly type:        OrderEventType;
  readonly payload:     unknown;
  readonly createdAt:   string;
}

// ── Apply / Reconstruct ───────────────────────────────────────────────────────

export function applyEvent(state: Partial<Order>, event: StoredEvent): Partial<Order> {
  const ts = event.createdAt;
  switch (event.type) {
    case "OrderPlaced": {
      const p = event.payload as {
        userId:          UserId;
        items:           OrderItem[];
        totalCents:      number;
        currency:        string;
        paymentMethod:   PaymentMethod;
        shippingAddress: ShippingAddress;
      };
      return {
        id:              event.aggregateId,
        userId:          p.userId,
        items:           p.items,
        totalCents:      p.totalCents,
        currency:        p.currency,
        paymentMethod:   p.paymentMethod,
        shippingAddress: p.shippingAddress,
        status:          "pending",
        createdAt:       ts,
        updatedAt:       ts,
      };
    }
    case "OrderConfirmed": return { ...state, status: "confirmed", updatedAt: ts };
    case "OrderPaid":      return { ...state, status: "paid",      updatedAt: ts };
    case "OrderCancelled": return { ...state, status: "cancelled", updatedAt: ts };
    case "OrderShipped":   return { ...state, status: "shipped",   updatedAt: ts };
    case "OrderDelivered": return { ...state, status: "delivered", updatedAt: ts };
    default:               return state;
  }
}

export function reconstruct(events: StoredEvent[]): Order {
  if (events.length === 0) throw new Error("no events — aggregate not found");
  return events.reduce(applyEvent, {} as Partial<Order>) as Order;
}

// ── Domain logic (pure functions) ─────────────────────────────────────────────

export const canTransitionTo = (order: Order, next: OrderStatus): boolean => {
  const allowed: Record<OrderStatus, OrderStatus[]> = {
    pending:   ["confirmed", "cancelled"],
    confirmed: ["paid", "cancelled"],
    paid:      ["shipped"],
    shipped:   ["delivered"],
    delivered: [],
    cancelled: [],
  };
  return (allowed[order.status] ?? []).includes(next);
};
