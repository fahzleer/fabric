import { Data } from "effect";

// ── Value Objects ─────────────────────────────────────────────────────────────

export type PaymentId = string & { readonly _brand: "PaymentId" };
export type OrderId   = string & { readonly _brand: "OrderId" };

export const makePaymentId = (): PaymentId => crypto.randomUUID() as PaymentId;

// ── Domain Errors ─────────────────────────────────────────────────────────────

export class PaymentNotFoundError extends Data.TaggedError("PaymentNotFoundError")<{
  readonly paymentId: PaymentId;
}> {}

export class PaymentAlreadyProcessedError extends Data.TaggedError("PaymentAlreadyProcessedError")<{
  readonly paymentId: PaymentId;
}> {}

export class PaymentGatewayError extends Data.TaggedError("PaymentGatewayError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

// ── Aggregate ─────────────────────────────────────────────────────────────────

export type PaymentStatus   = "pending" | "processing" | "succeeded" | "failed" | "refunded";
export type PaymentProvider = "omise" | "stripe" | "usdc";
export type PaymentMethod   = "card" | "promptpay" | "crypto";

export interface Payment {
  readonly id:               PaymentId;
  readonly orderId:          OrderId;
  readonly amountCents:      number;
  readonly currency:         string;
  readonly method:           PaymentMethod;
  readonly provider:         PaymentProvider;
  readonly status:           PaymentStatus;
  readonly providerRef:      string | null;   // Omise charge id, Stripe PI id, etc.
  readonly failureReason:    string | null;
  readonly createdAt:        string;
  readonly updatedAt:        string;
}

// ── Domain Logic ──────────────────────────────────────────────────────────────

export const methodToProvider = (method: PaymentMethod): PaymentProvider => {
  switch (method) {
    case "card":      return "omise";
    case "promptpay": return "omise";
    case "crypto":    return "usdc";
  }
};

export const isTerminal = (status: PaymentStatus): boolean =>
  status === "succeeded" || status === "failed" || status === "refunded";
