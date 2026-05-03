import { describe, it, expect } from "bun:test";
import { Effect, Layer } from "effect";
import { PaymentService } from "./payment.service.ts";
import { KafkaProducer, type KafkaProducerShape } from "@fabric/kafka";
import { PaymentRepository, type PaymentRepositoryShape } from "../infrastructure/db/payment.repository.ts";
import {
  type Payment,
  type PaymentId,
  type OrderId,
  PaymentNotFoundError,
} from "../domain/payment.ts";

// ── Test doubles ──────────────────────────────────────────────────────────────

const silentProducer = (): KafkaProducerShape => ({
  publish:      () => Effect.void,
  publishBatch: () => Effect.void,
});

const makeInMemoryRepo = (): PaymentRepositoryShape => {
  const store:   Map<PaymentId, Payment> = new Map();
  const byOrder: Map<string, PaymentId>  = new Map();

  return {
    save: (payment) =>
      Effect.sync(() => {
        store.set(payment.id, payment);
        byOrder.set(payment.orderId, payment.id);
      }),

    findById: (id) =>
      Effect.suspend(() => {
        const p = store.get(id);
        return p
          ? Effect.succeed(p)
          : Effect.fail(new PaymentNotFoundError({ paymentId: id }));
      }),

    findByOrder: (orderId) =>
      Effect.suspend(() => {
        const id = byOrder.get(orderId);
        if (!id) return Effect.fail(new PaymentNotFoundError({ paymentId: "" as PaymentId }));
        const p = store.get(id);
        return p
          ? Effect.succeed(p)
          : Effect.fail(new PaymentNotFoundError({ paymentId: id }));
      }),

    update: (payment) =>
      Effect.suspend(() => {
        if (!store.has(payment.id)) {
          return Effect.fail(new PaymentNotFoundError({ paymentId: payment.id }));
        }
        store.set(payment.id, payment);
        return Effect.succeed(payment);
      }),
  };
};

const makeTestLayer = () =>
  PaymentService.Default.pipe(
    Layer.provide(Layer.succeed(KafkaProducer, silentProducer())),
    Layer.provide(Layer.succeed(PaymentRepository, makeInMemoryRepo()))
  );

const run = <A, E>(effect: Effect.Effect<A, E, PaymentService>) =>
  Effect.runPromise(Effect.provide(effect, makeTestLayer()));

const runEither = <A, E>(effect: Effect.Effect<A, E, PaymentService>) =>
  Effect.runPromise(Effect.provide(effect, makeTestLayer()).pipe(Effect.either));

const sampleInput = (overrides = {}) => ({
  orderId:     "order-1" as OrderId,
  amountCents: 100_000,
  currency:    "THB",
  method:      "card" as const,
  ...overrides,
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("PaymentService", () => {
  describe("initiate", () => {
    it("creates a pending payment", async () => {
      const p = await run(
        Effect.gen(function* () {
          const svc = yield* PaymentService;
          return yield* svc.initiate(sampleInput());
        })
      );
      expect(p.status).toBe("pending");
      expect(p.amountCents).toBe(100_000);
      expect(p.method).toBe("card");
      expect(p.provider).toBe("omise");
      expect(p.id).toBeTruthy();
    });

    it("maps promptpay to omise provider", async () => {
      const p = await run(
        Effect.gen(function* () {
          const svc = yield* PaymentService;
          return yield* svc.initiate(sampleInput({ method: "promptpay" }));
        })
      );
      expect(p.provider).toBe("omise");
    });

    it("maps crypto to usdc provider", async () => {
      const p = await run(
        Effect.gen(function* () {
          const svc = yield* PaymentService;
          return yield* svc.initiate(sampleInput({ method: "crypto" }));
        })
      );
      expect(p.provider).toBe("usdc");
    });
  });

  describe("succeed", () => {
    it("marks payment as succeeded with providerRef", async () => {
      const layer = makeTestLayer();
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* PaymentService;
          const p   = yield* svc.initiate(sampleInput());
          return yield* svc.succeed(p.id, "chrg_abc123");
        }).pipe(Effect.provide(layer))
      );
      expect(result.status).toBe("succeeded");
      expect(result.providerRef).toBe("chrg_abc123");
    });

    it("fails with PaymentAlreadyProcessedError if already succeeded", async () => {
      const layer = makeTestLayer();
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* PaymentService;
          const p   = yield* svc.initiate(sampleInput());
          yield* svc.succeed(p.id, "ref1");
          return yield* svc.succeed(p.id, "ref2");
        }).pipe(Effect.provide(layer), Effect.either)
      );
      expect(result._tag).toBe("Left");
      if (result._tag === "Left") {
        expect((result.left as { _tag: string })._tag).toBe("PaymentAlreadyProcessedError");
      }
    });

    it("fails with PaymentNotFoundError for unknown id", async () => {
      const result = await runEither(
        Effect.gen(function* () {
          const svc = yield* PaymentService;
          return yield* svc.succeed("no-such-id" as PaymentId, "ref");
        })
      );
      expect(result._tag).toBe("Left");
      if (result._tag === "Left") {
        expect((result.left as { _tag: string })._tag).toBe("PaymentNotFoundError");
      }
    });
  });

  describe("fail", () => {
    it("marks payment as failed", async () => {
      const layer = makeTestLayer();
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* PaymentService;
          const p   = yield* svc.initiate(sampleInput());
          return yield* svc.fail(p.id, "card declined");
        }).pipe(Effect.provide(layer))
      );
      expect(result.status).toBe("failed");
      expect(result.failureReason).toBe("card declined");
    });
  });

  describe("refund", () => {
    it("refunds a succeeded payment", async () => {
      const layer = makeTestLayer();
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* PaymentService;
          const p   = yield* svc.initiate(sampleInput());
          yield* svc.succeed(p.id, "ref");
          return yield* svc.refund(p.id);
        }).pipe(Effect.provide(layer))
      );
      expect(result.status).toBe("refunded");
    });

    it("fails to refund a pending payment", async () => {
      const layer = makeTestLayer();
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* PaymentService;
          const p   = yield* svc.initiate(sampleInput());
          return yield* svc.refund(p.id);
        }).pipe(Effect.provide(layer), Effect.either)
      );
      expect(result._tag).toBe("Left");
      if (result._tag === "Left") {
        expect((result.left as { _tag: string })._tag).toBe("PaymentAlreadyProcessedError");
      }
    });
  });
});
