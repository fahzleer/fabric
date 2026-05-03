import { describe, it, expect } from "bun:test";
import { Effect, Layer } from "effect";
import { NotificationService } from "./notification.service.ts";
import {
  KafkaConsumer,
  KafkaProducer,
  type KafkaConsumerShape,
  type KafkaProducerShape,
  type KafkaMessage,
} from "@fabric/kafka";
import { EmailAdapter } from "../adapters/email.adapter.ts";
import { SmsAdapter } from "../adapters/sms.adapter.ts";
import { PushAdapter } from "../adapters/push.adapter.ts";

// ── Test doubles ──────────────────────────────────────────────────────────────

type AnyHandler = <T>(msg: KafkaMessage<T>) => Effect.Effect<void, never>;

let _subscribedTopics: string[] = [];
let _capturedHandler:  AnyHandler | null = null;

const stubConsumer = (): KafkaConsumerShape => ({
  // biome-ignore lint/suspicious/noExplicitAny: stub returns dummy stream
  stream: (_topics) => null as any,
  subscribe: (topics, handler) => {
    _subscribedTopics = Array.isArray(topics) ? topics : [topics];
    _capturedHandler  = handler as AnyHandler;
    return Effect.void;
  },
});

const silentProducer = (): KafkaProducerShape => ({
  publish:      () => Effect.void,
  publishBatch: () => Effect.void,
});

const makeTestLayer = () =>
  NotificationService.Default.pipe(
    Layer.provide(Layer.succeed(KafkaConsumer, stubConsumer())),
    Layer.provide(Layer.succeed(KafkaProducer, silentProducer())),
    Layer.provide(Layer.succeed(EmailAdapter, { send: () => Effect.void })),
    Layer.provide(Layer.succeed(SmsAdapter,   { send: () => Effect.void })),
    Layer.provide(Layer.succeed(PushAdapter,  { send: () => Effect.void }))
  );

const run = <A, E>(effect: Effect.Effect<A, E, NotificationService>) =>
  Effect.runPromise(Effect.provide(effect, makeTestLayer()));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("NotificationService.startListening", () => {
  it("subscribes to all expected topics", async () => {
    await run(
      Effect.gen(function* () {
        const svc = yield* NotificationService;
        yield* svc.startListening();
      })
    );

    expect(_subscribedTopics).toContain("order.placed");
    expect(_subscribedTopics).toContain("order.confirmed");
    expect(_subscribedTopics).toContain("order.paid");
    expect(_subscribedTopics).toContain("order.cancelled");
    expect(_subscribedTopics).toContain("payment.succeeded");
    expect(_subscribedTopics).toContain("payment.failed");
    expect(_subscribedTopics).toContain("shipment.created");
    expect(_subscribedTopics).toContain("shipment.delivered");
    expect(_subscribedTopics).toContain("customer.registered");
  });

  it("handler is registered and callable", async () => {
    await run(
      Effect.gen(function* () {
        const svc = yield* NotificationService;
        yield* svc.startListening();
      })
    );
    expect(_capturedHandler).not.toBeNull();
  });

  it("handler processes order.placed without error", async () => {
    const layer = makeTestLayer();
    await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* NotificationService;
        yield* svc.startListening();
        if (_capturedHandler) {
          yield* _capturedHandler({
            topic:     "order.placed",
            partition: 0,
            offset:    "0",
            key:       "order_123",
            value:     { orderId: "order_123", customerId: "cust_1", total: 500 },
          } as KafkaMessage<unknown>);
        }
      }).pipe(Effect.provide(layer))
    );
    // No assertion needed — test passes if no error thrown
  });

  it("handler processes payment.succeeded without error", async () => {
    const layer = makeTestLayer();
    await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* NotificationService;
        yield* svc.startListening();
        if (_capturedHandler) {
          yield* _capturedHandler({
            topic:     "payment.succeeded",
            partition: 0,
            offset:    "1",
            key:       "pay_abc",
            value:     { paymentId: "pay_abc", orderId: "order_123", amount: 500 },
          } as KafkaMessage<unknown>);
        }
      }).pipe(Effect.provide(layer))
    );
  });

  it("handler processes shipment.delivered without error", async () => {
    const layer = makeTestLayer();
    await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* NotificationService;
        yield* svc.startListening();
        if (_capturedHandler) {
          yield* _capturedHandler({
            topic:     "shipment.delivered",
            partition: 0,
            offset:    "2",
            key:       "shp_001",
            value:     { shipmentId: "shp_001", orderId: "order_123" },
          } as KafkaMessage<unknown>);
        }
      }).pipe(Effect.provide(layer))
    );
  });

  it("handles customer.registered event", async () => {
    const layer = makeTestLayer();
    await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* NotificationService;
        yield* svc.startListening();
        if (_capturedHandler) {
          yield* _capturedHandler({
            topic:     "customer.registered",
            partition: 0,
            offset:    "3",
            key:       "cust_new",
            value:     { customerId: "cust_new", email: "user@example.com" },
          } as KafkaMessage<unknown>);
        }
      }).pipe(Effect.provide(layer))
    );
  });

  it("subscribes to exactly 9 topics", async () => {
    await run(
      Effect.gen(function* () {
        const svc = yield* NotificationService;
        yield* svc.startListening();
      })
    );
    expect(_subscribedTopics.length).toBe(9);
  });
});

describe("NotificationService.handle", () => {
  it("handles order.placed without error", async () => {
    await run(
      Effect.gen(function* () {
        const svc = yield* NotificationService;
        yield* svc.handle("order.placed", { orderId: "o1" });
      })
    );
  });

  it("handles unknown topic without error", async () => {
    await run(
      Effect.gen(function* () {
        const svc = yield* NotificationService;
        yield* svc.handle("some.unknown.topic", { foo: "bar" });
      })
    );
  });

  it("handles all known topics without error", async () => {
    const topics = [
      "order.placed", "order.confirmed", "order.paid", "order.cancelled",
      "payment.succeeded", "payment.failed",
      "shipment.created", "shipment.delivered",
      "customer.registered",
    ];
    for (const topic of topics) {
      await run(
        Effect.gen(function* () {
          const svc = yield* NotificationService;
          yield* svc.handle(topic, { id: "test" });
        })
      );
    }
  });
});
