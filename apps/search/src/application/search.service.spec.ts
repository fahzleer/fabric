import { describe, it, expect } from "bun:test";
import { Effect, Layer } from "effect";
import { SearchService, type SearchQuery } from "./search.service.ts";
import { KafkaConsumer, type KafkaConsumerShape, type KafkaMessage } from "@fabric/kafka";

// ── Stub consumer ─────────────────────────────────────────────────────────────

type MessageHandler = <T>(msg: KafkaMessage<T>) => Effect.Effect<void, never>;
let _capturedTopics:  string[] = [];
let _capturedHandler: MessageHandler | null = null;

const stubConsumer = (): KafkaConsumerShape => ({
  // biome-ignore lint/suspicious/noExplicitAny: stub returns dummy stream
  stream: (_topics) => null as any,
  subscribe: (topics, handler) => {
    _capturedTopics  = Array.isArray(topics) ? topics : [topics];
    _capturedHandler = handler as MessageHandler;
    return Effect.void;
  },
});

const makeTestLayer = () =>
  SearchService.Default.pipe(
    Layer.provide(Layer.succeed(KafkaConsumer, stubConsumer()))
  );

const run = <A, E>(effect: Effect.Effect<A, E, SearchService>) =>
  Effect.runPromise(Effect.provide(effect, makeTestLayer()));

// ── Helpers ───────────────────────────────────────────────────────────────────

const ingestProduct = (overrides: Record<string, unknown> = {}) =>
  Effect.gen(function* () {
    const svc = yield* SearchService;
    yield* svc.startIndexing();

    if (_capturedHandler) {
      yield* _capturedHandler({
        topic:     "product.created",
        partition: 0,
        offset:    "0",
        key:       "prod_1",
        value:     {
          id:          "prod_1",
          name:        "Blue Denim Shirt",
          description: "Premium cotton denim shirt for everyday wear",
          category:    "clothing",
          tags:        ["shirt", "denim", "blue"],
          priceCents:  59900,
          currency:    "THB",
          imageUrls:   [],
          ...overrides,
        } as unknown,
      } as KafkaMessage<unknown>);
    }
  });

const search = (query: SearchQuery) =>
  Effect.gen(function* () {
    const svc = yield* SearchService;
    return yield* svc.search(query);
  });

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("SearchService.startIndexing", () => {
  it("subscribes to product event topics", async () => {
    await run(
      Effect.gen(function* () {
        const svc = yield* SearchService;
        yield* svc.startIndexing();
      })
    );
    expect(_capturedTopics).toContain("product.created");
    expect(_capturedTopics).toContain("product.updated");
    expect(_capturedTopics).toContain("product.deleted");
  });
});

describe("SearchService.search — empty index", () => {
  it("returns empty results on empty index", async () => {
    // Fresh layer
    const freshLayer = SearchService.Default.pipe(
      Layer.provide(Layer.succeed(KafkaConsumer, stubConsumer()))
    );
    const result = await Effect.runPromise(
      Effect.provide(
        Effect.gen(function* () {
          const svc = yield* SearchService;
          return yield* svc.search({ q: "anything" });
        }),
        freshLayer
      )
    );
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });
});

describe("SearchService.search — keyword matching", () => {
  it("finds product by name keyword", async () => {
    const layer = makeTestLayer();
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        yield* ingestProduct();
        return yield* search({ q: "denim" });
      }).pipe(Effect.provide(layer))
    );
    expect(result.total).toBe(1);
    expect(result.items[0]!.name).toBe("Blue Denim Shirt");
  });

  it("finds product by description keyword", async () => {
    const layer = makeTestLayer();
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        yield* ingestProduct();
        return yield* search({ q: "cotton" });
      }).pipe(Effect.provide(layer))
    );
    expect(result.total).toBe(1);
  });

  it("finds product by tag", async () => {
    const layer = makeTestLayer();
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        yield* ingestProduct();
        return yield* search({ q: "shirt" });
      }).pipe(Effect.provide(layer))
    );
    expect(result.total).toBe(1);
  });

  it("returns empty for no match", async () => {
    const layer = makeTestLayer();
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        yield* ingestProduct();
        return yield* search({ q: "laptop" });
      }).pipe(Effect.provide(layer))
    );
    expect(result.total).toBe(0);
  });

  it("is case-insensitive", async () => {
    const layer = makeTestLayer();
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        yield* ingestProduct();
        return yield* search({ q: "DENIM" });
      }).pipe(Effect.provide(layer))
    );
    expect(result.total).toBe(1);
  });
});

describe("SearchService.search — category filter", () => {
  it("filters by category", async () => {
    const layer = makeTestLayer();
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        yield* ingestProduct();
        return yield* search({ category: "clothing" });
      }).pipe(Effect.provide(layer))
    );
    expect(result.total).toBe(1);
  });

  it("excludes products in wrong category", async () => {
    const layer = makeTestLayer();
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        yield* ingestProduct();
        return yield* search({ category: "electronics" });
      }).pipe(Effect.provide(layer))
    );
    expect(result.total).toBe(0);
  });
});

describe("SearchService.search — price filter", () => {
  it("filters by minPrice", async () => {
    const layer = makeTestLayer();
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        yield* ingestProduct(); // priceCents: 59900
        return yield* search({ minPrice: 60000 });
      }).pipe(Effect.provide(layer))
    );
    expect(result.total).toBe(0);
  });

  it("filters by maxPrice", async () => {
    const layer = makeTestLayer();
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        yield* ingestProduct(); // priceCents: 59900
        return yield* search({ maxPrice: 59900 });
      }).pipe(Effect.provide(layer))
    );
    expect(result.total).toBe(1);
  });

  it("filters by price range", async () => {
    const layer = makeTestLayer();
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        yield* ingestProduct(); // priceCents: 59900
        return yield* search({ minPrice: 50000, maxPrice: 70000 });
      }).pipe(Effect.provide(layer))
    );
    expect(result.total).toBe(1);
  });
});

describe("SearchService.search — pagination", () => {
  it("respects limit", async () => {
    const layer = makeTestLayer();
    // Use an isolated category so prior tests' products don't bleed in
    const UNIQUE_CATEGORY = `pagination-test-${Date.now()}`;
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* SearchService;
        yield* svc.startIndexing();
        // Ingest 3 products with unique category
        for (const i of [1, 2, 3]) {
          if (_capturedHandler) {
            yield* _capturedHandler({
              topic:     "product.created",
              partition: 0,
              offset:    String(i),
              key:       `page_prod_${i}`,
              value:     {
                id:          `page_prod_${i}`,
                name:        `Pagination Product ${i}`,
                description: "pagination test",
                category:    UNIQUE_CATEGORY,
                tags:        [],
                priceCents:  1000,
                currency:    "THB",
                imageUrls:   [],
              } as unknown,
            } as KafkaMessage<unknown>);
          }
        }
        return yield* svc.search({ category: UNIQUE_CATEGORY, limit: 2 });
      }).pipe(Effect.provide(layer))
    );
    expect(result.items.length).toBe(2);
    expect(result.total).toBe(3);
  });
});

describe("SearchService — Kafka event handling", () => {
  it("removes product on product.deleted event", async () => {
    const layer = makeTestLayer();
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* SearchService;
        yield* svc.startIndexing();

        // Ingest product
        if (_capturedHandler) {
          yield* _capturedHandler({
            topic: "product.created", partition: 0, offset: "0", key: "del_p1",
            value: {
              id: "del_p1", name: "To Delete", description: "d",
              category: "cat", tags: [], priceCents: 100, currency: "THB", imageUrls: [],
            } as unknown,
          } as KafkaMessage<unknown>);
        }

        // Delete it
        if (_capturedHandler) {
          yield* _capturedHandler({
            topic: "product.deleted", partition: 0, offset: "1", key: "del_p1",
            value: { id: "del_p1" } as unknown,
          } as KafkaMessage<unknown>);
        }

        return yield* svc.search({ q: "To Delete" });
      }).pipe(Effect.provide(layer))
    );
    expect(result.total).toBe(0);
  });
});
