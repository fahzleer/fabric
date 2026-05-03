import { Context, Effect, Layer } from "effect";
import { KafkaProducer } from "@fabric/kafka";
import {
  type ProductId,
  ProductNotFoundError,
  InsufficientInventoryError,
  hasStock,
  deductInventory,
} from "../domain/product.ts";
import { ProductRepository } from "../infrastructure/db/product.repository.ts";

// ── Inventory Service ─────────────────────────────────────────────────────────
//
// Bounded context split (ADR 0016 Option A):
// Inventory operations are extracted into their own service within apps/product
// while sharing the same deployment and DB. This separates catalog concerns
// (CRUD, metadata) from stock concerns (reserve, restock, availability).

const TOPIC_INVENTORY_CHANGED = "product.inventory_changed";

export interface ReserveStockInput {
  readonly productId: ProductId;
  readonly sku:       string;
  readonly qty:       number;
}

export interface InventoryServiceShape {
  readonly reserveStock: (input: ReserveStockInput) => Effect.Effect<void, ProductNotFoundError | InsufficientInventoryError>;
  readonly restockSku:   (productId: ProductId, sku: string, qty: number) => Effect.Effect<void, ProductNotFoundError>;
  readonly getStock:     (productId: ProductId) => Effect.Effect<Record<string, number>, ProductNotFoundError>;
}

export class InventoryService extends Context.Tag(
  "@fabric/product/InventoryService"
)<InventoryService, InventoryServiceShape>() {
  static readonly Default: Layer.Layer<
    InventoryService,
    never,
    ProductRepository | KafkaProducer
  > = Layer.effect(
    InventoryService,
    Effect.gen(function* () {
      const repo     = yield* ProductRepository;
      const producer = yield* KafkaProducer;

      const publish = (payload: unknown, key: string) =>
        producer
          .publish(TOPIC_INVENTORY_CHANGED, payload, { key })
          .pipe(Effect.catchAll(() => Effect.void));

      return {
        reserveStock: (input) =>
          Effect.gen(function* () {
            const product = yield* repo.findById(input.productId);
            if (!hasStock(product, input.sku, input.qty)) {
              return yield* Effect.fail(
                new InsufficientInventoryError({
                  productId: input.productId,
                  sku:       input.sku,
                  requested: input.qty,
                  available: product.inventory[input.sku] ?? 0,
                })
              );
            }
            const updated = deductInventory(product, input.sku, input.qty);
            const saved   = yield* repo.update(updated);
            yield* publish(
              {
                productId: input.productId,
                sku:       input.sku,
                delta:     -input.qty,
                remaining: saved.inventory[input.sku] ?? 0,
                reason:    "sale",
                updatedAt: saved.updatedAt,
              },
              input.productId
            );
          }),

        restockSku: (productId, sku, qty) =>
          Effect.gen(function* () {
            const product = yield* repo.findById(productId);
            const updated = {
              ...product,
              inventory: {
                ...product.inventory,
                [sku]: (product.inventory[sku] ?? 0) + qty,
              },
              updatedAt: new Date().toISOString(),
            };
            const saved = yield* repo.update(updated);
            yield* publish(
              {
                productId,
                sku,
                delta:     qty,
                remaining: saved.inventory[sku] ?? 0,
                reason:    "restock",
                updatedAt: saved.updatedAt,
              },
              productId
            );
          }),

        getStock: (productId) =>
          Effect.gen(function* () {
            const product = yield* repo.findById(productId);
            return product.inventory;
          }),
      } satisfies InventoryServiceShape;
    })
  );
}
