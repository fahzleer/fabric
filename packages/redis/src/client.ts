import { Context, Effect, Layer } from "effect";
import Redis, { type RedisOptions } from "ioredis";
import { RedisConnectionError } from "./error.ts";

// ── Config ────────────────────────────────────────────────────────────────────

export interface RedisConfig {
  readonly url?:          string;
  readonly host?:         string;
  readonly port?:         number;
  readonly password?:     string;
  readonly db?:           number;
  readonly keyPrefix?:    string;
  readonly lazyConnect?:  boolean;
}

// ── RedisClient Service ───────────────────────────────────────────────────────

export class RedisClient extends Context.Tag("@fabric/redis/RedisClient")<
  RedisClient,
  Redis
>() {
  /**
   * Build a scoped Layer from a RedisConfig.
   * Connects eagerly, disconnects on scope end.
   *
   * @example
   * const RedisLayer = RedisClient.layer({ url: "redis://localhost:6379" });
   */
  static layer(config: RedisConfig): Layer.Layer<RedisClient, RedisConnectionError> {
    return Layer.scoped(
      RedisClient,
      Effect.gen(function* () {
        const opts: RedisOptions = {
          host:       config.host ?? "localhost",
          port:       config.port ?? 6379,
          password:   config.password,
          db:         config.db ?? 0,
          keyPrefix:  config.keyPrefix,
          lazyConnect: config.lazyConnect ?? false,
          enableAutoPipelining: true,
          maxRetriesPerRequest: 3,
        };

        const client = config.url ? new Redis(config.url, opts) : new Redis(opts);

        yield* Effect.tryPromise({
          try:   () => client.ping().then(() => undefined),
          catch: (e) =>
            new RedisConnectionError({
              message: `Redis connection failed: ${String(e)}`,
              cause:   e,
            }),
        });

        yield* Effect.addFinalizer(() =>
          Effect.promise(() => client.quit().catch(() => undefined))
        );

        return client;
      })
    );
  }

  /**
   * Build a Layer from REDIS_URL env var.
   */
  static fromEnv(
    overrides?: Partial<RedisConfig>
  ): Layer.Layer<RedisClient, RedisConnectionError> {
    return RedisClient.layer({
      url: process.env["REDIS_URL"] ?? "redis://localhost:6379",
      ...overrides,
    });
  }
}
