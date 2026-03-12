import type { DomainEvent, EventBusPort, EventHandler } from "./events";

export class InMemoryEventBus implements EventBusPort {
  private readonly handlers = new Map<string, EventHandler<unknown>[]>();

  subscribe<TType extends string, TPayload>(
    eventType: TType,
    handler: EventHandler<TPayload>
  ): void {
    const existing = this.handlers.get(eventType) ?? [];
    this.handlers.set(eventType, [...existing, handler as EventHandler<unknown>]);
  }

  async publish<TType extends string, TPayload>(
    event: DomainEvent<TType, TPayload>
  ): Promise<void> {
    const handlers = this.handlers.get(event._type) ?? [];
    const results = await Promise.allSettled(
      handlers.map((handler) => handler(event.payload as unknown))
    );

    const failures = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");

    if (failures.length > 0) {
      throw failures[0]?.reason;
    }
  }
}
