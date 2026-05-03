import { Effect, type Layer } from "effect";
import Elysia, { t } from "elysia";
import { bootRuntime } from "@fabric/effect-http";
import { requireAuth, requireRole } from "@fabric/auth";
import { PromotionService } from "../application/promotion.service.ts";

const CreateBody = t.Object({
  code:            t.String({ minLength: 2 }),
  description:     t.String(),
  discountType:    t.Union([t.Literal("percentage"), t.Literal("fixed_amount"), t.Literal("free_shipping")]),
  discountValue:   t.Number({ minimum: 0 }),
  minimumCents:    t.Optional(t.Number({ minimum: 0 })),
  maxUsageTotal:   t.Optional(t.Nullable(t.Number({ minimum: 1 }))),
  maxUsagePerUser: t.Optional(t.Number({ minimum: 1 })),
  startsAt:        t.Optional(t.String()),
  expiresAt:       t.Optional(t.Nullable(t.String())),
});

const ApplyBody = t.Object({
  code:       t.String(),
  orderCents: t.Number({ minimum: 1 }),
  userId:     t.String(),
});

const CodeParam = t.Object({ code: t.String() });

export const buildPromotionRoutes = async (layer: Layer.Layer<PromotionService>) => {
  const runtime = await bootRuntime(layer);
  const run = <A, E>(effect: Effect.Effect<A, E, PromotionService>): Promise<A> =>
    runtime.runPromise(effect);

  // Public read routes — no auth required
  const publicRoutes = new Elysia()

    .get(
      "/",
      () =>
        run(
          Effect.gen(function* () {
            const svc = yield* PromotionService;
            return yield* svc.listAll();
          })
        )
    )

    .get(
      "/:code",
      ({ params, status }) =>
        run(
          Effect.gen(function* () {
            const svc = yield* PromotionService;
            return yield* svc.getByCode(params.code);
          }).pipe(
            Effect.catchTag("PromotionNotFoundError", () =>
              Effect.sync(() => status(404, { error: "PromotionNotFound" }))
            )
          )
        ),
      { params: CodeParam }
    );

  // Customer route — apply a coupon (must be logged in)
  const customerRoutes = new Elysia()
    .use(requireAuth())

    // POST /promotions/apply — validate & apply a coupon code to an order
    .post(
      "/apply",
      ({ body, status }) =>
        run(
          Effect.gen(function* () {
            const svc = yield* PromotionService;
            return yield* svc.apply(body.code, body.orderCents, body.userId);
          }).pipe(
            Effect.catchTag("PromotionNotFoundError", () =>
              Effect.sync(() => status(404, { error: "PromotionNotFound" }))
            ),
            Effect.catchTag("CouponExpiredError", () =>
              Effect.sync(() => status(410, { error: "CouponExpired" }))
            ),
            Effect.catchTag("CouponExhaustedError", () =>
              Effect.sync(() => status(409, { error: "CouponExhausted" }))
            ),
            Effect.catchTag("MinimumOrderNotMetError", (e) =>
              Effect.sync(() =>
                status(422, {
                  error:        "MinimumOrderNotMet",
                  minimumCents: e.minimumCents,
                  orderCents:   e.orderCents,
                })
              )
            )
          )
        ),
      { body: ApplyBody }
    );

  // Admin-only routes — create / disable promotions
  const adminRoutes = new Elysia()
    .use(requireRole("admin"))

    .post(
      "/",
      ({ body }) =>
        run(
          Effect.gen(function* () {
            const svc = yield* PromotionService;
            return yield* svc.create(body);
          })
        ),
      { body: CreateBody }
    )

    .delete(
      "/:code",
      ({ params, status }) =>
        run(
          Effect.gen(function* () {
            const svc = yield* PromotionService;
            return yield* svc.disable(params.code);
          }).pipe(
            Effect.catchTag("PromotionNotFoundError", () =>
              Effect.sync(() => status(404, { error: "PromotionNotFound" }))
            )
          )
        ),
      { params: CodeParam }
    );

  return new Elysia({ prefix: "/promotions" })
    .use(publicRoutes)
    .use(customerRoutes)
    .use(adminRoutes);
};
