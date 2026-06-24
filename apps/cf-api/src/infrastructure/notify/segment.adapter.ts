import type {
  NotificationPort,
  OrderPlacedPayload,
} from "../../application/ports/notification.port";
import { log } from "../monitoring/logger";

const SEGMENT_TRACK_URL = "https://api.segment.io/v1/track";

export class SegmentAdapter implements NotificationPort {
  private readonly authHeader: string;

  constructor(writeKey: string) {
    this.authHeader = `Basic ${Buffer.from(`${writeKey}:`).toString("base64")}`;
  }

  async notifyOrderPlaced(payload: OrderPlacedPayload): Promise<void> {
    const { orderId, userId, userEmail, totalCents, currency, itemCount } = payload;

    try {
      const res = await fetch(SEGMENT_TRACK_URL, {
        method: "POST",
        headers: {
          Authorization: this.authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          event: "Order Completed",
          properties: {
            order_id: orderId,
            total: totalCents / 100,
            currency,
            products: itemCount,
            email: userEmail,
          },
          timestamp: new Date().toISOString(),
        }),
      });

      if (!res.ok) {
        log.warn("Segment: track failed", { status: res.status, orderId });
      }
    } catch (err) {
      log.warn("Segment: failed to track event", { orderId, error: String(err) });
    }
  }
}
