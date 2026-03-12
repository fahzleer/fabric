import { log } from "../../monitoring/logger";

const OMISE_API_URL = "https://api.omise.co";

const PROMPTPAY_TTL_MS = 15 * 60 * 1000;

const chargeOrderMap = new Map<string, { orderId: string; expiresAt: number }>();

const statusCache = new Map<
  string,
  { status: PromptPayStatus; paidAt?: string; fetchedAt: number }
>();
const STATUS_CACHE_TTL_MS = 3_000;

export type PromptPayStatus = "pending" | "successful" | "failed" | "expired";

export interface PromptPayCharge {
  readonly chargeId: string;
  readonly qrImageUrl: string;
  readonly expiresAt: string;
}

export interface PromptPayStatusResult {
  readonly status: PromptPayStatus;
  readonly paidAt?: string;
}

export class PromptPayAdapter {
  private readonly authHeader: string;

  constructor(secretKey: string) {
    this.authHeader = `Basic ${btoa(`${secretKey}:`)}`;
  }

  async createCharge(
    orderId: string,
    amountCents: number,
    currency: string
  ): Promise<PromptPayCharge | null> {
    try {
      const sourceRes = await fetch(`${OMISE_API_URL}/sources`, {
        method: "POST",
        headers: { Authorization: this.authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "promptpay",
          amount: amountCents,
          currency: currency.toLowerCase(),
        }),
      });

      const source = (await sourceRes.json()) as OmiseSourceResponse;
      if (!sourceRes.ok || source.object === "error") {
        log.warn("Omise PromptPay source creation failed", { orderId, message: source.message });
        return null;
      }

      const chargeRes = await fetch(`${OMISE_API_URL}/charges`, {
        method: "POST",
        headers: { Authorization: this.authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amountCents,
          currency: currency.toLowerCase(),
          source: source.id,
          description: `Order ${orderId} (PromptPay)`,
          metadata: { orderId },
        }),
      });

      const charge = (await chargeRes.json()) as OmiseChargeResponse;
      if (!chargeRes.ok || charge.object === "error") {
        log.warn("Omise PromptPay charge creation failed", { orderId, message: charge.message });
        return null;
      }

      const expiresAt = new Date(Date.now() + PROMPTPAY_TTL_MS).toISOString();

      chargeOrderMap.set(charge.id, { orderId, expiresAt: Date.now() + PROMPTPAY_TTL_MS });

      const qrImageUrl = charge.source?.scannable_code?.image?.download_uri ?? "";

      log.info("PromptPay charge created", {
        orderId,
        chargeId: charge.id,
        qrImageUrl: !!qrImageUrl,
      });

      return { chargeId: charge.id, qrImageUrl, expiresAt };
    } catch (cause) {
      log.error("PromptPay createCharge error", { orderId, error: String(cause) });
      return null;
    }
  }

  async getStatus(chargeId: string): Promise<PromptPayStatusResult> {
    const cached = statusCache.get(chargeId);
    if (cached && Date.now() - cached.fetchedAt < STATUS_CACHE_TTL_MS) {
      return { status: cached.status, ...(cached.paidAt !== undefined && { paidAt: cached.paidAt }) };
    }

    try {
      const res = await fetch(`${OMISE_API_URL}/charges/${chargeId}`, {
        headers: { Authorization: this.authHeader },
      });

      const charge = (await res.json()) as OmiseChargeResponse;
      if (!res.ok || charge.object === "error") {
        return { status: "failed" };
      }

      const status = omiseStatusToPromptPay(charge.status);
      const paidAt = status === "successful" ? charge.paid_at : undefined;

      statusCache.set(chargeId, { status, fetchedAt: Date.now(), ...(paidAt !== undefined && { paidAt }) });

      return { status, ...(paidAt !== undefined && { paidAt }) };
    } catch (cause) {
      log.error("PromptPay getStatus error", { chargeId, error: String(cause) });
      return { status: "failed" };
    }
  }

  lookupOrderId(chargeId: string): string | undefined {
    const entry = chargeOrderMap.get(chargeId);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      chargeOrderMap.delete(chargeId);
      return undefined;
    }
    return entry.orderId;
  }

  registerCharge(chargeId: string, orderId: string): void {
    chargeOrderMap.set(chargeId, { orderId, expiresAt: Date.now() + PROMPTPAY_TTL_MS });
  }
}

function omiseStatusToPromptPay(status: string): PromptPayStatus {
  switch (status) {
    case "successful":
      return "successful";
    case "failed":
      return "failed";
    case "expired":
      return "expired";
    case "reversed":
      return "failed";
    default:
      return "pending";
  }
}

interface OmiseSourceResponse {
  readonly object?: string;
  readonly id: string;
  readonly message?: string;
}

interface OmiseChargeResponse {
  readonly object?: string;
  readonly id: string;
  readonly status: string;
  readonly paid_at?: string;
  readonly message?: string;
  readonly source?: {
    readonly scannable_code?: {
      readonly image?: {
        readonly download_uri?: string;
      };
    };
  };
}
