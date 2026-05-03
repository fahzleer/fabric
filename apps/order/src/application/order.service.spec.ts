import { describe, it, expect } from "bun:test";
import { Effect, Layer } from "effect";
import { OrderService } from "./order.service.ts";
import { OrderRepository, type OrderRepositoryShape } from "../infrastructure/db/order.repository.ts";
import {
  type Order,
  type OrderId,
  type UserId,
  type OrderStatus,
  OrderNotFoundError,
} from "../domain/order.ts";

// ── In-memory test doubles ────────────────────────────────────────────────────

const makeInMemoryRepo = (): OrderRepositoryShape => {
  const store = new Map<string, Order>();

  const save = (order: Order) => { store.set(order.id, order); };

  return {
    createOrder: ({ projection }) =>
      Effect.sync(() => {
        save({
          id:              projection.id      as OrderId,
          userId:          projection.userId,
          items:           projection.items,
          totalCents:      projection.totalCents,
          currency:        projection.currency,
          paymentMethod:   projection.paymentMethod,
          shippingAddress: projection.shippingAddress,
          status:          "pending",
          createdAt:       projection.createdAt,
          updatedAt:       projection.createdAt,
        });
      }),

    transitionOrder: ({ statusUpdate }) =>
      Effect.sync(() => {
        const o = store.get(statusUpdate.id);
        if (!o) return;
        store.set(statusUpdate.id, {
          ...o,
          status:    statusUpdate.status as OrderStatus,
          updatedAt: statusUpdate.updatedAt,
        });
      }),

    findById: (id) =>
      Effect.suspend(() => {
        const o = store.get(id);
        return o
          ? Effect.succeed(o)
          : Effect.fail(new OrderNotFoundError({ orderId: id }));
      }),

    findByUserId: (userId) =>
      Effect.sync(() => [...store.values()].filter((o) => o.userId === userId)),

    findAll: () => Effect.sync(() => [...store.values()]),

    nextVersion: () => Effect.succeed(2),

    getAdminStats: () =>
      Effect.succeed({
        totalOrders: 0, totalRevenueCents: 0, currency: "THB",
        activeUsers30d: 0, churnRatePct: 0,
      }),
  };
};

// ── Test layer ────────────────────────────────────────────────────────────────

const makeTestLayer = () =>
  OrderService.Default.pipe(
    Layer.provide(Layer.succeed(OrderRepository, makeInMemoryRepo()))
  );

const run = <A, E>(effect: Effect.Effect<A, E, OrderService>): Promise<A> =>
  Effect.runPromise(Effect.provide(effect, makeTestLayer()));

const runEither = <A, E>(effect: Effect.Effect<A, E, OrderService>) =>
  Effect.runPromise(
    Effect.provide(effect, makeTestLayer()).pipe(Effect.either)
  );

// ── Sample data ───────────────────────────────────────────────────────────────

const sampleInput = (overrides: Record<string, unknown> = {}) => ({
  userId:  "user-1" as UserId,
  items: [
    { productId: "prod-1", name: "T-Shirt", size: "M", quantity: 2, unitPriceCents: 50_000 },
  ],
  paymentMethod:   "card" as const,
  shippingAddress: {
    recipientName: "Test User", street: "123 Main St", city: "Bangkok",
    province: "Bangkok", postalCode: "10000", country: "TH", phone: "0812345678",
  },
  ...overrides,
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("OrderService", () => {
  describe("placeOrder", () => {
    it("creates an order with pending status", async () => {
      const order = await run(Effect.gen(function* () {
        const svc = yield* OrderService;
        return yield* svc.placeOrder(sampleInput());
      }));
      expect(order.status).toBe("pending");
      expect(order.userId as string).toBe("user-1");
      expect(order.totalCents).toBe(100_000);
      expect(order.currency).toBe("THB");
      expect(order.id).toBeTruthy();
    });

    it("calculates totalCents from all items", async () => {
      const order = await run(Effect.gen(function* () {
        const svc = yield* OrderService;
        return yield* svc.placeOrder(sampleInput({
          items: [
            { productId: "p1", name: "A", size: "S", quantity: 1, unitPriceCents: 30_000 },
            { productId: "p2", name: "B", size: "L", quantity: 3, unitPriceCents: 20_000 },
          ],
        }));
      }));
      expect(order.totalCents).toBe(90_000);
    });

    it("defaults currency to THB", async () => {
      const order = await run(Effect.gen(function* () {
        const svc = yield* OrderService;
        return yield* svc.placeOrder(sampleInput());
      }));
      expect(order.currency).toBe("THB");
    });
  });

  describe("getOrder", () => {
    it("returns the order for its owner", async () => {
      const fetched = await run(Effect.gen(function* () {
        const svc    = yield* OrderService;
        const placed = yield* svc.placeOrder(sampleInput());
        return yield* svc.getOrder(placed.id, placed.userId);
      }));
      expect(fetched.id).toBeTruthy();
    });

    it("returns OrderNotFoundError when userId does not match", async () => {
      const result = await runEither(Effect.gen(function* () {
        const svc    = yield* OrderService;
        const placed = yield* svc.placeOrder(sampleInput());
        return yield* svc.getOrder(placed.id, "other-user" as UserId);
      }));
      expect(result._tag).toBe("Left");
      if (result._tag === "Left")
        expect((result.left as { _tag: string })._tag).toBe("OrderNotFoundError");
    });

    it("returns OrderNotFoundError for unknown id", async () => {
      const result = await runEither(Effect.gen(function* () {
        const svc = yield* OrderService;
        return yield* svc.getOrder("no-such-id" as OrderId, "user-1" as UserId);
      }));
      expect(result._tag).toBe("Left");
    });
  });

  describe("confirmOrder", () => {
    it("transitions pending → confirmed", async () => {
      const confirmed = await run(Effect.gen(function* () {
        const svc    = yield* OrderService;
        const placed = yield* svc.placeOrder(sampleInput());
        return yield* svc.confirmOrder(placed.id);
      }));
      expect(confirmed.status).toBe("confirmed");
    });

    it("fails with InvalidOrderStateError when already cancelled", async () => {
      const result = await runEither(Effect.gen(function* () {
        const svc    = yield* OrderService;
        const placed = yield* svc.placeOrder(sampleInput());
        yield* svc.cancelOrder(placed.id, placed.userId);
        return yield* svc.confirmOrder(placed.id);
      }));
      expect(result._tag).toBe("Left");
      if (result._tag === "Left")
        expect((result.left as { _tag: string })._tag).toBe("InvalidOrderStateError");
    });
  });

  describe("cancelOrder", () => {
    it("transitions pending → cancelled", async () => {
      const cancelled = await run(Effect.gen(function* () {
        const svc    = yield* OrderService;
        const placed = yield* svc.placeOrder(sampleInput());
        return yield* svc.cancelOrder(placed.id, placed.userId);
      }));
      expect(cancelled.status).toBe("cancelled");
    });

    it("rejects cancellation if userId does not match", async () => {
      const result = await runEither(Effect.gen(function* () {
        const svc    = yield* OrderService;
        const placed = yield* svc.placeOrder(sampleInput());
        return yield* svc.cancelOrder(placed.id, "stranger" as UserId);
      }));
      expect(result._tag).toBe("Left");
    });
  });

  describe("markPaid", () => {
    it("transitions confirmed → paid", async () => {
      const paid = await run(Effect.gen(function* () {
        const svc    = yield* OrderService;
        const placed = yield* svc.placeOrder(sampleInput());
        yield* svc.confirmOrder(placed.id);
        return yield* svc.markPaid(placed.id);
      }));
      expect(paid.status).toBe("paid");
    });

    it("returns OrderAlreadyPaidError when called twice", async () => {
      const result = await runEither(Effect.gen(function* () {
        const svc    = yield* OrderService;
        const placed = yield* svc.placeOrder(sampleInput());
        yield* svc.confirmOrder(placed.id);
        yield* svc.markPaid(placed.id);
        return yield* svc.markPaid(placed.id);
      }));
      expect(result._tag).toBe("Left");
      if (result._tag === "Left")
        expect((result.left as { _tag: string })._tag).toBe("OrderAlreadyPaidError");
    });

    it("fails if order is still pending", async () => {
      const result = await runEither(Effect.gen(function* () {
        const svc    = yield* OrderService;
        const placed = yield* svc.placeOrder(sampleInput());
        return yield* svc.markPaid(placed.id);
      }));
      expect(result._tag).toBe("Left");
    });
  });

  describe("listUserOrders", () => {
    it("returns all orders for a user, not others", async () => {
      const orders = await run(Effect.gen(function* () {
        const svc = yield* OrderService;
        yield* svc.placeOrder(sampleInput());
        yield* svc.placeOrder(sampleInput());
        yield* svc.placeOrder(sampleInput({ userId: "other" as UserId }));
        return yield* svc.listUserOrders("user-1" as UserId);
      }));
      expect(orders).toHaveLength(2);
      expect(orders.every((o) => o.userId === "user-1")).toBe(true);
    });

    it("returns empty array when user has no orders", async () => {
      const orders = await run(Effect.gen(function* () {
        const svc = yield* OrderService;
        return yield* svc.listUserOrders("no-orders" as UserId);
      }));
      expect(orders).toHaveLength(0);
    });
  });
});
