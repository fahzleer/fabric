import { Context, Effect, Layer } from "effect";
import { KafkaProducer } from "@fabric/kafka";
import {
  type Product,
  type ProductId,
  type MerchantId,
  ProductNotFoundError,
  InvalidProductError,
  makeProductId,
} from "../domain/product.ts";
import { ProductRepository, type ListProductsFilter } from "../infrastructure/db/product.repository.ts";

const TOPIC = {
  CREATED: "product.created",
  UPDATED: "product.updated",
  DELETED: "product.deleted",
} as const;

export interface CreateProductInput {
  readonly merchantId:  MerchantId;
  readonly name:        string;
  readonly description: string;
  readonly priceCents:  number;
  readonly currency?:   string;
  readonly category:    string;
  readonly tags?:       string[];
  readonly inventory:   Record<string, number>;
  readonly imageUrls?:  string[];
}

export interface UpdateProductInput {
  readonly name?:        string;
  readonly description?: string;
  readonly priceCents?:  number;
  readonly category?:    string;
  readonly tags?:        string[];
  readonly imageUrls?:   string[];
}

export interface ProductServiceShape {
  readonly create:        (input: CreateProductInput) => Effect.Effect<Product, InvalidProductError>;
  readonly getById:       (id: ProductId) => Effect.Effect<Product, ProductNotFoundError>;
  readonly list:          (filter: ListProductsFilter) => Effect.Effect<Product[], never>;
  readonly listByMerchant:(merchantId: MerchantId) => Effect.Effect<Product[], never>;
  readonly update:        (id: ProductId, input: UpdateProductInput) => Effect.Effect<Product, ProductNotFoundError>;
  readonly deactivate:    (id: ProductId) => Effect.Effect<void, ProductNotFoundError>;
}

export class ProductService extends Context.Tag(
  "@fabric/product/ProductService"
)<ProductService, ProductServiceShape>() {
  static readonly Default: Layer.Layer<
    ProductService,
    never,
    ProductRepository | KafkaProducer
  > = Layer.effect(
    ProductService,
    Effect.gen(function* () {
      const repo     = yield* ProductRepository;
      const producer = yield* KafkaProducer;

      const publish = (topic: string, payload: unknown, key: string) =>
        producer.publish(topic, payload, { key }).pipe(Effect.catchAll(() => Effect.void));

      return {
        create: (input) =>
          Effect.gen(function* () {
            if (!input.name.trim()) {
              return yield* Effect.fail(new InvalidProductError({ reason: "name is required" }));
            }
            if (input.priceCents < 0) {
              return yield* Effect.fail(new InvalidProductError({ reason: "price must be non-negative" }));
            }
            const now = new Date().toISOString();
            const product: Product = {
              id:          makeProductId(),
              merchantId:  input.merchantId,
              name:        input.name.trim(),
              description: input.description,
              priceCents:  input.priceCents,
              currency:    input.currency ?? "THB",
              category:    input.category,
              tags:        input.tags ?? [],
              inventory:   input.inventory,
              imageUrls:   input.imageUrls ?? [],
              isActive:    true,
              createdAt:   now,
              updatedAt:   now,
            };
            yield* repo.save(product);
            yield* publish(TOPIC.CREATED, product, product.id);
            return product;
          }),

        getById: repo.findById,

        list: repo.list,

        listByMerchant: repo.findByMerchant,

        update: (id, input) =>
          Effect.gen(function* () {
            const existing = yield* repo.findById(id);
            const updated: Product = {
              ...existing,
              name:        input.name        ?? existing.name,
              description: input.description ?? existing.description,
              priceCents:  input.priceCents  ?? existing.priceCents,
              category:    input.category    ?? existing.category,
              tags:        input.tags        ?? existing.tags,
              imageUrls:   input.imageUrls   ?? existing.imageUrls,
              updatedAt:   new Date().toISOString(),
            };
            const saved = yield* repo.update(updated);
            yield* publish(TOPIC.UPDATED, saved, id);
            return saved;
          }),

        deactivate: (id) =>
          Effect.gen(function* () {
            yield* repo.deactivate(id);
            yield* publish(TOPIC.DELETED, { id, deletedAt: new Date().toISOString() }, id);
          }),
      } satisfies ProductServiceShape;
    })
  );
}
