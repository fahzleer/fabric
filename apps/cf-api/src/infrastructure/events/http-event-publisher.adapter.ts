import type {
  EventEnvelope,
  EventPublisherPort,
} from "../../application/ports/event-publisher.port";
import { log } from "../monitoring/logger";

export class HttpEventPublisherAdapter implements EventPublisherPort {
  private readonly url: string;

  constructor(eventsUrl: string) {
    this.url = `${eventsUrl}/events`;
  }

  async publish(event: EventEnvelope): Promise<void> {
    try {
      await fetch(this.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(event),
      });
    } catch (err) {
      log.warn("Failed to publish domain event", {
        eventType: event.event_type,
        error: String(err),
      });
    }
  }
}
