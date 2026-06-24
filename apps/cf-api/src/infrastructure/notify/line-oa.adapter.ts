import type {
  NotificationPort,
  OrderPlacedPayload,
} from "../../application/ports/notification.port";
import { log } from "../monitoring/logger";

const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";
const LINE_BROADCAST_URL = "https://api.line.me/v2/bot/message/broadcast";

export class LineOaAdapter implements NotificationPort {
  constructor(
    private readonly channelAccessToken: string,
    private readonly adminLineUserId?: string
  ) {}

  async notifyOrderPlaced(payload: OrderPlacedPayload): Promise<void> {
    const { orderId, totalCents, currency, itemCount, recipientName } = payload;
    const amount = (totalCents / 100).toLocaleString("th-TH", { minimumFractionDigits: 2 });

    const message = {
      type: "flex",
      altText: `New order #${orderId.slice(0, 8)} — ${currency} ${amount}`,
      contents: {
        type: "bubble",
        header: {
          type: "box",
          layout: "vertical",
          contents: [
            { type: "text", text: "🛒 New Order Placed", weight: "bold", color: "#ffffff" },
          ],
          backgroundColor: "#1a73e8",
          paddingAll: "15px",
        },
        body: {
          type: "box",
          layout: "vertical",
          spacing: "sm",
          contents: [
            { type: "text", text: `Order #${orderId.slice(0, 8)}`, weight: "bold", size: "lg" },
            ...(recipientName
              ? [{ type: "text", text: `Customer: ${recipientName}`, size: "sm", color: "#555555" }]
              : []),
            { type: "text", text: `Items: ${itemCount}`, size: "sm", color: "#555555" },
            {
              type: "text",
              text: `Total: ${currency} ${amount}`,
              size: "md",
              weight: "bold",
              color: "#1a73e8",
              margin: "md",
            },
          ],
        },
      },
    };

    const target = this.adminLineUserId;
    const [url, body] = target
      ? [LINE_PUSH_URL, JSON.stringify({ to: target, messages: [message] })]
      : [LINE_BROADCAST_URL, JSON.stringify({ messages: [message] })];

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.channelAccessToken}`,
          "Content-Type": "application/json",
        },
        body,
      });

      if (!res.ok) {
        log.warn("LineOA: non-OK response", { status: res.status, orderId });
      }
    } catch (err) {
      log.warn("LineOA: failed to send message", { orderId, error: String(err) });
    }
  }
}
