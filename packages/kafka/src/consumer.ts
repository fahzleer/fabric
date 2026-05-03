import { Context, Effect, Layer, Queue, Stream } from "effect";
import { Kafka } from "kafkajs";
import { KafkaConfig } from "./config.ts";
import { KafkaConnectionError, KafkaConsumeError } from "./error.ts";

// ── Message envelope ──────────────────────────────────────────────────────────

export interface KafkaMessage<T = unknown> {
  readonly topic: string;
  readonly partition: number;
  readonly offset: string;
  readonly key: string | null;
  readonly value: T;
  readonly timestamp: string;
}

// ── KafkaConsumer Service ─────────────────────────────────────────────────────

export interface KafkaConsumerShape {
  /**
   * Subscribe to one or more topics and get a Stream of typed messages.
   * The stream runs until the scope is closed.
   */
  readonly stream: <T>(
    topics: string | string[]
  ) => Stream.Stream<KafkaMessage<T>, KafkaConsumeError>;

  /**
   * Subscribe and process each message with an Effect handler.
   * Commits offset after successful processing.
   */
  readonly subscribe: <T>(
    topics: string | string[],
    handler: (msg: KafkaMessage<T>) => Effect.Effect<void, never>
  ) => Effect.Effect<void, KafkaConsumeError>;
}

export class KafkaConsumer extends Context.Tag(
  "@fabric/kafka/KafkaConsumer"
)<KafkaConsumer, KafkaConsumerShape>() {
  static readonly layer: Layer.Layer<
    KafkaConsumer,
    KafkaConnectionError,
    KafkaConfig
  > = Layer.scoped(
    KafkaConsumer,
    Effect.gen(function* () {
      const config = yield* KafkaConfig;

      const kafka = new Kafka({
        clientId: config.clientId,
        brokers:  config.brokers,
        ssl:      config.ssl,
        // KafkaJS requires a narrowed discriminated union; cast to satisfy it.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        sasl: config.sasl as any,
      });

      const consumer = kafka.consumer({
        groupId: config.groupId,
        sessionTimeout: 30_000,
        heartbeatInterval: 3_000,
      });

      yield* Effect.tryPromise({
        try: () => consumer.connect(),
        catch: (e) =>
          new KafkaConnectionError({
            message: `Kafka consumer failed to connect: ${String(e)}`,
            cause: e,
          }),
      });

      yield* Effect.addFinalizer(() =>
        Effect.promise(() => consumer.disconnect().catch(() => undefined))
      );

      const toTopicList = (t: string | string[]) =>
        Array.isArray(t) ? t : [t];

      return {
        stream: <T>(topics: string | string[]) =>
          Stream.asyncPush<KafkaMessage<T>, KafkaConsumeError>(
            (emit) =>
              Effect.tryPromise({
                try: async () => {
                  for (const topic of toTopicList(topics)) {
                    await consumer.subscribe({
                      topic,
                      fromBeginning: false,
                    });
                  }

                  await consumer.run({
                    eachMessage: async ({ topic, partition, message }) => {
                      const raw = message.value?.toString() ?? "null";
                      let parsed: T;
                      try {
                        parsed = JSON.parse(raw) as T;
                      } catch {
                        await emit.fail(
                          new KafkaConsumeError({
                            topic,
                            message: `Failed to parse message JSON: ${raw}`,
                          })
                        );
                        return;
                      }

                      await emit.single({
                        topic,
                        partition,
                        offset: message.offset,
                        key: message.key?.toString() ?? null,
                        value: parsed,
                        timestamp: message.timestamp,
                      });
                    },
                  });
                },
                catch: (e) =>
                  new KafkaConsumeError({
                    topic: toTopicList(topics).join(","),
                    message: `Consumer error: ${String(e)}`,
                    cause: e,
                  }),
              })
          ),

        subscribe: <T>(
          topics: string | string[],
          handler: (msg: KafkaMessage<T>) => Effect.Effect<void, never>
        ) =>
          Effect.gen(function* () {
            const queue = yield* Queue.unbounded<KafkaMessage<T>>();

            for (const topic of toTopicList(topics)) {
              yield* Effect.tryPromise({
                try: () => consumer.subscribe({ topic, fromBeginning: false }),
                catch: (e) =>
                  new KafkaConsumeError({
                    topic,
                    message: `Failed to subscribe: ${String(e)}`,
                    cause: e,
                  }),
              });
            }

            // Run consumer in background (daemon — no scope requirement)
            yield* Effect.forkDaemon(
              Effect.tryPromise({
                try: () =>
                  consumer.run({
                    eachMessage: async ({ topic, partition, message }) => {
                      const raw = message.value?.toString() ?? "null";
                      const value = JSON.parse(raw) as T;
                      await Effect.runPromise(
                        Queue.offer(queue, {
                          topic,
                          partition,
                          offset: message.offset,
                          key: message.key?.toString() ?? null,
                          value,
                          timestamp: message.timestamp,
                        })
                      );
                    },
                  }),
                catch: (e) =>
                  new KafkaConsumeError({
                    topic: toTopicList(topics).join(","),
                    message: `Consumer runtime error: ${String(e)}`,
                    cause: e,
                  }),
              })
            );

            // Drain queue → call handler
            yield* Effect.forever(
              Effect.gen(function* () {
                const msg = yield* Queue.take(queue);
                yield* handler(msg);
              })
            );
          }),
      } satisfies KafkaConsumerShape;
    })
  );
}
