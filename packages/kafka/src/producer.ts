import { Context, Effect, Layer } from "effect";
import { Kafka } from "kafkajs";
import { KafkaConfig } from "./config.ts";
import { KafkaConnectionError, KafkaPublishError } from "./error.ts";

// ── KafkaProducer Service ─────────────────────────────────────────────────────

export interface KafkaProducerShape {
  /**
   * Publish a single message to a topic.
   * Message is JSON-serialised automatically.
   */
  readonly publish: <T>(
    topic: string,
    message: T,
    opts?: { key?: string }
  ) => Effect.Effect<void, KafkaPublishError>;

  /**
   * Publish multiple messages to the same topic in one batch.
   */
  readonly publishBatch: <T>(
    topic: string,
    messages: Array<{ value: T; key?: string }>
  ) => Effect.Effect<void, KafkaPublishError>;
}

export class KafkaProducer extends Context.Tag(
  "@fabric/kafka/KafkaProducer"
)<KafkaProducer, KafkaProducerShape>() {
  // ── Layer: acquire producer, release on scope end ─────────────────────────
  static readonly layer: Layer.Layer<
    KafkaProducer,
    KafkaConnectionError,
    KafkaConfig
  > = Layer.scoped(
    KafkaProducer,
    Effect.gen(function* () {
      const config = yield* KafkaConfig;

      const kafka = new Kafka({
        clientId: config.clientId,
        brokers:  config.brokers,
        ssl:      config.ssl,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        sasl:     config.sasl as any,
      });

      const producer = kafka.producer({
        allowAutoTopicCreation: false,
        idempotent: true,           // exactly-once semantics
        maxInFlightRequests: 5,
      });

      // Connect — fail fast with typed error
      yield* Effect.tryPromise({
        try: () => producer.connect(),
        catch: (e) =>
          new KafkaConnectionError({
            message: `Kafka producer failed to connect: ${String(e)}`,
            cause: e,
          }),
      });

      // Disconnect when scope closes (app shutdown / test cleanup)
      yield* Effect.addFinalizer(() =>
        Effect.promise(() => producer.disconnect().catch(() => undefined))
      );

      // Return the service implementation
      return {
        publish: <T>(
          topic: string,
          message: T,
          opts?: { key?: string }
        ) =>
          Effect.tryPromise({
            try: () =>
              producer.send({
                topic,
                messages: [
                  {
                    key: opts?.key,
                    value: JSON.stringify(message),
                  },
                ],
              }),
            catch: (e) =>
              new KafkaPublishError({
                topic,
                message: `Failed to publish to ${topic}: ${String(e)}`,
                cause: e,
              }),
          }).pipe(Effect.asVoid),

        publishBatch: <T>(
          topic: string,
          messages: Array<{ value: T; key?: string }>
        ) =>
          Effect.tryPromise({
            try: () =>
              producer.send({
                topic,
                messages: messages.map((m) => ({
                  key: m.key,
                  value: JSON.stringify(m.value),
                })),
              }),
            catch: (e) =>
              new KafkaPublishError({
                topic,
                message: `Failed to publish batch to ${topic}: ${String(e)}`,
                cause: e,
              }),
          }).pipe(Effect.asVoid),
      } satisfies KafkaProducerShape;
    })
  );
}
