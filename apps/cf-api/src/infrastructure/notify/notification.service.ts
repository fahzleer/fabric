import type {
  NotificationPort,
  OrderPlacedPayload,
} from "../../application/ports/notification.port";

export class NotificationService implements NotificationPort {
  constructor(private readonly adapters: NotificationPort[]) {}

  async notifyOrderPlaced(payload: OrderPlacedPayload): Promise<void> {
    await Promise.allSettled(this.adapters.map((adapter) => adapter.notifyOrderPlaced(payload)));
  }
}
