// ── Order domain events ───────────────────────────────────────────────────────
// These are the canonical Kafka message payloads.
// Every service that produces or consumes order events MUST use these types.

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

export type OrderStatus     = "pending" | "confirmed" | "paid" | "shipped" | "delivered" | "cancelled";
export type PaymentMethod   = "card" | "promptpay" | "crypto";

export interface OrderPlacedEvent {
  readonly _type:          "order.placed";
  readonly id:             string;
  readonly userId:         string;
  readonly items:          OrderItem[];
  readonly totalCents:     number;
  readonly currency:       string;
  readonly status:         OrderStatus;
  readonly paymentMethod:  PaymentMethod;
  readonly shippingAddress: ShippingAddress;
  readonly createdAt:      string;
  readonly updatedAt:      string;
}

export interface OrderConfirmedEvent {
  readonly _type:   "order.confirmed";
  readonly id:      string;
  readonly userId:  string;
  readonly status:  "confirmed";
  readonly updatedAt: string;
}

export interface OrderPaidEvent {
  readonly _type:   "order.paid";
  readonly id:      string;
  readonly userId:  string;
  readonly status:  "paid";
  readonly updatedAt: string;
}

export interface OrderCancelledEvent {
  readonly _type:   "order.cancelled";
  readonly id:      string;
  readonly userId:  string;
  readonly status:  "cancelled";
  readonly updatedAt: string;
}

export type OrderEvent =
  | OrderPlacedEvent
  | OrderConfirmedEvent
  | OrderPaidEvent
  | OrderCancelledEvent;
