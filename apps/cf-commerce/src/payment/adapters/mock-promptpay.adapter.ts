import type { PromptPayCharge, PromptPayStatusResult } from "./promptpay.adapter.ts";

const MOCK_TTL_MS = 15 * 60 * 1000;
const chargeMap = new Map<string, { orderId: string; expiresAt: number }>();

export class MockPromptPayAdapter {
  async createCharge(
    orderId: string,
    amountCents: number,
    _currency: string
  ): Promise<PromptPayCharge | null> {
    const chargeId = `mock_pp_${crypto.randomUUID()}`;
    const expiresAt = new Date(Date.now() + MOCK_TTL_MS).toISOString();
    chargeMap.set(chargeId, { orderId, expiresAt: Date.now() + MOCK_TTL_MS });

    const displayAmount = (amountCents / 100).toFixed(0);
    const qrImageUrl = `https://placehold.co/300x300/1a1a2e/ffffff?text=PromptPay%0A%E0%B8%BF${displayAmount}`;

    return { chargeId, qrImageUrl, expiresAt };
  }

  async getStatus(chargeId: string): Promise<PromptPayStatusResult> {
    const entry = chargeMap.get(chargeId);
    if (!entry) return { status: "failed" };
    if (Date.now() > entry.expiresAt) return { status: "expired" };
    const age = Date.now() - (entry.expiresAt - MOCK_TTL_MS);
    if (age > 5_000) {
      return { status: "successful", paidAt: new Date().toISOString() };
    }
    return { status: "pending" };
  }

  lookupOrderId(chargeId: string): string | undefined {
    const entry = chargeMap.get(chargeId);
    if (!entry || Date.now() > entry.expiresAt) return undefined;
    return entry.orderId;
  }

  registerCharge(chargeId: string, orderId: string): void {
    chargeMap.set(chargeId, { orderId, expiresAt: Date.now() + MOCK_TTL_MS });
  }
}
