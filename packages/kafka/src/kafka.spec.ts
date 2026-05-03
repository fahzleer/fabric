import { describe, it, expect } from "bun:test";
import { Effect, Layer } from "effect";
import { KafkaConfig } from "./config.ts";
import { KafkaProducer, type KafkaProducerShape } from "./producer.ts";
import { KafkaConsumer, type KafkaConsumerShape } from "./consumer.ts";
import { KafkaPublishError, KafkaConsumeError } from "./error.ts";

// ── KafkaConfig ───────────────────────────────────────────────────────────────

describe("KafkaConfig.fromEnv", () => {
  it("returns defaults when env vars are absent", () => {
    const cfg = KafkaConfig.fromEnv();
    expect(cfg.brokers).toEqual(["localhost:9092"]);
    expect(cfg.clientId).toBe("fabric");
    expect(cfg.groupId).toBe("fabric-group");
    expect(cfg.ssl).toBe(false);
  });
});

// ── KafkaProducer (stub layer) ────────────────────────────────────────────────

const makeStubProducer = (
  onPublish?: (topic: string, msg: unknown) => void
): KafkaProducerShape => ({
  publish: (topic, message) =>
    Effect.sync(() => { onPublish?.(topic, message); }),
  publishBatch: (topic, messages) =>
    Effect.sync(() => { onPublish?.(topic, messages); }),
});

const makeStubProducerLayer = (
  onPublish?: (topic: string, msg: unknown) => void
): Layer.Layer<KafkaProducer> =>
  Layer.succeed(KafkaProducer, makeStubProducer(onPublish));

describe("KafkaProducer (stub)", () => {
  it("publish calls the underlying send", async () => {
    const calls: Array<{ topic: string; msg: unknown }> = [];

    await Effect.runPromise(
      Effect.gen(function* () {
        const producer = yield* KafkaProducer;
        yield* producer.publish("test.topic", { hello: "world" });
        yield* producer.publish("test.topic", { hello: "fabric" });
      }).pipe(
        Effect.provide(
          makeStubProducerLayer((topic, msg) => calls.push({ topic, msg }))
        )
      )
    );

    expect(calls).toHaveLength(2);
    expect(calls[0]?.topic).toBe("test.topic");
    expect(calls[1]?.msg).toEqual({ hello: "fabric" });
  });

  it("publishBatch sends all messages", async () => {
    const calls: Array<{ topic: string; msg: unknown }> = [];

    await Effect.runPromise(
      Effect.gen(function* () {
        const producer = yield* KafkaProducer;
        yield* producer.publishBatch("batch.topic", [
          { value: { id: 1 } },
          { value: { id: 2 } },
          { value: { id: 3 } },
        ]);
      }).pipe(
        Effect.provide(
          makeStubProducerLayer((topic, msg) => calls.push({ topic, msg }))
        )
      )
    );

    expect(calls).toHaveLength(1);
    expect(calls[0]?.topic).toBe("batch.topic");
    expect(Array.isArray(calls[0]?.msg)).toBe(true);
  });

  it("failing publish propagates KafkaPublishError", async () => {
    const failingLayer = Layer.succeed(KafkaProducer, {
      publish: (topic) =>
        Effect.fail(new KafkaPublishError({ topic, message: "broker down" })),
      publishBatch: (topic) =>
        Effect.fail(new KafkaPublishError({ topic, message: "broker down" })),
    });

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const producer = yield* KafkaProducer;
        return yield* producer.publish("fail.topic", {});
      }).pipe(Effect.provide(failingLayer), Effect.either)
    );

    expect(result._tag).toBe("Left");
    if (result._tag === "Left") {
      expect(result.left._tag).toBe("KafkaPublishError");
    }
  });
});

// ── KafkaConsumer (stub layer) ────────────────────────────────────────────────

const makeStubConsumerLayer = (): Layer.Layer<KafkaConsumer> =>
  Layer.succeed(KafkaConsumer, {
    stream: (_topics) => {
      // Return empty stream for testing
      const { Stream } = require("effect");
      return Stream.empty;
    },
    subscribe: (_topics, _handler) =>
      // In tests, subscribe immediately returns void (no real Kafka)
      Effect.void,
  } satisfies KafkaConsumerShape);

describe("KafkaConsumer (stub)", () => {
  it("subscribe returns void when no messages arrive", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const consumer = yield* KafkaConsumer;
        yield* consumer.subscribe(["order.placed"], () => Effect.void);
        return "ok";
      }).pipe(Effect.provide(makeStubConsumerLayer()))
    );
    expect(result).toBe("ok");
  });
});

// ── Error types ───────────────────────────────────────────────────────────────

describe("Kafka error types", () => {
  it("KafkaPublishError has correct _tag", () => {
    const err = new KafkaPublishError({ topic: "t", message: "m" });
    expect(err._tag).toBe("KafkaPublishError");
    expect(err.topic).toBe("t");
    expect(err.message).toBe("m");
  });

  it("KafkaConsumeError has correct _tag", () => {
    const err = new KafkaConsumeError({ topic: "t", message: "m" });
    expect(err._tag).toBe("KafkaConsumeError");
  });
});
