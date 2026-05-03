import { Effect, type Layer } from "effect";
import Elysia, { t } from "elysia";
import { bootRuntime } from "@fabric/effect-http";
import { requireAuth, requireRole } from "@fabric/auth";
import type { Product } from "../domain/product.ts";
import { type ProductId, type MerchantId } from "../domain/product.ts";
import { ProductService } from "../application/product.service.ts";

// ── Response transformers ─────────────────────────────────────────────────────

function toSummary(p: Product) {
  const totalQty = Object.values(p.inventory).reduce((s, q) => s + q, 0);
  const availableSizes = Object.entries(p.inventory)
    .filter(([, qty]) => qty > 0)
    .map(([sku]) => sku);
  const primaryUrl = p.imageUrls[0] ?? null;
  return {
    id:            p.id,
    name:          p.name,
    price:         p.priceCents / 100,
    priceCurrency: p.currency,
    category:      p.category,
    status:        p.isActive ? "active" : "inactive",
    primaryImage:  primaryUrl ? { url: primaryUrl, alt: p.name, isPrimary: true } : null,
    isInStock:     totalQty > 0,
    availableSizes,
    ownerId:       p.merchantId,
    createdAt:     p.createdAt,
    updatedAt:     p.updatedAt,
  };
}

function toDetail(p: Product) {
  const images = p.imageUrls.map((url, i) => ({
    url,
    alt:       p.name,
    isPrimary: i === 0,
    order:     i,
  }));
  return {
    id:            p.id,
    name:          p.name,
    description:   p.description,
    price:         p.priceCents / 100,
    priceCurrency: p.currency,
    category:      p.category,
    status:        p.isActive ? "active" : "inactive",
    stock:         p.inventory,
    images,
    ownerId:       p.merchantId,
    createdAt:     p.createdAt,
    updatedAt:     p.updatedAt,
  };
}

// ── Schema ────────────────────────────────────────────────────────────────────

const ProductIdParam   = t.Object({ id: t.String() });
const MerchantIdParam  = t.Object({ merchantId: t.String() });

const CreateBody = t.Object({
  merchantId:  t.String(),
  name:        t.String({ minLength: 1 }),
  description: t.String(),
  priceCents:  t.Number({ minimum: 0 }),
  currency:    t.Optional(t.String()),
  category:    t.String(),
  tags:        t.Optional(t.Array(t.String())),
  inventory:   t.Record(t.String(), t.Number()),
  imageUrls:   t.Optional(t.Array(t.String())),
});

// merchant-api.ts uses price (display) not priceCents — support both
const MerchantCreateBody = t.Object({
  merchantId:    t.Optional(t.String()),
  name:          t.String({ minLength: 1 }),
  description:   t.Optional(t.String()),
  price:         t.Optional(t.Number({ minimum: 0 })),
  priceCents:    t.Optional(t.Number({ minimum: 0 })),
  priceCurrency: t.Optional(t.String()),
  currency:      t.Optional(t.String()),
  category:      t.String(),
  stock:         t.Optional(t.Record(t.String(), t.Number())),
  inventory:     t.Optional(t.Record(t.String(), t.Number())),
  images:        t.Optional(t.Array(t.Object({
    url:       t.String(),
    alt:       t.Optional(t.String()),
    isPrimary: t.Optional(t.Boolean()),
    order:     t.Optional(t.Number()),
  }))),
  imageUrls:     t.Optional(t.Array(t.String())),
  tags:          t.Optional(t.Array(t.String())),
});

const UpdateBody = t.Object({
  name:        t.Optional(t.String()),
  description: t.Optional(t.String()),
  priceCents:  t.Optional(t.Number({ minimum: 0 })),
  price:       t.Optional(t.Number({ minimum: 0 })),
  category:    t.Optional(t.String()),
  tags:        t.Optional(t.Array(t.String())),
  imageUrls:   t.Optional(t.Array(t.String())),
  status:      t.Optional(t.String()),
  stock:       t.Optional(t.Record(t.String(), t.Number())),
  images:      t.Optional(t.Array(t.Object({
    url:       t.String(),
    alt:       t.Optional(t.String()),
    isPrimary: t.Optional(t.Boolean()),
    order:     t.Optional(t.Number()),
  }))),
});

// ── Route builder ─────────────────────────────────────────────────────────────

export const buildProductRoutes = async (layer: Layer.Layer<ProductService>) => {
  const runtime = await bootRuntime(layer);
  const run = <A, E>(effect: Effect.Effect<A, E, ProductService>): Promise<A> =>
    runtime.runPromise(effect);

  // ── Public read routes ───────────────────────────────────────────────────

  const publicRoutes = new Elysia({ prefix: "/products" })

    .get(
      "/",
      ({ query }) =>
        run(
          Effect.gen(function* () {
            const svc = yield* ProductService;
            const page    = Number(query["page"]    ?? 1);
            const perPage = Number(query["perPage"] ?? 20);
            const products = yield* svc.list({
              category: query["category"],
              search:   query["search"],
              limit:    perPage,
              offset:   (page - 1) * perPage,
            });
            const items = products.map(toSummary);
            return { items, total: items.length, page, perPage };
          })
        )
    )

    .get(
      "/:id",
      ({ params, set }) =>
        run(
          Effect.gen(function* () {
            const svc = yield* ProductService;
            const product = yield* svc.getById(params.id as ProductId);
            return toDetail(product);
          }).pipe(
            Effect.catchTag("ProductNotFoundError", () => {
              set.status = 404;
              return Effect.succeed({ error: "ProductNotFound" });
            })
          )
        ),
      { params: ProductIdParam }
    );

  // ── Authenticated merchant routes (store_owner or admin) ────────────────

  const merchantRoutes = new Elysia({ prefix: "/products" })
    .use(requireRole("store_owner"))

    .post(
      "/",
      ({ body, set, userId }) =>
        run(
          Effect.gen(function* () {
            const svc = yield* ProductService;
            const merchantId = (body.merchantId ?? userId) as MerchantId;

            const priceCents =
              (body as { priceCents?: number }).priceCents
              ?? Math.round(((body as { price?: number }).price ?? 0) * 100);

            const imageUrls: string[] =
              (body as { imageUrls?: string[] }).imageUrls
              ?? ((body as { images?: { url: string }[] }).images ?? []).map((img) => img.url);

            const inventory: Record<string, number> =
              (body as { inventory?: Record<string, number> }).inventory
              ?? (body as { stock?: Record<string, number> }).stock
              ?? {};

            const product = yield* svc.create({
              merchantId,
              name:        body.name,
              description: (body as { description?: string }).description ?? "",
              priceCents,
              currency:    (body as { priceCurrency?: string; currency?: string }).priceCurrency
                        ?? (body as { currency?: string }).currency,
              category:    body.category,
              tags:        (body as { tags?: string[] }).tags,
              inventory,
              imageUrls,
            });
            return toDetail(product);
          }).pipe(
            Effect.catchTag("InvalidProductError", (e) => {
              set.status = 400;
              return Effect.succeed({ error: "InvalidProduct", reason: e.reason });
            })
          )
        ),
      { body: MerchantCreateBody }
    )

    .get(
      "/merchant/:merchantId",
      ({ params, userId, role }) =>
        run(
          Effect.gen(function* () {
            const svc = yield* ProductService;
            // merchants can only view their own products unless admin
            const targetId = role === "admin" ? params.merchantId : userId;
            const products = yield* svc.listByMerchant(targetId as MerchantId);
            return { items: products.map(toSummary), total: products.length };
          })
        ),
      { params: MerchantIdParam }
    )

    .put(
      "/:id",
      ({ params, body, set }) =>
        run(
          Effect.gen(function* () {
            const svc = yield* ProductService;
            const priceCents = (body as { priceCents?: number }).priceCents
              ?? ((body as { price?: number }).price !== undefined
                  ? Math.round(((body as { price?: number }).price ?? 0) * 100)
                  : undefined);
            const product = yield* svc.update(params.id as ProductId, {
              name:        (body as { name?: string }).name,
              description: (body as { description?: string }).description,
              priceCents,
              category:    (body as { category?: string }).category,
              tags:        (body as { tags?: string[] }).tags,
              imageUrls:   (body as { imageUrls?: string[]; images?: { url: string }[] }).imageUrls
                        ?? ((body as { images?: { url: string }[] }).images ?? []).map((i) => i.url),
            });
            return toDetail(product);
          }).pipe(
            Effect.catchTag("ProductNotFoundError", () => {
              set.status = 404;
              return Effect.succeed({ error: "ProductNotFound" });
            })
          )
        ),
      { params: ProductIdParam, body: UpdateBody }
    )

    .patch(
      "/:id",
      ({ params, body, set }) =>
        run(
          Effect.gen(function* () {
            const svc = yield* ProductService;
            const priceCents = (body as { priceCents?: number }).priceCents
              ?? ((body as { price?: number }).price !== undefined
                  ? Math.round(((body as { price?: number }).price ?? 0) * 100)
                  : undefined);
            const product = yield* svc.update(params.id as ProductId, {
              name:        (body as { name?: string }).name,
              description: (body as { description?: string }).description,
              priceCents,
              category:    (body as { category?: string }).category,
              tags:        (body as { tags?: string[] }).tags,
            });
            return toDetail(product);
          }).pipe(
            Effect.catchTag("ProductNotFoundError", () => {
              set.status = 404;
              return Effect.succeed({ error: "ProductNotFound" });
            })
          )
        ),
      { params: ProductIdParam, body: UpdateBody }
    )

    .delete(
      "/:id",
      ({ params, set }) =>
        run(
          Effect.gen(function* () {
            const svc = yield* ProductService;
            yield* svc.deactivate(params.id as ProductId);
            return { ok: true };
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
    .use(publicRoutes)
    .use(merchantRoutes);
};
