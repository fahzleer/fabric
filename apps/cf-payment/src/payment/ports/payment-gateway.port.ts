export interface ChargeResult {
  readonly paymentId: string;
  readonly success: boolean;
  readonly failureReason?: string;
}

export interface IPaymentGateway {
  charge(
    orderId: string,
    amountCents: number,
    currency: string,
    token: string
  ): Promise<ChargeResult>;

  refund(paymentId: string, amountCents: number): Promise<{ success: boolean }>;
}
