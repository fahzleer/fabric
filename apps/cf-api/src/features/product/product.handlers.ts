import type { ProductSortField } from "@fabric/contract";
import { VALID_SORT_FIELDS } from "@fabric/contract";
import { type } from "arktype";
import type { Context, Hono } from "hono";
import type { MerchantRepositoryPort } from "../../application/ports/merchant.repository.port";
import { canAddProduct, isSubscriptionActive } from "../../domain/billing/billing.value-objects";
import type { Product } from "../../domain/product/product.entity";
import type { ProductSummary } from "../../domain/product/product.entity";
import { makeProductId } from "../../domain/product/product.value-objects";
import type { PasetoVerifierService } from "../../infrastructure/auth/paseto-verifier.service";
import { requireAuth, requireRole } from "../../infrastructure/guards/auth.middleware";
import type { ProductService } from "./product.service";

function productToJson(p: Product) {
  return {
    id: p.id.value,
    name: p.name.value,
    description: p.description,
    price: p.price.amount,
    priceCurrency: p.price.currency,
    category: p.category,
    status: p.status,
    stock: Object.fromEntries(Object.entries(p.stock).map(([size, qty]) => [size, qty.value])),
    images: p.images.map((img) => ({
      url: img.url,
      alt: img.altText,
      isPrimary: img.isPrimary,
      order: img.order,
    })),
    ownerId: p.ownerId,
    createdAt: p.createdAt.toString(),
    updatedAt: p.updatedAt.toString(),
  };
}

function productSummaryToJson(s: ProductSummary) {
  return {
    id: s.id.value,
    name: s.name.value,
    price: s.price.amount,
    priceCurrency: s.price.currency,
    category: s.category,
    status: s.status,
    isInStock: s.isInStock,
    availableSizes: s.availableSizes,
    ownerId: s.ownerId,
    primaryImage: s.primaryImage
      ? {
          url: s.primaryImage.url,
          alt: s.primaryImage.altText,
          isPrimary: s.primaryImage.isPrimary,
        }
      : null,
  };
}

const ImageSchema = type({
  url: "string >= 1",
  alt: "string >= 1",
  isPrimary: "boolean",
  order: "number",
});

const CreateProductBody = type({
  name: "string >= 1",
  "description?": "string",
  price: "number > 0",
  "priceCurrency?": "string == 3",
  category: '"basic" | "premium" | "limited_edition" | "custom"',
  stock: "Record<string, number>",
  images: ImageSchema.array(),
});

const UpdateProductBody = type({
  "name?": "string >= 1",
  "description?": "string",
  "price?": "number > 0",
  "priceCurrency?": "string == 3",
  "category?": '"basic" | "premium" | "limited_edition" | "custom"',
  "status?": '"draft" | "active" | "archived"',
  "stock?": "Record<string, number>",
  "images?": ImageSchema.array(),
});

function parseListQueryParams(c: Context) {
  const page = Math.max(1, Number(c.req.query("page") ?? "1"));
  const perPage = Math.min(100, Math.max(1, Number(c.req.query("perPage") ?? "20")));
  const category = c.req.query("category")?.trim() || undefined;
  const minPrice = c.req.query("minPrice")
    ? Math.max(0, Number(c.req.query("minPrice")))
    : undefined;
  const maxPrice = c.req.query("maxPrice")
    ? Math.max(0, Number(c.req.query("maxPrice")))
    : undefined;
  const sortRaw = c.req.query("sort");
  const sort =
    sortRaw !== undefined && VALID_SORT_FIELDS.has(sortRaw as ProductSortField)
      ? (sortRaw as ProductSortField)
      : undefined;
  return { page, perPage, category, minPrice, maxPrice, sort };
}

async function checkStoreOwnerPlanLimit(
  merchantRepo: MerchantRepositoryPort,
  userId: string,
  c: Context
): Promise<Response | null> {
  const merchantResult = await merchantRepo.findByUserId(userId);
  if (merchantResult._tag === "Err") {
    return c.json(
      {
        error: "Merchant profile not found. Please complete store registration.",
        _tag: "MerchantNotFound",
        onboardingUrl: "/merchant/onboarding",
      },
      402
    );
  }
  const merchant = merchantResult.value;
  if (!isSubscriptionActive(merchant)) {
    return c.json(
      {
        error: "Subscription inactive",
        _tag: "SubscriptionInactive",
        planStatus: merchant.planStatus,
        billingUrl: "/merchant/billing",
      },
      402
    );
  }
  if (!canAddProduct(merchant)) {
    return c.json(
      {
        error: "Product limit reached for your plan",
        _tag: "PlanLimitExceeded",
        plan: merchant.plan,
        limit: merchant.productCount,
        upgradeUrl: "/merchant/billing/upgrade",
      },
      402
    );
  }
  return null;
}

function buildUpdatePayload(validated: typeof UpdateProductBody.infer) {
  return {
    ...(validated.name ? { name: validated.name } : {}),
    ...(validated.description !== undefined ? { description: validated.description } : {}),
    ...(validated.price !== undefined ? { price: validated.price } : {}),
    ...(validated.priceCurrency ? { priceCurrency: validated.priceCurrency } : {}),
    ...(validated.category ? { category: validated.category } : {}),
    ...(validated.status ? { status: validated.status } : {}),
    ...(validated.stock ? { stock: validated.stock as Record<string, number> } : {}),
    ...(validated.images ? { images: validated.images } : {}),
  };
}

export function registerProductRoutes(
  app: Hono,
  service: ProductService,
  verifier: PasetoVerifierService,
  merchantRepo: MerchantRepositoryPort
): void {
  app.get("/api/products", async (c) => {
    const { page, perPage, category, minPrice, maxPrice, sort } = parseListQueryParams(c);
    const result = await service.getActiveProducts(
      { page, perPage },
      {
        ...(category ? { category } : {}),
        ...(minPrice !== undefined ? { minPrice } : {}),
        ...(maxPrice !== undefined ? { maxPrice } : {}),
        ...(sort ? { sort } : {}),
      }
    );
    if ("items" in result) {
      return c.json({
        ...result,
        items: result.items.map(productSummaryToJson),
      });
    }
    return c.json(result);
  });

  app.get("/api/products/:id", async (c) => {
    const result = await service.getProduct(makeProductId(c.req.param("id")));

    if (!("status" in result)) return c.json(result, 404);

    if (result.status === "active") return c.json(productToJson(result));

    const authHeader = c.req.header("authorization");
    if (authHeader) {
      const tokenResult = await verifier.verify(authHeader.replace("Bearer ", "").trim());
      if (tokenResult._tag === "Ok") {
        const { sub: callerId, role } = tokenResult.value;
        if (role === "admin" || callerId === result.ownerId) return c.json(productToJson(result));
      }
    }
    return c.json({ error: "Product not found", _tag: "ProductNotFound" }, 404);
  });

  app.post(
    "/api/products",
    requireAuth(verifier),
    requireRole("admin", "store_owner"),
    async (c) => {
      const body = await c.req.json();
      const validated = CreateProductBody(body);
      if (validated instanceof type.errors) {
        return c.json({ error: validated.summary }, 400);
      }

      const userId = c.get("userId") as string;
      const role = c.get("userRole");

      if (role === "store_owner") {
        const limitErr = await checkStoreOwnerPlanLimit(merchantRepo, userId, c);
        if (limitErr) return limitErr;
      }

      const result = await service.createProduct({
        ownerId: userId,
        name: validated.name,
        description: validated.description ?? "",
        price: validated.price,
        priceCurrency: validated.priceCurrency ?? "THB",
        category: validated.category,
        stock: validated.stock as Record<string, number>,
        images: validated.images,
      });

      if (role === "store_owner") {
        void merchantRepo.incrementProductCount(userId);
      }

      if ("id" in result) return c.json(productToJson(result), 201);
      return c.json(result, 201);
    }
  );

  app.put(
    "/api/products/:id",
    requireAuth(verifier),
    requireRole("admin", "store_owner"),
    async (c) => {
      const body = await c.req.json();
      const validated = UpdateProductBody(body);
      if (validated instanceof type.errors) {
        return c.json({ error: validated.summary }, 400);
      }

      const userId = c.get("userId") as string;
      const role = c.get("userRole");
      const result = await service.updateProduct(
        makeProductId(c.req.param("id")),
        buildUpdatePayload(validated),
        userId,
        role
      );
      if ("id" in result) return c.json(productToJson(result));
      return c.json(result);
    }
  );

  app.delete("/api/products/:id", requireAuth(verifier), requireRole("admin"), async (c) => {
    const userId = c.get("userId") as string;
    const result = await service.deleteProduct(makeProductId(c.req.param("id")), userId);

    if ("ownerId" in result && typeof result.ownerId === "string") {
      void merchantRepo.decrementProductCount(result.ownerId);
    }

    return c.json(result);
  });
}
