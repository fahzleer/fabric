import type { ProductViewed } from "@fabric/types";
import type { Effect } from "effect";
import type { CartDomainEvent } from "../../domain/cart/types";
import type { OrderDomainEvent } from "../../domain/order/types";

export type ClientDomainEvent = ProductViewed | CartDomainEvent | OrderDomainEvent;

export interface ClientEventBusPort {
  publish(event: ClientDomainEvent): Effect.Effect<void, never>;
  
  subscribe(
    eventType: ClientDomainEvent["_type"],
    handler: (event: ClientDomainEvent) => void
  ): () => void;
}
