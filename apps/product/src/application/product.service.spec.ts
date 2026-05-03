import { describe, it, expect } from "bun:test";
import { Effect, Layer } from "effect";
import { ProductService } from "./product.service.ts";
import { ProductRepository, type ProductRepositoryShape, type ListProductsFilter } from "../infrastructure/db/product.repository.ts";
import { KafkaProducer, type KafkaProducerShape } from "@fabric/kafka";
import {
  type Product,
  type ProductId,
  type MerchantId,
  ProductNotFoundError,
} from "../domain/product.ts";

// ── Test doubles ──────────────────────────────────────────────────────────────

const makeInMemoryRepo = (): ProductRepositoryShape => {
  const store = new Map<string, Product>();

  return {
    save: (product) =>
      Effect.sync(() => { store.set(product.id, product); }),

    findById: (id) =>
      Effect.suspend(() => {
        const p = store.get(id);
        return p
          ? Effect.succeed(p)
          : Effect.fail(new ProductNotFoundError({ productId: id }));
      }),

    findByMerchant: (merchantId) =>
      Effect.sync(() => [...store.values()].filter((p) => p.merchantId === merchantId)),

    list: (filter: ListProductsFilter) =>
      Effect.sync(() => {
        let items = [...store.values()];
        if (filter.activeOnly !== false) items = items.filter((p) => p.isActive);
        if (filter.category) items = items.filter((p) => p.category === filter.category);
        if (filter.search) {
          const q = filter.search.toLowerCase();
          items = items.filter((p) => p.name.toLowerCase().includes(q));
        }
        return items.slice(filter.offset ?? 0, (filter.offset ?? 0) + (filter.limit ?? 20));
      }),

    update: (product) =>
      Effect.suspend(() => {
        if (!store.has(product.id)) {
          return Effect.fail(new ProductNotFoundError({ productId: product.id }));
        }
        store.set(product.id, product);
        return Effect.succeed(product);
      }),

    deactivate: (id) =>
      Effect.suspend(() => {
        const p = store.get(id);
        if (!p) return Effect.fail(new ProductNotFoundError({ productId: id }));
        store.set(id, { ...p, isActive: false });
        return Effect.void;
      }),
  };
};

const silentProducer = (): KafkaProducerShape => ({
  publish:      () => Effect.void,
  publishBatch: () => Effect.void,
});

const makeTestLayer = () =>
  ProductService.Default.pipe(
    Layer.provide(Layer.succeed(ProductRepository, makeInMemoryRepo())),
    Layer.provide(Layer.succeed(KafkaProducer, silentProducer()))
  );

const run = <A, E>(effect: Effect.Effect<A, E, ProductService>) =>
  Effect.runPromise(Effect.provide(effect, makeTestLayer()));

const sample = (overrides = {}) => ({
  merchantId:  "merchant-1" as MerchantId,
  name:        "Blue T-Shirt",
  description: "Nice cotton shirt",
  priceCents:  59_900,
  category:    "clothing",
  inventory:   { S: 10, M: 5, L: 3 },
  ...overrides,
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("ProductService", () => {
  describe("create", () => {
    it("creates a product with isActive=true", async () => {
      const p = await run(
        Effect.gen(function* () {
          const svc = yield* ProductService;
          return yield* svc.create(sample());
        })
      );
      expect(p.isActive).toBe(true);
      expect(p.name).toBe("Blue T-Shirt");
      expect(p.priceCents).toBe(59_900);
    });

    it("fails with InvalidProductError for blank name", async () => {
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* ProductService;
          return yield* svc.create(sample({ name: "   " }));
        }).pipe(Effect.provide(makeTestLayer()), Effect.either)
      );
      expect(result._tag).toBe("Left");
      if (result._tag === "Left") {
        expect((result.left as { _tag: string })._tag).toBe("InvalidProductError");
      }
    });

    it("fails with InvalidProductError for negative price", async () => {
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* ProductService;
          return yield* svc.create(sample({ priceCents: -1 }));
        }).pipe(Effect.provide(makeTestLayer()), Effect.either)
      );
      expect(result._tag).toBe("Left");
    });
  });

  describe("deactivate", () => {
    it("sets isActive to false", async () => {
      const layer = makeTestLayer();
      await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* ProductService;
          const p   = yield* svc.create(sample());
          yield* svc.deactivate(p.id);
          const fetched = yield* svc.getById(p.id);
          expect(fetched.isActive).toBe(false);
        }).pipe(Effect.provide(layer))
      );
    });
  });

  describe("list", () => {
    it("filters by category", async () => {
      const layer = makeTestLayer();
      const items = await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* ProductService;
          yield* svc.create(sample({ category: "clothing" }));
          yield* svc.create(sample({ name: "Mug", category: "accessories" }));
          return yield* svc.list({ category: "clothing" });
        }).pipe(Effect.provide(layer))
      );
      expect(items).toHaveLength(1);
      expect(items[0]?.category).toBe("clothing");
    });
  });
});
