import { Option } from "effect";
import type {
  DomainEvent,
  EventMeta,
  OrderCancelledPayload,
  OrderConfirmedPayload,
  OrderPlacedPayload,
  ProductArchivedPayload,
  ProductCreatedPayload,
  ProductUpdatedPayload,
  StockUpdatedPayload,
} from "../domain/Event.ts";

export interface EventVisitor<R> {
  readonly onProductCreated: (meta: EventMeta, payload: ProductCreatedPayload) => R;
  readonly onProductUpdated: (meta: EventMeta, payload: ProductUpdatedPayload) => R;
  readonly onProductArchived: (meta: EventMeta, payload: ProductArchivedPayload) => R;
  readonly onProductStockUpdated: (meta: EventMeta, payload: StockUpdatedPayload) => R;
  readonly onOrderPlaced: (meta: EventMeta, payload: OrderPlacedPayload) => R;
  readonly onOrderConfirmed: (meta: EventMeta, payload: OrderConfirmedPayload) => R;
  readonly onOrderCancelled: (meta: EventMeta, payload: OrderCancelledPayload) => R;
}

export const visit = <R>(ev: DomainEvent, visitor: EventVisitor<R>): R => {
  switch (ev._tag) {
    case "ProductCreated":
      return visitor.onProductCreated(ev.meta, ev.payload);
    case "ProductUpdated":
      return visitor.onProductUpdated(ev.meta, ev.payload);
    case "ProductArchived":
      return visitor.onProductArchived(ev.meta, ev.payload);
    case "ProductStockUpdated":
      return visitor.onProductStockUpdated(ev.meta, ev.payload);
    case "OrderPlaced":
      return visitor.onOrderPlaced(ev.meta, ev.payload);
    case "OrderConfirmed":
      return visitor.onOrderConfirmed(ev.meta, ev.payload);
    case "OrderCancelled":
      return visitor.onOrderCancelled(ev.meta, ev.payload);
  }
};

export const visitAll = <R>(
  events: ReadonlyArray<DomainEvent>,
  visitor: EventVisitor<R>
): ReadonlyArray<R> => events.map((ev) => visit(ev, visitor));

export const auditVisitor = (): EventVisitor<string> => ({
  onProductCreated: (meta, p) =>
    `CREATED product=${p.productId} owner=${p.ownerId} rev=${p.rev} at=${meta.occurredAt}`,
  onProductUpdated: (meta, p) =>
    `UPDATED product=${p.productId} status=${p.status} rev=${p.rev} at=${meta.occurredAt}`,
  onProductArchived: (meta, p) => `ARCHIVED product=${p.productId} at=${meta.occurredAt}`,
  onProductStockUpdated: (meta, p) =>
    `STOCK product=${p.productId} size=${p.size} qty=${p.newQuantity} at=${meta.occurredAt}`,
  onOrderPlaced: (meta, p) =>
    `ORDER_PLACED order=${p.orderId} customer=${p.customerId} total=${p.totalInCents} at=${meta.occurredAt}`,
  onOrderConfirmed: (meta, p) =>
    `ORDER_CONFIRMED order=${p.orderId} payment=${p.paymentId} at=${meta.occurredAt}`,
  onOrderCancelled: (meta, p) =>
    `ORDER_CANCELLED order=${p.orderId} reason=${p.reason} at=${meta.occurredAt}`,
});

export const routingVisitor = (): EventVisitor<ReadonlyArray<string>> => ({
  onProductCreated: (_, p) => [p.ownerId],
  onProductUpdated: (_, p) => [p.ownerId],
  onProductArchived: (_, p) => [p.ownerId],
  onProductStockUpdated: (_, p) => [p.ownerId],
  onOrderPlaced: (_, p) =>
    [...new Set(p.lines.map((line) => line.ownerId))],
  onOrderConfirmed: () => [],
  onOrderCancelled: () => [],
});

export interface Cursor {
  readonly position: number;
  readonly events: ReadonlyArray<DomainEvent>;
}

export const cursorNew = (events: ReadonlyArray<DomainEvent>): Cursor => ({
  position: 0,
  events,
});

export const next = (cursor: Cursor): Option.Option<readonly [DomainEvent, Cursor]> => {
  const ev = cursor.events[cursor.position];
  if (ev === undefined) return Option.none();
  return Option.some([ev, { ...cursor, position: cursor.position + 1 }] as const);
};

export const peek = (cursor: Cursor): Option.Option<DomainEvent> => {
  const ev = cursor.events[cursor.position];
  return ev !== undefined ? Option.some(ev) : Option.none();
};

export const seek = (cursor: Cursor, position: number): Cursor => ({
  ...cursor,
  position,
});

export const drain = (cursor: Cursor): ReadonlyArray<DomainEvent> =>
  cursor.events.slice(cursor.position);

export const size = (cursor: Cursor): number => cursor.events.length;

export const remaining = (cursor: Cursor): number => cursor.events.length - cursor.position;

export type EventGroup =
  | { readonly _tag: "Single"; readonly event: DomainEvent }
  | { readonly _tag: "Batch"; readonly groups: ReadonlyArray<EventGroup> };

export const single = (event: DomainEvent): EventGroup => ({ _tag: "Single", event });
export const batch = (groups: ReadonlyArray<EventGroup>): EventGroup => ({ _tag: "Batch", groups });

export const flatten = (group: EventGroup): ReadonlyArray<DomainEvent> => {
  switch (group._tag) {
    case "Single":
      return [group.event];
    case "Batch":
      return group.groups.flatMap(flatten);
  }
};

export const count = (group: EventGroup): number => {
  switch (group._tag) {
    case "Single":
      return 1;
    case "Batch":
      return group.groups.reduce((acc, g) => acc + count(g), 0);
  }
};

export const visitGroup = <R>(group: EventGroup, visitor: EventVisitor<R>): ReadonlyArray<R> =>
  flatten(group).map((ev) => visit(ev, visitor));

export const fromList = (events: ReadonlyArray<DomainEvent>): EventGroup =>
  batch(events.map(single));
