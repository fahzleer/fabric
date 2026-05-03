import { Effect, type Layer } from "effect";
import Elysia, { t } from "elysia";
import { bootRuntime } from "@fabric/effect-http";
import { requireAuth, requireRole } from "@fabric/auth";
import { type ProductId } from "../domain/product.ts";
import { InventoryService } from "../application/inventory.service.ts";

// ── Schema ────────────────────────────────────────────────────────────────────

const ProductIdParam = t.Object({ id: t.String() });

const ReserveBody = t.Object({
  sku: t.String(),
  qty: t.Number({ minimum: 1 }),
});

const RestockBody = t.Object({
  sku: t.String(),
  qty: t.Number({ minimum: 1 }),
});

// ── Internal secret guard ─────────────────────────────────────────────────────

const INTERNAL_SECRET = process.env["INTERNAL_SECRET"] ?? "";

function requireInternalSecret() {
  return new Elysia({ name: "require-internal-secret-product" }).onBeforeHandle(
    { as: "scoped" },
    ({ request, status }) => {
      const secret = request.headers.get("x-internal-secret");
      if (!secret || secret !== INTERNAL_SECRET) return status(401, { error: "Unauthorized" });
    }
  );
}

// ── Route builder ─────────────────────────────────────────────────────────────

export const buildInventoryRoutes = async (layer: Layer.Layer<InventoryService>) => {
  const runtime = await bootRuntime(layer);
  const run = <A, E>(effect: Effect.Effect<A, E, InventoryService>): Promise<A> =>
    runtime.runPromise(effect);

  // POST /products/:id/reserve — called by order service (internal)
  const internalRoutes = new Elysia({ prefix: "/products" })
    .use(requireInternalSecret())

    .post(
      "/:id/reserve",
      ({ params, body, set }) =>
        run(
          Effect.gen(function* () {
            const svc = yield* InventoryService;
            yield* svc.reserveStock({
              productId: params.id as ProductId,
              sku:       body.sku,
              qty:       body.qty,
            });
            const stock = yield* svc.getStock(params.id as ProductId);
            return { ok: true, remaining: stock };
          }).pipe(
            Effect.catchTag("ProductNotFoundError", () => {
              set.status = 404;
              return Effect.succeed({ error: "ProductNotFound" });
            }),
            Effect.catchTag("InsufficientInventoryError", (e) => {
              set.status = 409;
              return Effect.succeed({
                error:     "InsufficientInventory",
                available: e.available,
                requested: e.requested,
              });
            })
          )
        ),
      { params: ProductIdParam, body: ReserveBody }
    );

  // POST /products/:id/restock — merchant action
  // GET  /products/:id/stock   — authenticated read
  const merchantRoutes = new Elysia({ prefix: "/products" })
    .use(requireRole("store_owner"))

    .post(
      "/:id/restock",
      ({ params, body, set }) =>
        run(
          Effect.gen(function* () {
            const svc = yield* InventoryService;
            yield* svc.restockSku(params.id as ProductId, body.sku, body.qty);
            const stock = yield* svc.getStock(params.id as ProductId);
            return { ok: true, stock };
          }).pipe(
            Effect.catchTag("ProductNotFoundError", () => {
              set.status = 404;
              return Effect.succeed({ error: "ProductNotFound" });
            })
          )
        ),
      { params: ProductIdParam, body: RestockBody }
    );

  const stockRoutes = new Elysia({ prefix: "/products" })
    .use(requireAuth())

    .get(
      "/:id/stock",
      ({ params, set }) =>
        run(
          Effect.gen(function* () {
            const svc = yield* InventoryService;
            const stock = yield* svc.getStock(params.id as ProductId);
            return { stock };
          }).pipe(
            Effect.catchTag("ProductNotFoundError", () => {
              set.status = 404;
              return Effect.succeed({ error: "ProductNotFound" });
            })
          )
        ),
      { params: ProductIdParam }
    );

  return new Elysia()
    .use(internalRoutes)
    .use(merchantRoutes)
    .use(stockRoutes);
};
