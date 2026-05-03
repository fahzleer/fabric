import { Effect, type Layer } from "effect";
import Elysia, { t } from "elysia";
import { bootRuntime } from "@fabric/effect-http";
import { requireAuth, requireRole } from "@fabric/auth";
import { type ShipmentId, type OrderId, type ShipmentStatus, type Carrier } from "../domain/shipment.ts";
import { ShippingService } from "../application/shipping.service.ts";

const ShipmentIdParam = t.Object({ id: t.String() });
const OrderIdParam    = t.Object({ orderId: t.String() });

const AddressSchema = t.Object({
  recipientName: t.String(),
  street:        t.String(),
  city:          t.String(),
  province:      t.String(),
  postalCode:    t.String(),
  country:       t.String(),
  phone:         t.String(),
});

const CreateBody = t.Object({
  orderId: t.String(),
  carrier: t.Union([
    t.Literal("thpost"), t.Literal("kerry"), t.Literal("flash"),
    t.Literal("dhl"), t.Literal("fedex"),
  ]),
  address: AddressSchema,
});

const TransitionBody = t.Object({
  status: t.Union([
    t.Literal("picked_up"), t.Literal("in_transit"),
    t.Literal("out_for_delivery"), t.Literal("delivered"), t.Literal("failed"),
  ]),
});

export const buildShippingRoutes = async (layer: Layer.Layer<ShippingService>) => {
  const runtime = await bootRuntime(layer);
  const run = <A, E>(effect: Effect.Effect<A, E, ShippingService>): Promise<A> =>
    runtime.runPromise(effect);

  // Customer read routes
  const customerRoutes = new Elysia()
    .use(requireAuth())

    .get(
      "/:id",
      ({ params, status }) =>
        run(
          Effect.gen(function* () {
            const svc = yield* ShippingService;
            return yield* svc.getById(params.id as ShipmentId);
          }).pipe(
            Effect.catchTag("ShipmentNotFoundError", () =>
              Effect.sync(() => status(404, { error: "ShipmentNotFound" }))
            )
          )
        ),
      { params: ShipmentIdParam }
    )

    .get(
      "/order/:orderId",
      ({ params, status }) =>
        run(
          Effect.gen(function* () {
            const svc = yield* ShippingService;
            return yield* svc.getByOrder(params.orderId as OrderId);
          }).pipe(
            Effect.catchTag("ShipmentNotFoundError", () =>
              Effect.sync(() => status(404, { error: "ShipmentNotFound" }))
            )
          )
        ),
      { params: OrderIdParam }
    );

  // Admin routes (create shipment, update status)
  const adminRoutes = new Elysia()
    .use(requireRole("admin"))

    .post(
      "/",
      ({ body }) =>
        run(
          Effect.gen(function* () {
            const svc = yield* ShippingService;
            return yield* svc.create({
              orderId: body.orderId as OrderId,
              carrier: body.carrier as Carrier,
              address: body.address,
            });
          })
        ),
      { body: CreateBody }
    )

    .patch(
      "/:id/status",
      ({ params, body, status }) =>
        run(
          Effect.gen(function* () {
            const svc = yield* ShippingService;
            return yield* svc.transition(params.id as ShipmentId, body.status as ShipmentStatus);
          }).pipe(
            Effect.catchTag("ShipmentNotFoundError", () =>
              Effect.sync(() => status(404, { error: "ShipmentNotFound" }))
            ),
            Effect.catchTag("InvalidShipmentStateError", (e) =>
              Effect.sync(() =>
                status(409, { error: "InvalidShipmentState", currentStatus: e.currentStatus })
              )
            )
          )
        ),
      { params: ShipmentIdParam, body: TransitionBody }
    );

  return new Elysia({ prefix: "/shipments" })
    .use(customerRoutes)
    .use(adminRoutes);
};
