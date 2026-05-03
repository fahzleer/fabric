import { describe, it, expect } from "bun:test";
import { Effect, Layer } from "effect";
import { ShippingService } from "./shipping.service.ts";
import { KafkaProducer, type KafkaProducerShape } from "@fabric/kafka";
import { ShipmentRepository, type ShipmentRepositoryShape } from "../infrastructure/db/shipment.repository.ts";
import {
  type Shipment,
  type ShipmentId,
  type OrderId,
  type Carrier,
  type ShippingAddress,
  ShipmentNotFoundError,
  canTransitionTo,
} from "../domain/shipment.ts";

// ── Test doubles ──────────────────────────────────────────────────────────────

const silentProducer = (): KafkaProducerShape => ({
  publish:      () => Effect.void,
  publishBatch: () => Effect.void,
});

const makeInMemoryRepo = (): ShipmentRepositoryShape => {
  const store:   Map<ShipmentId, Shipment> = new Map();
  const byOrder: Map<string, ShipmentId>   = new Map();

  return {
    save: (shipment) =>
      Effect.sync(() => {
        store.set(shipment.id, shipment);
        byOrder.set(shipment.orderId, shipment.id);
      }),

    findById: (id) =>
      Effect.suspend(() => {
        const s = store.get(id);
        return s
          ? Effect.succeed(s)
          : Effect.fail(new ShipmentNotFoundError({ shipmentId: id }));
      }),

    findByOrder: (orderId) =>
      Effect.suspend(() => {
        const id = byOrder.get(orderId);
        if (!id) return Effect.fail(new ShipmentNotFoundError({ shipmentId: "" as ShipmentId }));
        const s = store.get(id);
        return s
          ? Effect.succeed(s)
          : Effect.fail(new ShipmentNotFoundError({ shipmentId: id }));
      }),

    update: (shipment) =>
      Effect.suspend(() => {
        if (!store.has(shipment.id)) {
          return Effect.fail(new ShipmentNotFoundError({ shipmentId: shipment.id }));
        }
        store.set(shipment.id, shipment);
        return Effect.succeed(shipment);
      }),
  };
};

const makeTestLayer = () =>
  ShippingService.Default.pipe(
    Layer.provide(Layer.succeed(KafkaProducer, silentProducer())),
    Layer.provide(Layer.succeed(ShipmentRepository, makeInMemoryRepo()))
  );

const run = <A, E>(effect: Effect.Effect<A, E, ShippingService>) =>
  Effect.runPromise(Effect.provide(effect, makeTestLayer()));

const runEither = <A, E>(effect: Effect.Effect<A, E, ShippingService>) =>
  Effect.runPromise(Effect.provide(effect, makeTestLayer()).pipe(Effect.either));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const sampleAddress = (): ShippingAddress => ({
  recipientName: "Saifah Dev",
  street:        "123 Silom Rd",
  city:          "Bangkok",
  province:      "Bangkok",
  postalCode:    "10500",
  country:       "TH",
  phone:         "0812345678",
});

const createShipment = (overrides: { orderId?: OrderId; carrier?: Carrier } = {}) =>
  Effect.gen(function* () {
    const svc = yield* ShippingService;
    return yield* svc.create({
      orderId: (overrides.orderId ?? "order-001") as OrderId,
      carrier: overrides.carrier ?? "kerry",
      address: sampleAddress(),
    });
  });

// ── Domain logic tests ────────────────────────────────────────────────────────

describe("canTransitionTo", () => {
  it("allows pending → picked_up", () => {
    expect(canTransitionTo("pending", "picked_up")).toBe(true);
  });

  it("allows pending → failed", () => {
    expect(canTransitionTo("pending", "failed")).toBe(true);
  });

  it("allows in_transit → out_for_delivery", () => {
    expect(canTransitionTo("in_transit", "out_for_delivery")).toBe(true);
  });

  it("disallows pending → delivered (skipped steps)", () => {
    expect(canTransitionTo("pending", "delivered")).toBe(false);
  });

  it("disallows delivered → any (terminal state)", () => {
    expect(canTransitionTo("delivered", "picked_up")).toBe(false);
    expect(canTransitionTo("delivered", "failed")).toBe(false);
  });

  it("disallows failed → any (terminal state)", () => {
    expect(canTransitionTo("failed", "in_transit")).toBe(false);
  });
});

// ── ShippingService tests ─────────────────────────────────────────────────────

describe("ShippingService.create", () => {
  it("creates a shipment with pending status", async () => {
    const layer = makeTestLayer();
    const s = await Effect.runPromise(
      Effect.provide(createShipment(), layer)
    );
    expect(s.status).toBe("pending");
    expect(s.carrier).toBe("kerry");
    expect(s.trackingNumber).toBeNull();
    expect(s.id).toBeTruthy();
    expect(s.createdAt).toBeTruthy();
  });

  it("stores orderId correctly", async () => {
    const layer = makeTestLayer();
    const s = await Effect.runPromise(
      Effect.provide(createShipment({ orderId: "order-xyz" as OrderId }), layer)
    );
    expect(s.orderId as string).toBe("order-xyz");
  });
});

describe("ShippingService.setTracking", () => {
  it("sets tracking number on existing shipment", async () => {
    const layer = makeTestLayer();
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* ShippingService;
        const s   = yield* svc.create({
          orderId: "order-t1" as OrderId,
          carrier: "dhl",
          address: sampleAddress(),
        });
        return yield* svc.setTracking(s.id, "DHL123456789TH");
      }).pipe(Effect.provide(layer))
    );
    expect(result.trackingNumber).toBe("DHL123456789TH");
  });

  it("fails with ShipmentNotFoundError for unknown id", async () => {
    const result = await runEither(
      Effect.gen(function* () {
        const svc = yield* ShippingService;
        return yield* svc.setTracking("no-such-id" as ShipmentId, "TRK999");
      })
    );
    expect(result._tag).toBe("Left");
    if (result._tag === "Left") {
      expect((result.left as { _tag: string })._tag).toBe("ShipmentNotFoundError");
    }
  });
});

describe("ShippingService.transition", () => {
  it("transitions pending → picked_up → in_transit", async () => {
    const layer = makeTestLayer();
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* ShippingService;
        const s   = yield* svc.create({
          orderId: "order-tr1" as OrderId,
          carrier: "flash",
          address: sampleAddress(),
        });
        const s2 = yield* svc.transition(s.id, "picked_up");
        return yield* svc.transition(s2.id, "in_transit");
      }).pipe(Effect.provide(layer))
    );
    expect(result.status).toBe("in_transit");
  });

  it("transitions all the way to delivered", async () => {
    const layer = makeTestLayer();
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* ShippingService;
        const s   = yield* svc.create({
          orderId: "order-del" as OrderId,
          carrier: "thpost",
          address: sampleAddress(),
        });
        yield* svc.transition(s.id, "picked_up");
        yield* svc.transition(s.id, "in_transit");
        yield* svc.transition(s.id, "out_for_delivery");
        return yield* svc.transition(s.id, "delivered");
      }).pipe(Effect.provide(layer))
    );
    expect(result.status).toBe("delivered");
  });

  it("fails with InvalidShipmentStateError on illegal transition", async () => {
    const layer = makeTestLayer();
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* ShippingService;
        const s   = yield* svc.create({
          orderId: "order-bad" as OrderId,
          carrier: "kerry",
          address: sampleAddress(),
        });
        return yield* svc.transition(s.id, "delivered");
      }).pipe(Effect.provide(layer), Effect.either)
    );
    expect(result._tag).toBe("Left");
    if (result._tag === "Left") {
      expect((result.left as { _tag: string })._tag).toBe("InvalidShipmentStateError");
    }
  });
});

describe("ShippingService.getById", () => {
  it("returns an existing shipment", async () => {
    const layer = makeTestLayer();
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* ShippingService;
        const s   = yield* svc.create({
          orderId: "order-gbid" as OrderId,
          carrier: "fedex",
          address: sampleAddress(),
        });
        return yield* svc.getById(s.id);
      }).pipe(Effect.provide(layer))
    );
    expect(result.carrier).toBe("fedex");
  });

  it("fails for unknown id", async () => {
    const result = await runEither(
      Effect.gen(function* () {
        const svc = yield* ShippingService;
        return yield* svc.getById("ghost" as ShipmentId);
      })
    );
    expect(result._tag).toBe("Left");
  });
});

describe("ShippingService.getByOrder", () => {
  it("retrieves shipment by orderId", async () => {
    const layer = makeTestLayer();
    const orderId = "order-gbo" as OrderId;
    const result  = await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* ShippingService;
        yield* svc.create({ orderId, carrier: "kerry", address: sampleAddress() });
        return yield* svc.getByOrder(orderId);
      }).pipe(Effect.provide(layer))
    );
    expect(result.orderId).toBe(orderId);
  });
});
