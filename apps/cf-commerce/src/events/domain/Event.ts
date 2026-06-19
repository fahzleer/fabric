export interface EventMeta {
  readonly eventId: string;
  readonly aggregateId: string;
  readonly occurredAt: string;
  readonly schemaVersion: number;
}

export interface ProductCreatedPayload {
  readonly productId: string;
  readonly ownerId: string;
  readonly name: string;
  readonly tagline: string;
  readonly price: number;
  readonly currency: string;
  readonly category: string;
  readonly status: string;
  readonly rev: number;
}

export interface ProductUpdatedPayload {
  readonly productId: string;
  readonly ownerId: string;
  readonly name: string;
  readonly tagline: string;
  readonly price: number;
  readonly currency: string;
  readonly category: string;
  readonly status: string;
  readonly rev: number;
}

export interface ProductArchivedPayload {
  readonly productId: string;
  readonly ownerId: string;
  readonly rev: number;
}

export interface StockUpdatedPayload {
  readonly productId: string;
  readonly ownerId: string;
  readonly size: string;
  readonly newQuantity: number;
  readonly previousQuantity: number;
}

export interface OrderLine {
  readonly productId: string;
  readonly ownerId: string;
  readonly productName: string;
  readonly quantity: number;
  readonly unitPriceCents: number;
}

export interface OrderPlacedPayload {
  readonly orderId: string;
  readonly customerId: string;
  readonly lines: ReadonlyArray<OrderLine>;
  readonly totalInCents: number;
  readonly currency: string;
}

export interface OrderConfirmedPayload {
  readonly orderId: string;
  readonly paymentId: string;
}

export interface OrderCancelledPayload {
  readonly orderId: string;
  readonly reason: string;
}

export type DomainEvent =
  | {
      readonly _tag: "ProductCreated";
      readonly meta: EventMeta;
      readonly payload: ProductCreatedPayload;
    }
  | {
      readonly _tag: "ProductUpdated";
      readonly meta: EventMeta;
      readonly payload: ProductUpdatedPayload;
    }
  | {
      readonly _tag: "ProductArchived";
      readonly meta: EventMeta;
      readonly payload: ProductArchivedPayload;
    }
  | {
      readonly _tag: "ProductStockUpdated";
      readonly meta: EventMeta;
      readonly payload: StockUpdatedPayload;
    }
  | { readonly _tag: "OrderPlaced"; readonly meta: EventMeta; readonly payload: OrderPlacedPayload }
  | {
      readonly _tag: "OrderConfirmed";
      readonly meta: EventMeta;
      readonly payload: OrderConfirmedPayload;
    }
  | {
      readonly _tag: "OrderCancelled";
      readonly meta: EventMeta;
      readonly payload: OrderCancelledPayload;
    };

export const aggregateId = (event: DomainEvent): string => event.meta.aggregateId;

export const eventId = (event: DomainEvent): string => event.meta.eventId;

export const eventType = (event: DomainEvent): string => event._tag;

export const metaOf = (event: DomainEvent): EventMeta => event.meta;

export const toJson = (event: DomainEvent): string => {
  const meta = metaOf(event);
  const base = {
    event_id: meta.eventId,
    event_type: eventType(event),
    aggregate_id: meta.aggregateId,
    occurred_at: meta.occurredAt,
    schema_version: meta.schemaVersion,
  };

  let payloadFields: Record<string, unknown>;

  switch (event._tag) {
    case "ProductCreated":
    case "ProductUpdated": {
      const p = event.payload;
      payloadFields = {
        product_id: p.productId,
        owner_id: p.ownerId,
        name: p.name,
        tagline: p.tagline,
        price: p.price,
        currency: p.currency,
        category: p.category,
        status: p.status,
        rev: p.rev,
      };
      break;
    }
    case "ProductArchived": {
      const p = event.payload;
      payloadFields = { product_id: p.productId, owner_id: p.ownerId, rev: p.rev };
      break;
    }
    case "ProductStockUpdated": {
      const p = event.payload;
      payloadFields = {
        product_id: p.productId,
        owner_id: p.ownerId,
        size: p.size,
        new_quantity: p.newQuantity,
        previous_quantity: p.previousQuantity,
      };
      break;
    }
    case "OrderPlaced": {
      const p = event.payload;
      payloadFields = {
        order_id: p.orderId,
        customer_id: p.customerId,
        total_in_cents: p.totalInCents,
        currency: p.currency,
        lines: p.lines.map((l) => ({
          product_id: l.productId,
          owner_id: l.ownerId,
          product_name: l.productName,
          quantity: l.quantity,
          unit_price_cents: l.unitPriceCents,
        })),
      };
      break;
    }
    case "OrderConfirmed": {
      const p = event.payload;
      payloadFields = { order_id: p.orderId, payment_id: p.paymentId };
      break;
    }
    case "OrderCancelled": {
      const p = event.payload;
      payloadFields = { order_id: p.orderId, reason: p.reason };
      break;
    }
  }

  return JSON.stringify({ ...base, ...payloadFields });
};

export const fromJson = (
  raw: string
): { ok: true; value: DomainEvent } | { ok: false; error: string } => {
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    const meta: EventMeta = {
      eventId: obj.event_id as string,
      aggregateId: obj.aggregate_id as string,
      occurredAt: obj.occurred_at as string,
      schemaVersion: obj.schema_version as number,
    };

    switch (obj.event_type as string) {
      case "ProductCreated":
        return {
          ok: true,
          value: {
            _tag: "ProductCreated",
            meta,
            payload: {
              productId: obj.product_id as string,
              ownerId: obj.owner_id as string,
              name: obj.name as string,
              tagline: (obj.tagline as string) ?? "",
              price: obj.price as number,
              currency: obj.currency as string,
              category: obj.category as string,
              status: obj.status as string,
              rev: obj.rev as number,
            },
          },
        };
      case "ProductUpdated":
        return {
          ok: true,
          value: {
            _tag: "ProductUpdated",
            meta,
            payload: {
              productId: obj.product_id as string,
              ownerId: obj.owner_id as string,
              name: obj.name as string,
              tagline: (obj.tagline as string) ?? "",
              price: obj.price as number,
              currency: obj.currency as string,
              category: obj.category as string,
              status: obj.status as string,
              rev: obj.rev as number,
            },
          },
        };
      case "ProductArchived":
        return {
          ok: true,
          value: {
            _tag: "ProductArchived",
            meta,
            payload: {
              productId: obj.product_id as string,
              ownerId: obj.owner_id as string,
              rev: obj.rev as number,
            },
          },
        };
      case "ProductStockUpdated":
        return {
          ok: true,
          value: {
            _tag: "ProductStockUpdated",
            meta,
            payload: {
              productId: obj.product_id as string,
              ownerId: obj.owner_id as string,
              size: obj.size as string,
              newQuantity: obj.new_quantity as number,
              previousQuantity: obj.previous_quantity as number,
            },
          },
        };
      case "OrderPlaced": {
        const rawLines = obj.lines as Array<Record<string, unknown>>;
        return {
          ok: true,
          value: {
            _tag: "OrderPlaced",
            meta,
            payload: {
              orderId: obj.order_id as string,
              customerId: obj.customer_id as string,
              totalInCents: obj.total_in_cents as number,
              currency: obj.currency as string,
              lines: rawLines.map((l) => ({
                productId: l.product_id as string,
                ownerId: l.owner_id as string,
                productName: l.product_name as string,
                quantity: l.quantity as number,
                unitPriceCents: l.unit_price_cents as number,
              })),
            },
          },
        };
      }
      case "OrderConfirmed":
        return {
          ok: true,
          value: {
            _tag: "OrderConfirmed",
            meta,
            payload: {
              orderId: obj.order_id as string,
              paymentId: obj.payment_id as string,
            },
          },
        };
      case "OrderCancelled":
        return {
          ok: true,
          value: {
            _tag: "OrderCancelled",
            meta,
            payload: {
              orderId: obj.order_id as string,
              reason: obj.reason as string,
            },
          },
        };
      default:
        return { ok: false, error: `Unknown event type: ${obj.event_type}` };
    }
  } catch (e) {
    return { ok: false, error: `Failed to decode event envelope: ${String(e)}` };
  }
};
