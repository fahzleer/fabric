import { createHmac } from "node:crypto";
import type { InitiatePaymentResult, PaymentPort } from "../../application/ports/payment.port";
import { log } from "../monitoring/logger";

// 2C2P Payment Gateway — https://developer.2c2p.com/
const SANDBOX_URL = "https://sandbox-pgw.2c2p.com/payment/4.1/PaymentToken";
const PROD_URL = "https://pgw.2c2p.com/payment/4.1/PaymentToken";

export class TwoCTwoPAdapter implements PaymentPort {
  private readonly apiUrl: string;

  constructor(
    private readonly merchantId: string,
    private readonly secretKey: string,
    private readonly isSandbox: boolean = true
  ) {
    this.apiUrl = isSandbox ? SANDBOX_URL : PROD_URL;
  }

  private buildSignature(payload: Record<string, unknown>): string {
    const sortedKeys = Object.keys(payload).sort();
    const message = sortedKeys.map((k) => `${k}=${payload[k]}`).join("&");
    return createHmac("sha256", this.secretKey).update(message).digest("hex").toUpperCase();
  }

  async initiatePayment(
    orderId: string,
    totalCents: number,
    currency: string,
    userId: string,
    _token?: string
  ): Promise<InitiatePaymentResult> {
    const amount = (totalCents / 100).toFixed(2);
    const currencyCode = currency === "THB" ? "764" : "840";

    const payload = {
      merchantID: this.merchantId,
      invoiceNo: orderId.slice(0, 20),
      description: `Order ${orderId.slice(0, 8)}`,
      amount,
      currencyCode,
      paymentChannel: ["CC"],
      request3DS: "Y",
      userDefined1: userId,
    };

    const signature = this.buildSignature(payload as Record<string, unknown>);

    try {
      const res = await fetch(this.apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, signature }),
      });

      if (!res.ok) {
        log.warn("2C2P: payment token request failed", { status: res.status, orderId });
        return { paymentId: orderId, status: "failed" };
      }

      const data = (await res.json()) as { paymentToken?: string; respCode?: string };
      if (data.respCode !== "0000") {
        log.warn("2C2P: non-success response", { respCode: data.respCode, orderId });
        return { paymentId: orderId, status: "failed" };
      }

      log.info("2C2P: payment token issued", { orderId, token: data.paymentToken?.slice(0, 8) });
      return { paymentId: data.paymentToken ?? orderId, status: "pending" };
    } catch (err) {
      log.warn("2C2P: initiatePayment error", { orderId, error: String(err) });
      return { paymentId: orderId, status: "failed" };
    }
  }
}
