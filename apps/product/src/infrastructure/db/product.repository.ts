import { Context, Effect, Layer } from "effect";
import { eq, and, ilike, type SQL } from "drizzle-orm";
import { Database } from "./database.ts";
import { products } from "./schema.ts";
import {
  type Product,
  type ProductId,
  type MerchantId,
  ProductNotFoundError,
} from "../../domain/product.ts";

export interface ListProductsFilter {
  readonly category?: string;
  readonly search?:   string;
  readonly limit?:    number;
  readonly offset?:   number;
  readonly activeOnly?: boolean;
}

export interface ProductRepositoryShape {
  readonly save:       (product: Product) => Effect.Effect<void, never>;
  readonly findById:   (id: ProductId) => Effect.Effect<Product, ProductNotFoundError>;
  readonly findByMerchant: (merchantId: MerchantId) => Effect.Effect<Product[], never>;
  readonly list:       (filter: ListProductsFilter) => Effect.Effect<Product[], never>;
  readonly update:     (product: Product) => Effect.Effect<Product, ProductNotFoundError>;
  readonly deactivate: (id: ProductId) => Effect.Effect<void, ProductNotFoundError>;
}

export class ProductRepository extends Context.Tag(
  "@fabric/product/ProductRepository"
)<ProductRepository, ProductRepositoryShape>() {
  static readonly Default: Layer.Layer<ProductRepository, never, Database> =
    Layer.effect(
      ProductRepository,
      Effect.gen(function* () {
        const db = yield* Database;

        const rowToProduct = (row: typeof products.$inferSelect): Product => ({
          id:          row.id as ProductId,
          merchantId:  row.merchantId as MerchantId,
          name:        row.name,
          description: row.description,
          priceCents:  row.priceCents,
          currency:    row.currency,
          category:    row.category,
          tags:        row.tags as string[],
          inventory:   row.inventory as Record<string, number>,
          imageUrls:   row.imageUrls as string[],
          isActive:    row.isActive,
          createdAt:   row.createdAt,
          updatedAt:   row.updatedAt,
        });

        return {
          save: (product) =>
            Effect.tryPromise({
              try: () =>
                db.insert(products).values({
                  id:          product.id,
                  merchantId:  product.merchantId,
                  name:        product.name,
                  description: product.description,
                  priceCents:  product.priceCents,
                  currency:    product.currency,
                  category:    product.category,
                  tags:        product.tags,
                  inventory:   product.inventory,
                  imageUrls:   product.imageUrls,
                  isActive:    product.isActive,
                  createdAt:   product.createdAt,
                  updatedAt:   product.updatedAt,
                }),
              catch: (e) => { console.error("[ProductRepo] save failed:", e); return undefined as never; },
            }).pipe(Effect.asVoid, Effect.catchAll(() => Effect.void)),

          findById: (id) =>
            Effect.tryPromise({
              try: () => db.select().from(products).where(eq(products.id, id)).limit(1),
              catch: () => new ProductNotFoundError({ productId: id }),
            }).pipe(
              Effect.flatMap((rows) =>
                rows[0]
                  ? Effect.succeed(rowToProduct(rows[0]))
                  : Effect.fail(new ProductNotFoundError({ productId: id }))
              )
            ),

          findByMerchant: (merchantId) =>
            Effect.tryPromise({
              try: () =>
                db.select().from(products).where(eq(products.merchantId, merchantId)),
              catch: () => [] as never,
            }).pipe(
              Effect.map((rows) => rows.map(rowToProduct)),
              Effect.catchAll(() => Effect.succeed([] as Product[]))
            ),

          list: (filter) => {
            const conditions: SQL[] = [];
            if (filter.activeOnly !== false) conditions.push(eq(products.isActive, true));
            if (filter.category) conditions.push(eq(products.category, filter.category));
            if (filter.search) conditions.push(ilike(products.name, `%${filter.search}%`));

            return Effect.tryPromise({
              try: () =>
                db
                  .select()
                  .from(products)
                  .where(conditions.length > 0 ? and(...conditions) : undefined)
                  .limit(filter.limit ?? 20)
                  .offset(filter.offset ?? 0),
              catch: () => [] as never,
            }).pipe(
              Effect.map((rows) => rows.map(rowToProduct)),
              Effect.catchAll(() => Effect.succeed([] as Product[]))
            );
          },

          update: (product) =>
            Effect.tryPromise({
              try: () =>
                db
                  .update(products)
                  .set({
                    name:        product.name,
                    description: product.description,
                    priceCents:  product.priceCents,
                    category:    product.category,
                    tags:        product.tags,
                    inventory:   product.inventory,
                    imageUrls:   product.imageUrls,
                    isActive:    product.isActive,
                    updatedAt:   product.updatedAt,
                  })
                  .where(eq(products.id, product.id))
                  .returning(),
              catch: () => new ProductNotFoundError({ productId: product.id }),
            }).pipe(
              Effect.flatMap((rows) =>
                rows[0]
                  ? Effect.succeed(rowToProduct(rows[0]))
                  : Effect.fail(new ProductNotFoundError({ productId: product.id }))
              )
            ),

          deactivate: (id) =>
            Effect.tryPromise({
              try: () =>
                db
                  .update(products)
                  .set({ isActive: false, updatedAt: new Date().toISOString() })
                  .where(eq(products.id, id))
                  .returning(),
              catch: () => new ProductNotFoundError({ productId: id }),
            }).pipe(
              Effect.flatMap((rows) =>
                rows[0]
                  ? Effect.void
                  : Effect.fail(new ProductNotFoundError({ productId: id }))
              )
            ),
        } satisfies ProductRepositoryShape;
      })
    );
}
