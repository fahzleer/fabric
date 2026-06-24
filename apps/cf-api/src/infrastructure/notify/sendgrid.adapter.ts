import type {
  NotificationPort,
  OrderPlacedPayload,
} from "../../application/ports/notification.port";
import { log } from "../monitoring/logger";

const SENDGRID_URL = "https://api.sendgrid.com/v3/mail/send";

export class SendGridAdapter implements NotificationPort {
  constructor(
    private readonly apiKey: string,
    private readonly fromEmail: string,
    private readonly fromName: string = "Fabric Store"
  ) {}

  async notifyOrderPlaced(payload: OrderPlacedPayload): Promise<void> {
    if (!payload.userEmail) return;

    const { orderId, totalCents, currency, itemCount, userEmail, recipientName } = payload;
    const amount = (totalCents / 100).toLocaleString("th-TH", { minimumFractionDigits: 2 });

    const body = {
      personalizations: [
        {
          to: [{ email: userEmail, name: recipientName }],
          subject: `Order Confirmed #${orderId.slice(0, 8)}`,
        },
      ],
      from: { email: this.fromEmail, name: this.fromName },
      content: [
        {
          type: "text/html",
          value: `
            <h2>Thank you for your order!</h2>
            <p>Hi ${recipientName ?? "there"},</p>
            <p>Your order <strong>#${orderId.slice(0, 8)}</strong> has been received.</p>
            <ul>
              <li>Items: ${itemCount}</li>
              <li>Total: ${currency} ${amount}</li>
            </ul>
            <p>We'll notify you once your order is shipped.</p>
          `,
        },
      ],
    };

    try {
      const res = await fetch(SENDGRID_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        log.warn("SendGrid: non-OK response", { status: res.status, orderId });
      }
    } catch (err) {
      log.warn("SendGrid: failed to send email", { orderId, error: String(err) });
    }
  }
}
