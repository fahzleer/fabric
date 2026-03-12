import type { ChargeResult, IPaymentGateway } from "../ports/payment-gateway.port";

export class MockPaymentGateway implements IPaymentGateway {
  async charge(
    _orderId: string,
    _amountCents: number,
    _currency: string,
    _token: string
  ): Promise<ChargeResult> {
    const success = Math.random() < 0.95;
    return {
      paymentId: `mock_pay_${crypto.randomUUID()}`,
      success,
      ...(success ? {} : { failureReason: "Card declined (mock)" }),
    };
  }

  async refund(_paymentId: string, _amountCents: number): Promise<{ success: boolean }> {
    return { success: true };
  }
}
