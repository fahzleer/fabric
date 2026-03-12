export type PaymentStatus = "pending" | "success" | "failed";

export type InitiatePaymentResult = {
  readonly paymentId: string;
  readonly status: PaymentStatus;
};

export interface PaymentPort {
  initiatePayment(
    orderId: string,
    amountInCents: number,
    currency: string,
    userId: string,
    paymentToken: string | undefined
  ): Promise<InitiatePaymentResult>;
}

export const PAYMENT_GATEWAY = Symbol("PAYMENT_GATEWAY");
