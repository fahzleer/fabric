import { Option } from "effect";
import type {
  DomainEvent,
  EventMeta,
  OrderLine,
  OrderPlacedPayload,
  ProductCreatedPayload,
  ProductUpdatedPayload,
} from "../domain/Event.ts";
import {
  type ProductDelta,
  type ProductState,
  applyDelta,
  emptyProduct,
} from "../domain/Product.ts";

export type EventOp<A> =
  | { readonly _tag: "Pure"; readonly value: A }
  | {
      readonly _tag: "Persist";
      readonly event: DomainEvent;
      readonly k: (nil: undefined) => EventOp<A>;
    }
  | {
      readonly _tag: "ReadState";
      readonly id: string;
      readonly k: (state: Option.Option<ProductState>) => EventOp<A>;
    }
  | {
      readonly _tag: "WriteState";
      readonly id: string;
      readonly state: ProductState;
      readonly k: (nil: undefined) => EventOp<A>;
    }
  | {
      readonly _tag: "Notify";
      readonly userId: string;
      readonly message: string;
      readonly k: (nil: undefined) => EventOp<A>;
    }
  | {
      readonly _tag: "Emit";
      readonly derived: DomainEvent;
      readonly k: (nil: undefined) => EventOp<A>;
    }
  | {
      readonly _tag: "IsIdempotent";
      readonly eventId: string;
      readonly k: (seen: boolean) => EventOp<A>;
    };

export const bind = <A, B>(program: EventOp<A>, f: (a: A) => EventOp<B>): EventOp<B> => {
  switch (program._tag) {
    case "Pure":
      return f(program.value);

    case "Persist":
      return { ...program, k: (_: undefined) => bind(program.k(_), f) };

    case "ReadState":
      return { ...program, k: (state: Option.Option<ProductState>) => bind(program.k(state), f) };

    case "WriteState":
      return { ...program, k: (_: undefined) => bind(program.k(_), f) };

    case "Notify":
      return { ...program, k: (_: undefined) => bind(program.k(_), f) };

    case "Emit":
      return { ...program, k: (_: undefined) => bind(program.k(_), f) };

    case "IsIdempotent":
      return { ...program, k: (seen: boolean) => bind(program.k(seen), f) };
  }
};

export const persist = (event: DomainEvent): EventOp<void> => ({
  _tag: "Persist",
  event,
  k: () => ({ _tag: "Pure", value: undefined }),
});

export const readState = (id: string): EventOp<Option.Option<ProductState>> => ({
  _tag: "ReadState",
  id,
  k: (state) => ({ _tag: "Pure", value: state }),
});

export const writeState = (id: string, state: ProductState): EventOp<void> => ({
  _tag: "WriteState",
  id,
  state,
  k: () => ({ _tag: "Pure", value: undefined }),
});

export const notify = (userId: string, message: string): EventOp<void> => ({
  _tag: "Notify",
  userId,
  message,
  k: () => ({ _tag: "Pure", value: undefined }),
});

export const emit = (derived: DomainEvent): EventOp<void> => ({
  _tag: "Emit",
  derived,
  k: () => ({ _tag: "Pure", value: undefined }),
});

export const isIdempotent = (eventId: string): EventOp<boolean> => ({
  _tag: "IsIdempotent",
  eventId,
  k: (seen) => ({ _tag: "Pure", value: seen }),
});

export const handleProductCreated = (
  meta: EventMeta,
  payload: ProductCreatedPayload
): EventOp<void> =>
  bind(isIdempotent(meta.eventId), (alreadySeen) => {
    if (alreadySeen) return { _tag: "Pure", value: undefined };

    const newState: ProductState = {
      productId: payload.productId,
      ownerId: payload.ownerId,
      name: payload.name,
      tagline: payload.tagline,
      price: payload.price,
      currency: payload.currency,
      category: payload.category,
      status: payload.status,
      rev: payload.rev,
      lastEventAt: meta.occurredAt,
    };

    return bind(writeState(payload.productId, newState), () =>
      bind(persist({ _tag: "ProductCreated", meta, payload }), () =>
        notify(payload.ownerId, `Product '${payload.name}' created`)
      )
    );
  });

export const handleProductUpdated = (
  meta: EventMeta,
  payload: ProductUpdatedPayload
): EventOp<void> =>
  bind(isIdempotent(meta.eventId), (alreadySeen) => {
    if (alreadySeen) return { _tag: "Pure", value: undefined };

    return bind(readState(payload.productId), (current) => {
      const delta: ProductDelta = {
        productId: payload.productId,
        ownerId: Option.some(payload.ownerId),
        name: Option.some(payload.name),
        tagline: Option.some(payload.tagline),
        price: Option.some(payload.price),
        currency: Option.some(payload.currency),
        category: Option.some(payload.category),
        status: Option.some(payload.status),
        rev: Option.some(payload.rev),
        lastEventAt: Option.some(meta.occurredAt),
      };

      const base = Option.getOrElse(current, () => emptyProduct(payload.productId));
      const newState = applyDelta(base, delta);

      return bind(writeState(payload.productId, newState), () =>
        bind(persist({ _tag: "ProductUpdated", meta, payload }), () => {
          if (payload.status === "active") {
            return notify(payload.ownerId, `Product '${payload.name}' is now live`);
          }
          return { _tag: "Pure", value: undefined };
        })
      );
    });
  });

export const handleOrderPlaced = (meta: EventMeta, payload: OrderPlacedPayload): EventOp<void> =>
  bind(isIdempotent(meta.eventId), (alreadySeen) => {
    if (alreadySeen) return { _tag: "Pure", value: undefined };

    return bind(persist({ _tag: "OrderPlaced", meta, payload }), () =>
      notifyAllStoreOwners(payload.lines, payload.orderId)
    );
  });

const notifyAllStoreOwners = (lines: ReadonlyArray<OrderLine>, orderId: string): EventOp<void> => {
  if (lines.length === 0) return { _tag: "Pure", value: undefined };

  const [line, ...rest] = lines as [OrderLine, ...OrderLine[]];
  return bind(
    notify(line.ownerId, `New order #${orderId} — ${line.productName} ×${line.quantity}`),
    () => notifyAllStoreOwners(rest, orderId)
  );
};
