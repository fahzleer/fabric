import { describe, it, expect } from "bun:test";
import { Effect, Layer } from "effect";
import { PromotionService } from "./promotion.service.ts";
import { KafkaProducer, type KafkaProducerShape } from "@fabric/kafka";
import { PromotionRepository, type PromotionRepositoryShape } from "../infrastructure/db/promotion.repository.ts";
import {
  type Promotion,
  type CouponCode,
  PromotionNotFoundError,
  CouponExhaustedError,
} from "../domain/promotion.ts";

// ── Test doubles ──────────────────────────────────────────────────────────────

const silentProducer = (): KafkaProducerShape => ({
  publish:      () => Effect.void,
  publishBatch: () => Effect.void,
});

const makeInMemoryRepo = (): PromotionRepositoryShape => {
  const store: Map<string, Promotion> = new Map(); // keyed by uppercase code

  return {
    save: (promo) =>
      Effect.sync(() => {
        store.set(promo.code, promo);
      }),

    findByCode: (code) =>
      Effect.suspend(() => {
        const p = store.get(code.toUpperCase());
        return p
          ? Effect.succeed(p)
          : Effect.fail(
              new PromotionNotFoundError({ code: code.toUpperCase() as CouponCode })
            );
      }),

    update: (promo) =>
      Effect.suspend(() => {
        if (!store.has(promo.code)) {
          return Effect.fail(new PromotionNotFoundError({ code: promo.code }));
        }
        store.set(promo.code, promo);
        return Effect.succeed(promo);
      }),

    atomicIncrement: (code, now) =>
      Effect.suspend((): Effect.Effect<Promotion, PromotionNotFoundError | CouponExhaustedError> => {
        const p = store.get(code.toUpperCase());
        if (!p || !p.isActive) {
          return Effect.fail(
            new PromotionNotFoundError({ code: code.toUpperCase() as CouponCode })
          );
        }
        if (p.maxUsageTotal !== null && p.usageCount >= p.maxUsageTotal) {
          return Effect.fail(new CouponExhaustedError({ code: p.code }));
        }
        const updated = { ...p, usageCount: p.usageCount + 1, updatedAt: now };
        store.set(p.code, updated);
        return Effect.succeed(updated);
      }),

    listAll: () => Effect.sync(() => [...store.values()]),
  };
};

const makeTestLayer = () =>
  PromotionService.Default.pipe(
    Layer.provide(Layer.succeed(KafkaProducer, silentProducer())),
    Layer.provide(Layer.succeed(PromotionRepository, makeInMemoryRepo()))
  );

const run = <A, E>(effect: Effect.Effect<A, E, PromotionService>) =>
  Effect.runPromise(Effect.provide(effect, makeTestLayer()));

const runEither = <A, E>(effect: Effect.Effect<A, E, PromotionService>) =>
  Effect.runPromise(Effect.provide(effect, makeTestLayer()).pipe(Effect.either));

const samplePromo = (overrides = {}) => ({
  code:          "SAVE10",
  description:   "10% off",
  discountType:  "percentage" as const,
  discountValue: 10,
  ...overrides,
});

describe("PromotionService", () => {
  describe("create", () => {
    it("creates a promotion and uppercases code", async () => {
      const p = await run(
        Effect.gen(function* () {
          const svc = yield* PromotionService;
          return yield* svc.create(samplePromo({ code: "save10" }));
        })
      );
      expect(p.code as string).toBe("SAVE10");
      expect(p.isActive).toBe(true);
    });
  });

  describe("apply — percentage discount", () => {
    it("calculates correct discount", async () => {
      const layer = makeTestLayer();
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* PromotionService;
          yield* svc.create(samplePromo({ code: "PCT10", discountValue: 10 }));
          return yield* svc.apply("PCT10", 100_000, "user-1");
        }).pipe(Effect.provide(layer))
      );
      expect(result.discountCents).toBe(10_000);
      expect(result.finalCents).toBe(90_000);
    });
  });

  describe("apply — fixed amount", () => {
    it("deducts fixed amount", async () => {
      const layer = makeTestLayer();
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* PromotionService;
          yield* svc.create(samplePromo({ code: "FLAT50", discountType: "fixed_amount", discountValue: 50_000 }));
          return yield* svc.apply("FLAT50", 100_000, "user-1");
        }).pipe(Effect.provide(layer))
      );
      expect(result.discountCents).toBe(50_000);
      expect(result.finalCents).toBe(50_000);
    });

    it("does not make final price negative", async () => {
      const layer = makeTestLayer();
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* PromotionService;
          yield* svc.create(samplePromo({ code: "BIG", discountType: "fixed_amount", discountValue: 999_999 }));
          return yield* svc.apply("BIG", 10_000, "user-1");
        }).pipe(Effect.provide(layer))
      );
      expect(result.finalCents).toBe(0);
    });
  });

  describe("apply — expired coupon", () => {
    it("fails with CouponExpiredError", async () => {
      const layer = makeTestLayer();
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* PromotionService;
          yield* svc.create(samplePromo({
            code:      "EXPIRED",
            expiresAt: "2020-01-01T00:00:00Z",
          }));
          return yield* svc.apply("EXPIRED", 100_000, "user-1");
        }).pipe(Effect.provide(layer), Effect.either)
      );
      expect(result._tag).toBe("Left");
      if (result._tag === "Left") {
        expect((result.left as { _tag: string })._tag).toBe("CouponExpiredError");
      }
    });
  });

  describe("apply — minimum order", () => {
    it("fails with MinimumOrderNotMetError when below minimum", async () => {
      const layer = makeTestLayer();
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* PromotionService;
          yield* svc.create(samplePromo({ code: "MIN500", minimumCents: 500_000 }));
          return yield* svc.apply("MIN500", 100_000, "user-1");
        }).pipe(Effect.provide(layer), Effect.either)
      );
      expect(result._tag).toBe("Left");
      if (result._tag === "Left") {
        expect((result.left as { _tag: string })._tag).toBe("MinimumOrderNotMetError");
      }
    });
  });

  describe("apply — unknown code", () => {
    it("fails with PromotionNotFoundError", async () => {
      const result = await runEither(
        Effect.gen(function* () {
          const svc = yield* PromotionService;
          return yield* svc.apply("NOTREAL", 100_000, "user-1");
        })
      );
      expect(result._tag).toBe("Left");
      if (result._tag === "Left") {
        expect((result.left as { _tag: string })._tag).toBe("PromotionNotFoundError");
      }
    });
  });

  describe("apply — exhausted coupon", () => {
    it("fails after max usage reached", async () => {
      const layer = makeTestLayer();
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* PromotionService;
          yield* svc.create(samplePromo({ code: "ONE", maxUsageTotal: 1 }));
          yield* svc.apply("ONE", 100_000, "user-1");
          return yield* svc.apply("ONE", 100_000, "user-2");
        }).pipe(Effect.provide(layer), Effect.either)
      );
      expect(result._tag).toBe("Left");
      if (result._tag === "Left") {
        expect((result.left as { _tag: string })._tag).toBe("CouponExhaustedError");
      }
    });
  });

  describe("disable", () => {
    it("deactivates a promotion", async () => {
      const layer = makeTestLayer();
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* PromotionService;
          yield* svc.create(samplePromo({ code: "DISABLE_ME" }));
          return yield* svc.disable("DISABLE_ME");
        }).pipe(Effect.provide(layer))
      );
      expect(result.isActive).toBe(false);
    });
  });
});
