import { log } from "../../monitoring/logger";
import type { ChargeResult, IPaymentGateway } from "../ports/payment-gateway.port";

const OMISE_API_URL = "https://api.omise.co";

export class OmisePaymentGateway implements IPaymentGateway {
  private readonly authHeader: string;

  constructor(secretKey: string) {
    this.authHeader = `Basic ${btoa(`${secretKey}:`)}`;
  }

  async charge(
    orderId: string,
    amountCents: number,
    currency: string,
    token: string
  ): Promise<ChargeResult> {
    try {
      const res = await fetch(`${OMISE_API_URL}/charges`, {
        method: "POST",
        headers: {
          Authorization: this.authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: amountCents,
          currency: currency.toLowerCase(),
          card: token,
          description: `Order ${orderId}`,
          metadata: { orderId },
          capture: true,
        }),
      });

      const data = (await res.json()) as OmiseChargeResponse;

      if (!res.ok || data.object === "error") {
        const reason = data.message ?? "Omise charge failed";
        log.warn("Omise charge failed", { orderId, status: res.status, reason });
        return { paymentId: `omise_failed_${Date.now()}`, success: false, failureReason: reason };
      }

      const success = data.status === "successful";
      const failureReason = success ? undefined : (data.failure_message ?? data.status);

      log.info("Omise charge completed", { orderId, chargeId: data.id, status: data.status });

      return {
        paymentId: data.id,
        success,
        ...(failureReason !== undefined && { failureReason }),
      };
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      log.error("Omise charge network error", { orderId, error: message });
      return {
        paymentId: `omise_error_${Date.now()}`,
        success: false,
        failureReason: `Network error: ${message}`,
      };
    }
  }

  async refund(paymentId: string, amountCents: number): Promise<{ success: boolean }> {
    try {
      const res = await fetch(`${OMISE_API_URL}/charges/${paymentId}/refunds`, {
        method: "POST",
        headers: {
          Authorization: this.authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ amount: amountCents }),
      });

      const data = (await res.json()) as { object?: string; status?: string; message?: string };

      if (!res.ok || data.object === "error") {
        log.warn("Omise refund failed", { paymentId, reason: data.message });
        return { success: false };
      }

      log.info("Omise refund successful", { paymentId, amountCents });
      return { success: true };
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      log.error("Omise refund network error", { paymentId, error: message });
      return { success: false };
    }
  }
}

interface OmiseChargeResponse {
  readonly object?: string;
  readonly id: string;
  readonly status: "pending" | "successful" | "failed" | "reversed" | "expired";
  readonly failure_message?: string;
  readonly message?: string;
}
