import { Effect, Option } from "effect";
import type { DomainEvent } from "../domain/Event.ts";
import {
  type ProductDelta,
  type ProductState,
  applyDelta,
  emptyProduct,
} from "../domain/Product.ts";
import {
  handleOrderPlaced,
  handleProductCreated,
  handleProductUpdated,
  persist,
} from "../free/Dsl.ts";
import { type Ctx, run } from "../free/Interpreter.ts";

interface AggState {
  readonly products: Map<string, ProductState>;
  eventsProcessed: number;
}

const mapEventToDelta = (event: DomainEvent): ProductDelta | null => {
  switch (event._tag) {
    case "ProductCreated":
      return {
        productId: event.payload.productId,
        ownerId: Option.some(event.payload.ownerId),
        name: Option.some(event.payload.name),
        price: Option.some(event.payload.price),
        currency: Option.some(event.payload.currency),
        category: Option.some(event.payload.category),
        status: Option.some(event.payload.status),
        rev: Option.some(event.payload.rev),
        lastEventAt: Option.some(event.meta.occurredAt),
      };

    case "ProductUpdated":
      return {
        productId: event.payload.productId,
        ownerId: Option.some(event.payload.ownerId),
        name: Option.some(event.payload.name),
        price: Option.some(event.payload.price),
        currency: Option.some(event.payload.currency),
        category: Option.some(event.payload.category),
        status: Option.some(event.payload.status),
        rev: Option.some(event.payload.rev),
        lastEventAt: Option.some(event.meta.occurredAt),
      };

    case "ProductArchived":
      return {
        productId: event.payload.productId,
        ownerId: Option.none(),
        name: Option.none(),
        price: Option.none(),
        currency: Option.none(),
        category: Option.none(),
        status: Option.some("archived"),
        rev: Option.some(event.payload.rev),
        lastEventAt: Option.some(event.meta.occurredAt),
      };

    case "OrderPlaced":
    case "OrderConfirmed":
    case "OrderCancelled":
    case "ProductStockUpdated":
      return null;
  }
};

const reduceDelta = (state: ProductState, delta: ProductDelta): ProductState =>
  applyDelta(state, delta);

const eventToProgram = (ev: DomainEvent) => {
  switch (ev._tag) {
    case "ProductCreated":
      return handleProductCreated(ev.meta, ev.payload);
    case "ProductUpdated":
      return handleProductUpdated(ev.meta, ev.payload);
    case "OrderPlaced":
      return handleOrderPlaced(ev.meta, ev.payload);
    default:
      return persist(ev);
  }
};

export interface ProductAgg {
  processEvent(ev: DomainEvent): Promise<void>;
  getProduct(productId: string): Option.Option<ProductState>;
  getAllProducts(): ProductState[];
  replayEvents(events: ReadonlyArray<DomainEvent>): Promise<void>;
  restoreFromSnapshot(states: ReadonlyArray<ProductState>): void;
}

export const createProductAgg = (ctx: Ctx): ProductAgg => {
  const state: AggState = {
    products: new Map(),
    eventsProcessed: 0,
  };

  return {
    async processEvent(ev: DomainEvent): Promise<void> {
      const program = eventToProgram(ev);

      const result = await Effect.runPromise(Effect.either(run(ctx, program)));

      if (result._tag === "Right") {
        const delta = mapEventToDelta(ev);
        if (delta !== null) {
          const existing = state.products.get(delta.productId);
          const base = existing ?? emptyProduct(delta.productId);
          const newState = reduceDelta(base, delta);
          state.products.set(delta.productId, newState);
        }
        state.eventsProcessed++;
      }
    },

    getProduct(productId: string): Option.Option<ProductState> {
      const found = state.products.get(productId);
      return found !== undefined ? Option.some(found) : Option.none();
    },

    getAllProducts(): ProductState[] {
      return Array.from(state.products.values());
    },

    async replayEvents(events: ReadonlyArray<DomainEvent>): Promise<void> {
      for (const ev of events) {
        await this.processEvent(ev);
      }
    },

    restoreFromSnapshot(states: ReadonlyArray<ProductState>): void {
      state.products.clear();
      for (const s of states) {
        state.products.set(s.productId, s);
      }
    },
  };
};
