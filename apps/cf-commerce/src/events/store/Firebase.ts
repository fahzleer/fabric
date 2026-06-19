import { Option } from "effect";
import type { Database } from "firebase-admin/database";
import { type DomainEvent, eventType, metaOf, toJson } from "../domain/Event.ts";
import type { ProductState } from "../domain/Product.ts";
import type { Hub } from "../notification/Hub.ts";

export interface Ctx {
  readonly db: Database;
  readonly hub: Hub;
}

export const appendEvent = async (ctx: Ctx, event: DomainEvent): Promise<void> => {
  const meta = metaOf(event);
  const payloadJson = toJson(event);

  await ctx.db.ref(`event_log/${meta.eventId}`).transaction((current: unknown) => {
    if (current !== null) return;
    return {
      eventId: meta.eventId,
      eventType: eventType(event),
      aggregateId: meta.aggregateId,
      payload: JSON.parse(payloadJson),
      schemaVersion: meta.schemaVersion,
      occurredAt: meta.occurredAt,
      processedAt: null,
    };
  });
};

export const readProductState = async (
  ctx: Ctx,
  productId: string
): Promise<Option.Option<ProductState>> => {
  const snap = await ctx.db.ref(`products_current/${productId}`).once("value");
  if (!snap.exists()) return Option.none();

  const row = snap.val() as {
    productId: string;
    ownerId: string;
    name: string;
    tagline?: string;
    price: number;
    currency: string;
    category: string;
    status: string;
    rev: number;
    lastEventAt: string;
  };

  return Option.some({
    productId: row.productId,
    ownerId: row.ownerId,
    name: row.name,
    tagline: row.tagline ?? "",
    price: row.price,
    currency: row.currency,
    category: row.category,
    status: row.status,
    rev: row.rev,
    lastEventAt: row.lastEventAt,
  });
};

export const writeProductState = async (
  ctx: Ctx,
  _productId: string,
  state: ProductState
): Promise<void> => {
  await ctx.db.ref(`products_current/${state.productId}`).set({
    productId: state.productId,
    ownerId: state.ownerId,
    name: state.name,
    tagline: state.tagline,
    price: state.price,
    currency: state.currency,
    category: state.category,
    status: state.status,
    rev: state.rev,
    lastEventAt: state.lastEventAt,
  });
};

export const readAllProductStates = async (ctx: Ctx): Promise<ProductState[]> => {
  const snap = await ctx.db.ref("products_current").once("value");
  if (!snap.exists()) return [];

  const results: ProductState[] = [];
  snap.forEach((child) => {
    const row = child.val() as {
      productId: string;
      ownerId: string;
      name: string;
      tagline?: string;
      price: number;
      currency: string;
      category: string;
      status: string;
      rev: number;
      lastEventAt: string;
    };
    results.push({ ...row, tagline: row.tagline ?? "" });
  });

  results.sort((a, b) => b.lastEventAt.localeCompare(a.lastEventAt));
  return results;
};

export const checkAndMarkIdempotent = async (ctx: Ctx, eventId: string): Promise<boolean> => {
  let alreadySeen = false;

  await ctx.db.ref(`processed_events/${eventId}`).transaction((current: unknown) => {
    if (current !== null) {
      alreadySeen = true;
      return;
    }
    return { processedAt: new Date().toISOString() };
  });

  return alreadySeen;
};

export const sendSse = (ctx: Ctx, userId: string, message: string): void => {
  ctx.hub.push(userId, message);
};

export const publishEvent = async (ctx: Ctx, event: DomainEvent): Promise<void> => {
  await appendEvent(ctx, event);
};
