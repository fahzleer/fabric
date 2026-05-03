import { Context } from "effect";

// ── KafkaConfig — injected via Layer ─────────────────────────────────────────

export interface KafkaConfigShape {
  readonly brokers: string[];
  readonly clientId: string;
  readonly groupId: string;
  readonly ssl?: boolean;
  readonly sasl?: {
    readonly mechanism: "plain" | "scram-sha-256" | "scram-sha-512";
    readonly username: string;
    readonly password: string;
  };
}

export class KafkaConfig extends Context.Tag("@fabric/kafka/KafkaConfig")<
  KafkaConfig,
  KafkaConfigShape
>() {
  // Convenience: build config from env vars
  static fromEnv(): KafkaConfigShape {
    return {
      brokers: (process.env["KAFKA_BROKERS"] ?? "localhost:9092").split(","),
      clientId: process.env["KAFKA_CLIENT_ID"] ?? "fabric",
      groupId: process.env["KAFKA_GROUP_ID"] ?? "fabric-group",
      ssl: process.env["KAFKA_SSL"] === "true",
    };
  }
}
