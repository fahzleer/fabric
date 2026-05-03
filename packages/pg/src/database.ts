import { Context, Effect, Layer } from "effect";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { PgConnectionError, PgQueryError } from "./error.ts";

// ── Config ────────────────────────────────────────────────────────────────────

export interface PgConfig {
  readonly url:      string;
  readonly maxPool?: number;
  readonly ssl?:     boolean;
  readonly schema?:  string;       // Postgres search_path schema name
}

export class PgDatabase extends Context.Tag("@fabric/pg/PgDatabase")<
  PgDatabase,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  PostgresJsDatabase<any>
>() {
  /**
   * Build a scoped Layer from a PgConfig.
   * Acquires a postgres connection pool, releases on scope end.
   *
   * @example
   * const DbLayer = PgDatabase.layer({
   *   url:      process.env.DATABASE_URL!,
   *   maxPool:  10,
   *   schema:   "orders",
   * });
   */
  static layer(config: PgConfig): Layer.Layer<PgDatabase, PgConnectionError> {
    return Layer.scoped(
      PgDatabase,
      Effect.gen(function* () {
        const opts = {
          max:         config.maxPool ?? 10,
          ssl:         config.ssl ? ("require" as const) : undefined,
          onnotice:    () => undefined,
          // scope connection to named schema if provided
          connection:  config.schema
            ? { search_path: config.schema }
            : undefined,
        };

        let client: ReturnType<typeof postgres>;

        yield* Effect.tryPromise({
          try: async () => {
            client = postgres(config.url, opts);
            // Test connection eagerly so we fail fast on misconfiguration
            await client`SELECT 1`;
          },
          catch: (e) =>
            new PgConnectionError({
              message: `PostgreSQL connection failed: ${String(e)}`,
              cause:   e,
            }),
        });

        yield* Effect.addFinalizer(() =>
          Effect.promise(() => client.end({ timeout: 5 }).catch(() => undefined))
        );

        return drizzle(client!);
      })
    );
  }

  /**
   * Build a Layer from DATABASE_URL env var.
   */
  static fromEnv(
    overrides?: Partial<PgConfig>
  ): Layer.Layer<PgDatabase, PgConnectionError> {
    return PgDatabase.layer({
      url:     process.env["DATABASE_URL"] ?? "postgres://localhost:5432/fabric",
      maxPool: 10,
      ...overrides,
    });
  }
}

// ── Raw sql helper ────────────────────────────────────────────────────────────

/**
 * Run a raw SQL string against the injected PgDatabase.
 * Returns rows as unknown[].
 */
export const rawQuery = (
  query: string,
  params: unknown[] = []
): Effect.Effect<unknown[], PgQueryError, PgDatabase> =>
  Effect.gen(function* () {
    const db = yield* PgDatabase;
    return yield* Effect.tryPromise({
      // drizzle exposes the underlying sql client via .$client
      // biome-ignore lint/suspicious/noExplicitAny: postgres client not typed via drizzle
      try:   () => (db as any).$client.unsafe(query, params) as Promise<unknown[]>,
      catch: (e) =>
        new PgQueryError({
          message: `Query failed: ${String(e)}`,
          query,
          cause:   e,
        }),
    });
  });
