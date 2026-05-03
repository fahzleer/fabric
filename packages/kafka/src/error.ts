import { Data } from "effect";

// ── Typed Kafka errors ────────────────────────────────────────────────────────

export class KafkaConnectionError extends Data.TaggedError(
  "KafkaConnectionError"
)<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class KafkaPublishError extends Data.TaggedError("KafkaPublishError")<{
  readonly topic: string;
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class KafkaConsumeError extends Data.TaggedError("KafkaConsumeError")<{
  readonly topic: string;
  readonly message: string;
  readonly cause?: unknown;
}> {}

export type KafkaError =
  | KafkaConnectionError
  | KafkaPublishError
  | KafkaConsumeError;
