import { Effect, type Layer } from "effect";
import Elysia, { t } from "elysia";
import { bootRuntime } from "@fabric/effect-http";
import { requireAuth, requireRole } from "@fabric/auth";
import { type PaymentId, type OrderId } from "../domain/payment.ts";
import { PaymentService } from "../application/payment.service.ts";

const PaymentIdParam = t.Object({ id: t.String() });
const OrderIdParam   = t.Object({ orderId: t.String() });

const InitiateBody = t.Object({
  orderId:     t.String(),
  amountCents: t.Number({ minimum: 1 }),
  currency:    t.String(),
  method:      t.Union([t.Literal("card"), t.Literal("promptpay"), t.Literal("crypto")]),
});

const SucceedBody = t.Object({
  providerRef: t.String(),
});

const FailBody = t.Object({
  reason: t.String(),
});

export const buildPaymentRoutes = async (layer: Layer.Layer<PaymentService>) => {
  const runtime = await bootRuntime(layer);
  const run = <A, E>(effect: Effect.Effect<A, E, PaymentService>): Promise<A> =>
    runtime.runPromise(effect);

  // Customer-accessible routes (any authenticated user)
  const customerRoutes = new Elysia()
    .use(requireAuth())

    // POST /payments — initiate payment
    .post(
      "/",
      ({ body }) =>
        run(
          Effect.gen(function* () {
            const svc = yield* PaymentService;
            return yield* svc.initiate({
              orderId:     body.orderId as OrderId,
              amountCents: body.amountCents,
              currency:    body.currency,
              method:      body.method,
            });
          })
        ),
      { body: InitiateBody }
    )

    // GET /payments/:id
    .get(
      "/:id",
      ({ params, status }) =>
        run(
          Effect.gen(function* () {
            const svc = yield* PaymentService;
            return yield* svc.getById(params.id as PaymentId);
          }).pipe(
            Effect.catchTag("PaymentNotFoundError", () =>
              Effect.sync(() => status(404, { error: "PaymentNotFound" }))
            )
          )
        ),
      { params: PaymentIdParam }
    )

    // GET /payments/order/:orderId
    .get(
      "/order/:orderId",
      ({ params, status }) =>
        run(
          Effect.gen(function* () {
            const svc = yield* PaymentService;
            return yield* svc.getByOrder(params.orderId as OrderId);
          }).pipe(
            Effect.catchTag("PaymentNotFoundError", () =>
              Effect.sync(() => status(404, { error: "PaymentNotFound" }))
            )
          )
        ),
      { params: OrderIdParam }
    );

  // Admin-only routes (manual overrides / webhook callbacks)
  const adminRoutes = new Elysia()
    .use(requireRole("admin"))

    // PATCH /payments/:id/succeed — called by internal webhook handler
    .patch(
      "/:id/succeed",
      ({ params, body, status }) =>
        run(
          Effect.gen(function* () {
            const svc = yield* PaymentService;
            return yield* svc.succeed(params.id as PaymentId, body.providerRef);
          }).pipe(
            Effect.catchTag("PaymentNotFoundError", () =>
              Effect.sync(() => status(404, { error: "PaymentNotFound" }))
            ),
            Effect.catchTag("PaymentAlreadyProcessedError", () =>
              Effect.sync(() => status(409, { error: "PaymentAlreadyProcessed" }))
            )
          )
        ),
      { params: PaymentIdParam, body: SucceedBody }
    )

    // PATCH /payments/:id/fail
    .patch(
      "/:id/fail",
      ({ params, body, status }) =>
        run(
          Effect.gen(function* () {
            const svc = yield* PaymentService;
            return yield* svc.fail(params.id as PaymentId, body.reason);
          }).pipe(
            Effect.catchTag("PaymentNotFoundError", () =>
              Effect.sync(() => status(404, { error: "PaymentNotFound" }))
            ),
            Effect.catchTag("PaymentAlreadyProcessedError", () =>
              Effect.sync(() => status(409, { error: "PaymentAlreadyProcessed" }))
            )
          )
        ),
      { params: PaymentIdParam, body: FailBody }
    )

    // PATCH /payments/:id/refund
    .patch(
      "/:id/refund",
      ({ params, status }) =>
        run(
          Effect.gen(function* () {
            const svc = yield* PaymentService;
            return yield* svc.refund(params.id as PaymentId);
          }).pipe(
            Effect.catchTag("PaymentNotFoundError", () =>
              Effect.sync(() => status(404, { error: "PaymentNotFound" }))
            ),
            Effect.catchTag("PaymentAlreadyProcessedError", () =>
              Effect.sync(() => status(409, { error: "PaymentAlreadyProcessed" }))
            ),
            Effect.catchTag("PaymentGatewayError", (e) =>
              Effect.sync(() => status(502, { error: "GatewayError", message: e.message }))
            )
          )
        ),
      { params: PaymentIdParam }
    );

  return new Elysia({ prefix: "/payments" })
    .use(customerRoutes)
    .use(adminRoutes);
};
