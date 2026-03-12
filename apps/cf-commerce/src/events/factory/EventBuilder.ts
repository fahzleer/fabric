import { Option } from "effect";
import type { DomainEvent, EventMeta } from "../domain/Event.ts";

export interface EventMetaTemplate {
  readonly schemaVersion: number;
  readonly occurredAt: string;
}

export const defaultTemplate = (occurredAt: string): EventMetaTemplate => ({
  schemaVersion: 1,
  occurredAt,
});

export const metaFromTemplate = (
  template: EventMetaTemplate,
  eventId: string,
  aggregateId: string
): EventMeta => ({
  eventId,
  aggregateId,
  occurredAt: template.occurredAt,
  schemaVersion: template.schemaVersion,
});

export interface ProductCreatedBuilder {
  readonly eventId: Option.Option<string>;
  readonly productId: Option.Option<string>;
  readonly ownerId: Option.Option<string>;
  readonly name: Option.Option<string>;
  readonly price: Option.Option<number>;
  readonly currency: Option.Option<string>;
  readonly category: Option.Option<string>;
  readonly status: Option.Option<string>;
  readonly rev: Option.Option<number>;
  readonly occurredAt: Option.Option<string>;
  readonly schemaVersion: Option.Option<number>;
}

export const productCreatedBuilder = (): ProductCreatedBuilder => ({
  eventId: Option.none(),
  productId: Option.none(),
  ownerId: Option.none(),
  name: Option.none(),
  price: Option.none(),
  currency: Option.none(),
  category: Option.none(),
  status: Option.none(),
  rev: Option.none(),
  occurredAt: Option.none(),
  schemaVersion: Option.none(),
});

export const withEventId = (b: ProductCreatedBuilder, v: string): ProductCreatedBuilder => ({
  ...b,
  eventId: Option.some(v),
});
export const withProductId = (b: ProductCreatedBuilder, v: string): ProductCreatedBuilder => ({
  ...b,
  productId: Option.some(v),
});
export const withOwnerId = (b: ProductCreatedBuilder, v: string): ProductCreatedBuilder => ({
  ...b,
  ownerId: Option.some(v),
});
export const withName = (b: ProductCreatedBuilder, v: string): ProductCreatedBuilder => ({
  ...b,
  name: Option.some(v),
});
export const withPrice = (b: ProductCreatedBuilder, cents: number): ProductCreatedBuilder => ({
  ...b,
  price: Option.some(cents),
});
export const withCurrency = (b: ProductCreatedBuilder, v: string): ProductCreatedBuilder => ({
  ...b,
  currency: Option.some(v),
});
export const withCategory = (b: ProductCreatedBuilder, v: string): ProductCreatedBuilder => ({
  ...b,
  category: Option.some(v),
});
export const withStatus = (b: ProductCreatedBuilder, v: string): ProductCreatedBuilder => ({
  ...b,
  status: Option.some(v),
});
export const withRev = (b: ProductCreatedBuilder, v: number): ProductCreatedBuilder => ({
  ...b,
  rev: Option.some(v),
});
export const withOccurredAt = (b: ProductCreatedBuilder, v: string): ProductCreatedBuilder => ({
  ...b,
  occurredAt: Option.some(v),
});
export const withSchemaVersion = (b: ProductCreatedBuilder, v: number): ProductCreatedBuilder => ({
  ...b,
  schemaVersion: Option.some(v),
});

export const withTemplate = (
  b: ProductCreatedBuilder,
  t: EventMetaTemplate
): ProductCreatedBuilder => ({
  ...b,
  occurredAt: Option.some(t.occurredAt),
  schemaVersion: Option.some(t.schemaVersion),
});

export const buildProductCreated = (
  b: ProductCreatedBuilder
): { ok: true; value: DomainEvent } | { ok: false; error: string } => {
  const req = <T>(
    opt: Option.Option<T>,
    field: string
  ): { ok: true; value: T } | { ok: false; error: string } =>
    Option.isSome(opt) ? { ok: true, value: opt.value } : { ok: false, error: `missing: ${field}` };

  const eid = req(b.eventId, "eventId");
  if (!eid.ok) return eid;
  const pid = req(b.productId, "productId");
  if (!pid.ok) return pid;
  const oid = req(b.ownerId, "ownerId");
  if (!oid.ok) return oid;
  const n = req(b.name, "name");
  if (!n.ok) return n;
  const p = req(b.price, "price");
  if (!p.ok) return p;
  const c = req(b.currency, "currency");
  if (!c.ok) return c;
  const cat = req(b.category, "category");
  if (!cat.ok) return cat;
  const st = req(b.status, "status");
  if (!st.ok) return st;
  const r = req(b.rev, "rev");
  if (!r.ok) return r;
  const occ = req(b.occurredAt, "occurredAt");
  if (!occ.ok) return occ;

  const sv = Option.isSome(b.schemaVersion) ? b.schemaVersion.value : 1;

  return {
    ok: true,
    value: {
      _tag: "ProductCreated",
      meta: {
        eventId: eid.value,
        aggregateId: pid.value,
        occurredAt: occ.value,
        schemaVersion: sv,
      },
      payload: {
        productId: pid.value,
        ownerId: oid.value,
        name: n.value,
        price: p.value,
        currency: c.value,
        category: cat.value,
        status: st.value,
        rev: r.value,
      },
    },
  };
};

export interface EventFactory {
  readonly productBuilder: (productId: string, ownerId: string) => ProductCreatedBuilder;
}

export const productEventFactory = (occurredAt: string): EventFactory => ({
  productBuilder: (productId: string, ownerId: string): ProductCreatedBuilder => {
    const b = productCreatedBuilder();
    return withOwnerId(
      withProductId(
        withOccurredAt(withRev(withStatus(withCurrency(b, "THB"), "draft"), 1), occurredAt),
        productId
      ),
      ownerId
    );
  },
});

export const clone = (prototype: DomainEvent, newEventId: string): DomainEvent => {
  const newMeta: EventMeta = { ...prototype.meta, eventId: newEventId };
  switch (prototype._tag) {
    case "ProductCreated":
      return { ...prototype, meta: newMeta };
    case "ProductUpdated":
      return { ...prototype, meta: newMeta };
    case "ProductArchived":
      return { ...prototype, meta: newMeta };
    case "ProductStockUpdated":
      return { ...prototype, meta: newMeta };
    case "OrderPlaced":
      return { ...prototype, meta: newMeta };
    case "OrderConfirmed":
      return { ...prototype, meta: newMeta };
    case "OrderCancelled":
      return { ...prototype, meta: newMeta };
  }
};

export const cloneWithTemplate = (
  prototype: DomainEvent,
  newEventId: string,
  template: EventMetaTemplate
): DomainEvent => {
  const newMeta: EventMeta = {
    eventId: newEventId,
    aggregateId: prototype.meta.aggregateId,
    occurredAt: template.occurredAt,
    schemaVersion: template.schemaVersion,
  };
  switch (prototype._tag) {
    case "ProductCreated":
      return { ...prototype, meta: newMeta };
    case "ProductUpdated":
      return { ...prototype, meta: newMeta };
    case "ProductArchived":
      return { ...prototype, meta: newMeta };
    case "ProductStockUpdated":
      return { ...prototype, meta: newMeta };
    case "OrderPlaced":
      return { ...prototype, meta: newMeta };
    case "OrderConfirmed":
      return { ...prototype, meta: newMeta };
    case "OrderCancelled":
      return { ...prototype, meta: newMeta };
  }
};
