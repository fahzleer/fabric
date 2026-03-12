export const EVENT_PUBLISHER = Symbol("EVENT_PUBLISHER");

export type EventEnvelope = {
  readonly event_id: string;
  readonly event_type: string;
  readonly aggregate_id: string;
  readonly occurred_at: string;
  readonly schema_version: number;
  readonly payload: Record<string, unknown>;
};

export interface EventPublisherPort {
  publish(envelope: EventEnvelope): Promise<void>;
}
