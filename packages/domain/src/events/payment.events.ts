// ── Payment domain events ─────────────────────────────────────────────────────

export type PaymentEventMethod   = "card" | "promptpay" | "crypto";
export type PaymentEventProvider = "omise" | "stripe" | "usdc";

export interface PaymentInitiatedEvent {
  readonly _type:       "payment.initiated";
  readonly id:          string;
  readonly orderId:     string;
  readonly amountCents: number;
  readonly currency:    string;
  readonly method:      PaymentEventMethod;
  readonly provider:    PaymentEventProvider;
  readonly createdAt:   string;
}

export interface PaymentSucceededEvent {
  readonly _type:       "payment.succeeded";
  readonly id:          string;
  readonly orderId:     string;
  readonly amountCents: number;
  readonly currency:    string;
  readonly providerRef: string;
  readonly updatedAt:   string;
}

export interface PaymentFailedEvent {
  readonly _type:         "payment.failed";
  readonly id:            string;
  readonly orderId:       string;
  readonly failureReason: string;
  readonly updatedAt:     string;
}

export interface PaymentRefundedEvent {
  readonly _type:     "payment.refunded";
  readonly id:        string;
  readonly orderId:   string;
  readonly updatedAt: string;
}

export type PaymentEvent =
  | PaymentInitiatedEvent
  | PaymentSucceededEvent
  | PaymentFailedEvent
  | PaymentRefundedEvent;
