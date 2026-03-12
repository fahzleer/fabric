import type { ProductAgg } from "../aggregator/ProductAgg.ts";
import type { DomainEvent } from "../domain/Event.ts";
import type { Hub } from "../notification/Hub.ts";

export interface RouterConfig {
  readonly aggregator: ProductAgg;
  readonly hub: Hub;
}

interface RouterState {
  readonly config: RouterConfig;
  eventsRouted: number;
}

const dispatch = async (event: DomainEvent, config: RouterConfig): Promise<void> => {
  switch (event._tag) {
    case "ProductCreated":
    case "ProductUpdated":
    case "ProductArchived":
    case "ProductStockUpdated":
      await config.aggregator.processEvent(event);
      break;

    case "OrderPlaced":
      await config.aggregator.processEvent(event);
      break;

    case "OrderConfirmed":
      await config.aggregator.processEvent(event);
      config.hub.push(event.meta.aggregateId, "Your order has been confirmed!");
      break;

    case "OrderCancelled":
      await config.aggregator.processEvent(event);
      config.hub.push(event.meta.aggregateId, "Your order has been cancelled.");
      break;
  }
};

export interface Router {
  route(event: DomainEvent): Promise<void>;
  routeBatch(events: ReadonlyArray<DomainEvent>): Promise<void>;
  eventsRouted(): number;
}

export const createRouter = (config: RouterConfig): Router => {
  const state: RouterState = { config, eventsRouted: 0 };

  return {
    async route(event: DomainEvent): Promise<void> {
      await dispatch(event, state.config);
      state.eventsRouted++;
    },

    async routeBatch(events: ReadonlyArray<DomainEvent>): Promise<void> {
      for (const ev of events) {
        await dispatch(ev, state.config);
        state.eventsRouted++;
      }
    },

    eventsRouted(): number {
      return state.eventsRouted;
    },
  };
};
