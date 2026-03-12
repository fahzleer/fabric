export type PaymentMethod = "card" | "crypto" | "promptpay";

export interface PaymentRequest {
  readonly orderId: string;
  readonly totalCents: number;
  readonly currency: string;
  readonly userId: string;
  readonly paymentToken?: string;
  readonly paymentMethod?: PaymentMethod;
}

export interface PaymentResult {
  readonly orderId: string;
  readonly paymentId: string;
  readonly success: boolean;
  readonly reason?: string;
}
