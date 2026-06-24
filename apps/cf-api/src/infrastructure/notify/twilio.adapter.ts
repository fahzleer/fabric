import type {
  NotificationPort,
  OrderPlacedPayload,
} from "../../application/ports/notification.port";
import { log } from "../monitoring/logger";

export class TwilioAdapter implements NotificationPort {
  private readonly url: string;
  private readonly authHeader: string;

  constructor(
    accountSid: string,
    authToken: string,
    private readonly fromPhone: string
  ) {
    this.url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    this.authHeader = `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`;
  }

  async notifyOrderPlaced(payload: OrderPlacedPayload): Promise<void> {
    if (!payload.customerPhone) return;

    const { orderId, totalCents, currency, itemCount, customerPhone } = payload;
    const amount = (totalCents / 100).toLocaleString("th-TH", { minimumFractionDigits: 2 });
    const body = `[Fabric] Order #${orderId.slice(0, 8)} confirmed. ${itemCount} item(s) — ${currency} ${amount}. Thank you!`;

    try {
      const res = await fetch(this.url, {
        method: "POST",
        headers: {
          Authorization: this.authHeader,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: customerPhone,
          From: this.fromPhone,
          Body: body,
        }),
      });

      if (!res.ok) {
        log.warn("Twilio: non-OK response", { status: res.status, orderId });
      }
    } catch (err) {
      log.warn("Twilio: failed to send SMS", { orderId, error: String(err) });
    }
  }
}
