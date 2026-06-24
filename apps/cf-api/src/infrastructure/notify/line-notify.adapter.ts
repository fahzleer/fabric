import type {
  NotificationPort,
  OrderPlacedPayload,
} from "../../application/ports/notification.port";
import { log } from "../monitoring/logger";

const LINE_NOTIFY_URL = "https://notify-api.line.me/api/notify";

export class LineNotifyAdapter implements NotificationPort {
  constructor(private readonly token: string) {}

  async notifyOrderPlaced(payload: OrderPlacedPayload): Promise<void> {
    const { orderId, totalCents, currency, itemCount } = payload;
    const amount = (totalCents / 100).toLocaleString("th-TH", { minimumFractionDigits: 2 });
    const message = `\n🛒 New Order\nOrder: #${orderId.slice(0, 8)}\nItems: ${itemCount}\nTotal: ${currency} ${amount}`;

    try {
      const res = await fetch(LINE_NOTIFY_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ message }),
      });

      if (!res.ok) {
        log.warn("LineNotify: non-OK response", { status: res.status, orderId });
      }
    } catch (err) {
      log.warn("LineNotify: failed to send", { orderId, error: String(err) });
    }
  }
}
