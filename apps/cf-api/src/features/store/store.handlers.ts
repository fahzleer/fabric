import { isSome } from "@fabric/types";
import type { Hono } from "hono";
import type { MerchantRepositoryPort } from "../../application/ports/merchant.repository.port";
import type { ProductRepositoryPort } from "../../application/ports/product.repository.port";

export function registerStoreRoutes(
  app: Hono,
  merchantRepo: MerchantRepositoryPort,
  productRepo: ProductRepositoryPort
): void {
  app.get("/api/stores/:slug", async (c) => {
    const slug = c.req.param("slug");
    const result = await merchantRepo.findBySlug(slug);

    if (result._tag === "Err") {
      if (result.error._tag === "MerchantNotFoundError") {
        return c.json({ error: "Store not found" }, 404);
      }
      return c.json({ error: "Failed to load store" }, 500);
    }

    const m = result.value;
    return c.json({
      slug: isSome(m.storeSlug) ? m.storeSlug.value : null,
      storeName: m.storeName,
      ownerId: m.userId,
      productCount: m.productCount,
      plan: m.plan,
    });
  });

  app.get("/api/stores/:slug/products", async (c) => {
    const slug = c.req.param("slug");
    const page = Math.max(1, Number(c.req.query("page") ?? "1"));
    const perPage = Math.min(50, Math.max(1, Number(c.req.query("perPage") ?? "20")));

    const merchantResult = await merchantRepo.findBySlug(slug);
    if (merchantResult._tag === "Err") {
      if (merchantResult.error._tag === "MerchantNotFoundError") {
        return c.json({ error: "Store not found" }, 404);
      }
      return c.json({ error: "Failed to load store" }, 500);
    }

    const ownerId = merchantResult.value.userId;

    const productsResult = await productRepo.findByOwner(ownerId, { page, perPage });
    if (productsResult._tag === "Err") {
      return c.json({ error: "Failed to load store products" }, 500);
    }

    return c.json({
      data: productsResult.value.items,
      total: productsResult.value.total,
      page: productsResult.value.page,
      perPage: productsResult.value.perPage,
    });
  });

  app.get("/api/stores/by-owner/:ownerId", async (c) => {
    const ownerId = c.req.param("ownerId");
    const result = await merchantRepo.findByUserId(ownerId);

    if (result._tag === "Err") {
      if (result.error._tag === "MerchantNotFoundError") {
        return c.json({ error: "Store not found" }, 404);
      }
      return c.json({ error: "Failed to load store" }, 500);
    }

    const m = result.value;
    return c.json({
      slug: isSome(m.storeSlug) ? m.storeSlug.value : null,
      storeName: m.storeName,
      ownerId: m.userId,
    });
  });

  app.get("/api/products/:id/store", async (c) => {
    const productId = c.req.param("id");

    const productResult = await productRepo.findById({
      __brand: "ProductId" as const,
      value: productId,
    });

    if (productResult._tag === "Err") {
      if ("_tag" in productResult.error && productResult.error._tag === "ProductNotFoundError") {
        return c.json({ error: "Product not found" }, 404);
      }
      return c.json({ error: "Failed to load product" }, 500);
    }

    const ownerId = productResult.value.ownerId;
    if (!ownerId) return c.json({ error: "Store not found" }, 404);

    const merchantResult = await merchantRepo.findByUserId(ownerId);
    if (merchantResult._tag === "Err") {
      return c.json({ error: "Store not found" }, 404);
    }

    const m = merchantResult.value;
    return c.json({
      slug: isSome(m.storeSlug) ? m.storeSlug.value : null,
      storeName: m.storeName,
      ownerId: m.userId,
    });
  });
}
