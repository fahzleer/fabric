import { Context, Effect, Layer } from "effect";
import { sql } from "kysely";
import { fromKysely } from "pg-boss";
import { Database } from "./database.ts";
import { Boss } from "../boss.ts";
import {
  type Order,
  type OrderId,
  type UserId,
  type OrderStatus,
  type OrderItem,
  type ShippingAddress,
  type PaymentMethod,
  type OrderEventType,
  OrderNotFoundError,
} from "../../domain/order.ts";

// ── Shared types ──────────────────────────────────────────────────────────────

export interface AdminStats {
  totalOrders:       number;
  totalRevenueCents: number;
  currency:          string;
  activeUsers30d:    number;
  churnRatePct:      number;
}

// ── Repository Shape ──────────────────────────────────────────────────────────

export interface OrderRepositoryShape {
  /** New order: INSERT event + INSERT projection + enqueue job — one Kysely tx. */
  readonly createOrder: (args: {
    event: { aggregateId: OrderId; type: "OrderPlaced"; payload: unknown };
    projection: {
      id: OrderId; userId: UserId; status: OrderStatus;
      totalCents: number; currency: string; paymentMethod: PaymentMethod;
      shippingAddress: ShippingAddress; items: OrderItem[]; createdAt: string;
    };
  }) => Effect.Effect<void, never>;

  /** Status transition: INSERT event + UPDATE projection + enqueue job — one Kysely tx. */
  readonly transitionOrder: (args: {
    event:        { aggregateId: OrderId; version: number; type: OrderEventType; payload?: unknown };
    statusUpdate: { id: OrderId; status: OrderStatus; updatedAt: string };
    jobName:      string;
  }) => Effect.Effect<void, never>;

  readonly findById:      (id: OrderId)    => Effect.Effect<Order, OrderNotFoundError>;
  readonly findByUserId:  (userId: UserId) => Effect.Effect<Order[], never>;
  readonly findAll:       (limit?: number) => Effect.Effect<Order[], never>;
  readonly nextVersion:   (aggregateId: OrderId) => Effect.Effect<number, never>;
  readonly getAdminStats: () => Effect.Effect<AdminStats, never>;
}

// ── Repository Tag ────────────────────────────────────────────────────────────

export class OrderRepository extends Context.Tag(
  "@fabric/order/OrderRepository"
)<OrderRepository, OrderRepositoryShape>() {
  static readonly Default: Layer.Layer<OrderRepository, never, Database | Boss> =
    Layer.effect(
      OrderRepository,
      Effect.gen(function* () {
        const db   = yield* Database;  // Kysely<FabricOrdersDatabase>
        const boss = yield* Boss;

        // ── helpers ───────────────────────────────────────────────────────────

        const rowToOrder = (row: {
          id: string; user_id: string; status: string; total_cents: number;
          currency: string; payment_method: string; shipping: unknown;
          items: unknown; created_at: Date | string; updated_at: Date | string;
        }): Order => ({
          id:              row.id            as OrderId,
          userId:          row.user_id       as UserId,
          status:          row.status        as OrderStatus,
          totalCents:      row.total_cents,
          currency:        row.currency,
          paymentMethod:   row.payment_method as PaymentMethod,
          shippingAddress: row.shipping       as ShippingAddress,
          items:           row.items          as OrderItem[],
          createdAt:       new Date(row.created_at as string).toISOString(),
          updatedAt:       new Date(row.updated_at as string).toISOString(),
        });

        // ── implementation ────────────────────────────────────────────────────

        return {
          createOrder: ({ event, projection }) =>
            Effect.tryPromise({
              try: () =>
                db.transaction().execute(async (tx) => {
                  await tx.insertInto("domain_events").values({
                    id:             crypto.randomUUID(),
                    aggregate_id:   event.aggregateId,
                    aggregate_type: "Order",
                    version:        1,
                    type:           event.type,
                    payload:        JSON.stringify(event.payload ?? {}),
                    created_at:     new Date(),
                  }).execute();

                  await tx.insertInto("orders_projection").values({
                    id:             projection.id,
                    user_id:        projection.userId,
                    status:         projection.status,
                    total_cents:    projection.totalCents,
                    currency:       projection.currency,
                    payment_method: projection.paymentMethod,
                    shipping:       JSON.stringify(projection.shippingAddress),
                    items:          JSON.stringify(projection.items),
                    created_at:     new Date(projection.createdAt),
                    updated_at:     new Date(projection.createdAt),
                  }).execute();

                  await boss.send(
                    "order.placed",
                    {
                      orderId:    projection.id,
                      userId:     projection.userId,
                      totalCents: projection.totalCents,
                      currency:   projection.currency,
                    },
                    { db: fromKysely(tx) }
                  );
                }),
              catch: (e) => {
                console.error("[OrderRepository] createOrder failed:", e);
                return e as never;
              },
            }).pipe(Effect.catchAll(() => Effect.void)),

          transitionOrder: ({ event, statusUpdate, jobName }) =>
            Effect.tryPromise({
              try: () =>
                db.transaction().execute(async (tx) => {
                  await tx.insertInto("domain_events").values({
                    id:             crypto.randomUUID(),
                    aggregate_id:   event.aggregateId,
                    aggregate_type: "Order",
                    version:        event.version,
                    type:           event.type,
                    payload:        JSON.stringify(event.payload ?? {}),
                    created_at:     new Date(),
                  }).execute();

                  await tx
                    .updateTable("orders_projection")
                    .set({
                      status:     statusUpdate.status,
                      updated_at: new Date(statusUpdate.updatedAt),
                    })
                    .where("id", "=", statusUpdate.id)
                    .execute();

                  await boss.send(
                    jobName,
                    { orderId: statusUpdate.id, status: statusUpdate.status },
                    { db: fromKysely(tx) }
                  );
                }),
              catch: (e) => {
                console.error("[OrderRepository] transitionOrder failed:", e);
                return e as never;
              },
            }).pipe(Effect.catchAll(() => Effect.void)),

          findById: (id) =>
            Effect.tryPromise({
              try: () =>
                db
                  .selectFrom("orders_projection")
                  .selectAll()
                  .where("id", "=", id)
                  .limit(1)
                  .execute(),
              catch: () => new OrderNotFoundError({ orderId: id }),
            }).pipe(
              Effect.flatMap((rows) =>
                rows[0]
                  ? Effect.succeed(rowToOrder(rows[0]))
                  : Effect.fail(new OrderNotFoundError({ orderId: id }))
              )
            ),

          findByUserId: (userId) =>
            Effect.tryPromise({
              try: () =>
                db
                  .selectFrom("orders_projection")
                  .selectAll()
                  .where("user_id", "=", userId)
                  .orderBy("created_at", "desc")
                  .execute(),
              catch: (e) => {
                console.error("[OrderRepository] findByUserId failed:", e);
                return [] as never;
              },
            }).pipe(
              Effect.map((rows) => rows.map(rowToOrder)),
              Effect.catchAll(() => Effect.succeed([] as Order[]))
            ),

          findAll: (limit = 100) =>
            Effect.tryPromise({
              try: () =>
                db
                  .selectFrom("orders_projection")
                  .selectAll()
                  .orderBy("created_at", "desc")
                  .limit(limit)
                  .execute(),
              catch: (e) => {
                console.error("[OrderRepository] findAll failed:", e);
                return [] as never;
              },
            }).pipe(
              Effect.map((rows) => rows.map(rowToOrder)),
              Effect.catchAll(() => Effect.succeed([] as Order[]))
            ),

          nextVersion: (aggregateId) =>
            Effect.tryPromise({
              try: async () => {
                const result = await db
                  .selectFrom("domain_events")
                  .select((eb) => eb.fn.max("version").as("max_version"))
                  .where("aggregate_id", "=", aggregateId)
                  .executeTakeFirst();
                return (result?.max_version ?? 0) + 1;
              },
              catch: () => 2 as never,
            }).pipe(Effect.catchAll(() => Effect.succeed(2))),

          getAdminStats: () =>
            Effect.tryPromise({
              try: () =>
                db
                  .selectFrom("order_analytics_snapshot")
                  .selectAll()
                  .limit(1)
                  .execute(),
              catch: (e) => {
                console.error("[OrderRepository] getAdminStats failed:", e);
                return e as never;
              },
            }).pipe(
              Effect.map((rows) => {
                const row = rows[0];
                if (!row) return { totalOrders: 0, totalRevenueCents: 0, currency: "THB", activeUsers30d: 0, churnRatePct: 0 } satisfies AdminStats;
                return {
                  totalOrders:       Number(row.total_orders),
                  totalRevenueCents: Number(row.revenue_cents),
                  currency:          row.currency,
                  activeUsers30d:    Number(row.active_users_30d),
                  churnRatePct:      Number(row.churn_rate_pct),
                } satisfies AdminStats;
              }),
              Effect.catchAll(() =>
                Effect.succeed<AdminStats>({
                  totalOrders: 0, totalRevenueCents: 0, currency: "THB",
                  activeUsers30d: 0, churnRatePct: 0,
                })
              )
            ),
        } satisfies OrderRepositoryShape;
      })
    );
}
