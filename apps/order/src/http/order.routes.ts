import { Effect, type Layer } from "effect";
import Elysia, { t } from "elysia";
import { bootRuntime } from "@fabric/effect-http";
import { requireAuth, requireRole } from "@fabric/auth";
import { type OrderId, type UserId } from "../domain/order.ts";
import { OrderService } from "../application/order.service.ts";

// ── Request / Response schemas ─────────────────────────────────────────────────

const OrderItemSchema = t.Object({
  productId:      t.String(),
  name:           t.String(),
  size:           t.String(),
  quantity:       t.Number({ minimum: 1 }),
  unitPriceCents: t.Number({ minimum: 0 }),
});

const ShippingAddressSchema = t.Object({
  recipientName: t.String(),
  street:        t.String(),
  city:          t.String(),
  province:      t.String(),
  postalCode:    t.String(),
  country:       t.String(),
  phone:         t.String(),
});

const PlaceOrderBody = t.Object({
  userId:          t.Optional(t.String()),
  items:           t.Array(OrderItemSchema, { minItems: 1 }),
  paymentMethod:   t.Union([
    t.Literal("card"),
    t.Literal("promptpay"),
    t.Literal("crypto"),
  ]),
  shippingAddress: ShippingAddressSchema,
  currency:        t.Optional(t.String()),
});

const OrderIdParam = t.Object({ id: t.String() });
const UserIdParam  = t.Object({ userId: t.String() });

// ── Route builder ──────────────────────────────────────────────────────────────

export const buildOrderRoutes = async (layer: Layer.Layer<OrderService>) => {
  const runtime = await bootRuntime(layer);

  const run = <A, E>(
    effect: Effect.Effect<A, E, OrderService>
  ): Promise<A> => runtime.runPromise(effect);

  // ── Admin-only routes ──────────────────────────────────────────────────────

  const adminRoutes = new Elysia({ prefix: "/orders" })
    .use(requireRole("admin"))

    .get(
      "/admin/stats",
      () =>
        run(
          Effect.gen(function* () {
            const svc = yield* OrderService;
            return yield* svc.adminStats();
          })
        )
    )

    .get(
      "/admin/invoices",
      ({ query }) =>
        run(
          Effect.gen(function* () {
            const svc    = yield* OrderService;
            const limit  = Number(query["limit"] ?? 50);
            const orders = yield* svc.listAllOrders(limit);

            return orders
              .filter((o) => o.status !== "pending")
              .map((o) => {
                const createdAt = o.createdAt;
                const dueAt     = new Date(
                  new Date(createdAt).getTime() + 30 * 24 * 60 * 60 * 1000
                ).toISOString();

                const status =
                  o.status === "delivered" ? "paid"
                  : o.status === "cancelled" ? "overdue"
                  : "pending";

                return {
                  id:          o.id,
                  customerId:  o.userId,
                  amountCents: o.totalCents,
                  currency:    o.currency,
                  status,
                  createdAt,
                  dueAt,
                };
              });
          })
        )
    )

    // PATCH /orders/:id/confirm — admin / internal (e.g. payment webhook)
    .patch(
      "/:id/confirm",
      ({ params, status }) =>
        run(
          Effect.gen(function* () {
            const svc = yield* OrderService;
            return yield* svc.confirmOrder(params.id as OrderId);
          }).pipe(
            Effect.catchTag("OrderNotFoundError", () =>
              Effect.sync(() => status(404, { error: "OrderNotFound" }))
            ),
            Effect.catchTag("InvalidOrderStateError", (e) =>
              Effect.sync(() =>
                status(409, {
                  error:         "InvalidOrderState",
                  currentStatus: e.currentStatus,
                })
              )
            )
          )
        ),
      { params: OrderIdParam }
    )

    // PATCH /orders/:id/pay — called by payment service (admin-protected until
    // service-to-service auth is implemented in Phase 4)
    .patch(
      "/:id/pay",
      ({ params, status }) =>
        run(
          Effect.gen(function* () {
            const svc = yield* OrderService;
            return yield* svc.markPaid(params.id as OrderId);
          }).pipe(
            Effect.catchTag("OrderNotFoundError", () =>
              Effect.sync(() => status(404, { error: "OrderNotFound" }))
            ),
            Effect.catchTag("OrderAlreadyPaidError", () =>
              Effect.sync(() => status(409, { error: "OrderAlreadyPaid" }))
            ),
            Effect.catchTag("InvalidOrderStateError", (e) =>
              Effect.sync(() =>
                status(409, {
                  error:         "InvalidOrderState",
                  currentStatus: e.currentStatus,
                })
              )
            )
          )
        ),
      { params: OrderIdParam }
    );

  // ── Authenticated user routes ──────────────────────────────────────────────

  const userRoutes = new Elysia({ prefix: "/orders" })
    .use(requireAuth())

    // POST /orders — place a new order; userId comes from auth token
    .post(
      "/",
      ({ body, userId }) =>
        run(
          Effect.gen(function* () {
            const svc = yield* OrderService;
            return yield* svc.placeOrder({
              userId:          userId as UserId,
              items:           body.items,
              paymentMethod:   body.paymentMethod,
              shippingAddress: body.shippingAddress,
              currency:        body.currency,
            });
          })
        ),
      { body: PlaceOrderBody }
    )

    // GET /orders/user/:userId — ownership enforced: users see only their own
    .get(
      "/user/:userId",
      ({ params, userId, role, status }) => {
        if (params.userId !== userId && role !== "admin") {
          return status(403, { error: "Forbidden" });
        }
        return run(
          Effect.gen(function* () {
            const svc = yield* OrderService;
            return yield* svc.listUserOrders(params.userId as UserId);
          })
        );
      },
      { params: UserIdParam }
    )

    // GET /orders/:id
    .get(
      "/:id",
      ({ params, userId, role, status }) =>
        run(
          Effect.gen(function* () {
            const svc = yield* OrderService;
            return yield* svc.getOrder(
              params.id as OrderId,
              (role === "admin" ? undefined : userId) as UserId
            );
          }).pipe(
            Effect.catchTag("OrderNotFoundError", () =>
              Effect.sync(() => status(404, { error: "OrderNotFound" }))
            )
          )
        ),
      { params: OrderIdParam }
    )

    // PATCH /orders/:id/cancel
    .patch(
      "/:id/cancel",
      ({ params, body, userId, role, status }) =>
        run(
          Effect.gen(function* () {
            const svc = yield* OrderService;
            return yield* svc.cancelOrder(
              params.id as OrderId,
              // admin can cancel any order; users can only cancel their own
              (role === "admin" ? (body.userId ?? userId) : userId) as UserId
            );
          }).pipe(
            Effect.catchTag("OrderNotFoundError", () =>
              Effect.sync(() => status(404, { error: "OrderNotFound" }))
            ),
            Effect.catchTag("InvalidOrderStateError", (e) =>
              Effect.sync(() =>
                status(409, {
                  error:         "InvalidOrderState",
                  currentStatus: e.currentStatus,
                })
              )
            )
          )
        ),
      {
        params: OrderIdParam,
        body:   t.Object({ userId: t.Optional(t.String()) }),
      }
    );

  return new Elysia()
    .use(adminRoutes)
    .use(userRoutes);
};
