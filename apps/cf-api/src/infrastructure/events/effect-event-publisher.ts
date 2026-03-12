import { Duration, Effect, Schedule } from "effect";
import type { EventEnvelope } from "../../application/ports/event-publisher.port";
import { log } from "../monitoring/logger";

const retryPolicy = Schedule.intersect(
  Schedule.exponential(Duration.millis(200)),
  Schedule.recurs(1)
);

const postEvent = (url: string, event: EventEnvelope): Effect.Effect<void, Error> =>
  Effect.tryPromise({
    try: async () => {
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(event),
      });
    },
    catch: (cause) => (cause instanceof Error ? cause : new Error(String(cause))),
  });

export const publishEventEffect = (
  event: EventEnvelope,
  baseUrl = process.env.EVENTS_SERVICE_URL ?? "http://localhost:8082"
): Effect.Effect<void, never> => {
  const url = `${baseUrl}/events`;

  return Effect.catchAll(Effect.retry(postEvent(url, event), retryPolicy), (err) => {
    log.warn("Failed to publish domain event after retries", {
      eventType: event.event_type,
      eventId: event.event_id,
      error: err.message,
    });
    return Effect.void;
  });
};

export const publishEventDaemon = (
  event: EventEnvelope,
  baseUrl = process.env.EVENTS_SERVICE_URL ?? "http://localhost:8082"
): Effect.Effect<void, never> =>
  Effect.map(Effect.forkDaemon(publishEventEffect(event, baseUrl)), () => undefined);
