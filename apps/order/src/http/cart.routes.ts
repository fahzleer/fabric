/**
 * Cart routes — persisted to PostgreSQL (cart_items table).
 *
 *   DELETE /cart           — clear cart for authenticated user
 *   GET    /cart           — get cart items
 *   POST   /cart/items     — upsert item in cart
 *   POST   /orders/preview — preview order pricing without placing (public)
 */

import Elysia, { t } from "elysia";
import type { Kysely } from "kysely";
import { requireAuth } from "@fabric/auth";
import type { FabricOrdersDatabase } from "../infrastructure/db/types.ts";

export function buildCartRoutes(db: Kysely<FabricOrdersDatabase>) {
  // POST /orders/preview — public, no auth required
  const previewRoute = new Elysia().post(
    "/orders/preview",
    ({ body }) => {
      const items    = (body as { items?: { unitPriceCents?: number; quantity?: number }[] }).items ?? [];
      const subtotal = items.reduce((sum, i) => sum + (i.unitPriceCents ?? 0) * (i.quantity ?? 1), 0);
      const shipping = 0;
      const total    = subtotal + shipping;
      return {
        subtotalCents: subtotal,
        shippingCents: shipping,
        totalCents:    total,
        currency:      (body as { currency?: string }).currency ?? "THB",
        items,
      };
    },
    {
      body: t.Object({
        items:    t.Optional(t.Array(t.Any())),
        currency: t.Optional(t.String()),
        voucher:  t.Optional(t.String()),
      }),
    }
  );

  // Cart mutations require authentication
  const cartRoutes = new Elysia()
    .use(requireAuth())

    .delete("/cart", async ({ userId }) => {
      await db.deleteFrom("cart_items").where("user_id", "=", userId).execute();
      return { ok: true };
    })

    .get("/cart", async ({ userId }) => {
      const rows = await db
        .selectFrom("cart_items")
        .select(["product_id", "size", "quantity"])
        .where("user_id", "=", userId)
        .orderBy("updated_at", "asc")
        .execute();
      return {
        items: rows.map((r) => ({
          productId: r.product_id,
          size:      r.size,
          quantity:  r.quantity,
        })),
      };
    })

    .post(
      "/cart/items",
      async ({ body, userId, set }) => {
        await db
          .insertInto("cart_items")
          .values({
            user_id:    userId,
            product_id: body.productId,
            size:       body.size,
            quantity:   body.quantity,
            updated_at: new Date(),
          })
          .onConflict((oc) =>
            oc.columns(["user_id", "product_id", "size"]).doUpdateSet({
              quantity:   body.quantity,
              updated_at: new Date(),
            })
          )
          .execute();
        set.status = 201;
        return { ok: true, item: { productId: body.productId, size: body.size, quantity: body.quantity } };
      },
      {
        body: t.Object({
          productId: t.String(),
          size:      t.String(),
          quantity:  t.Number({ minimum: 1 }),
        }),
      }
    );

  return new Elysia().use(previewRoute).use(cartRoutes);
}
