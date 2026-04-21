import type { InitiatePaymentResult, PaymentPort } from "../../application/ports/payment.port";
import { log } from "../monitoring/logger";

export class HttpPaymentAdapter implements PaymentPort {
  private readonly baseUrl: string;

  constructor(paymentUrl: string) {
    this.baseUrl = paymentUrl;
  }

  async initiatePayment(
    orderId: string,
    amountInCents: number,
    currency: string,
    userId: string,
    paymentToken: string | undefined
  ): Promise<InitiatePaymentResult> {
    try {
      const res = await fetch(`${this.baseUrl}/payment/initiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, amountInCents, currency, userId, paymentToken }),
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) {
        const data = (await res.json()) as { paymentId?: string; status?: string };
        return {
          paymentId: data.paymentId ?? orderId,
          status: (data.status as InitiatePaymentResult["status"]) ?? "pending",
        };
      }
    } catch (cause) {
      log.warn("Payment initiation failed", { orderId, error: String(cause) });
    }
    return { paymentId: orderId, status: "pending" };
  }
}
