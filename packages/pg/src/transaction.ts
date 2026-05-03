import { Context, Effect } from "effect";
import { type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { PgDatabase } from "./database.ts";
import { PgTransactionError } from "./error.ts";

/**
 * Run an Effect inside a PostgreSQL transaction.
 * Commits on success, rolls back on any failure.
 *
 * @example
 * const result = yield* withTransaction(
 *   Effect.gen(function* () {
 *     const db = yield* PgDatabase;
 *     yield* Effect.promise(() => db.insert(orders).values(order));
 *     yield* Effect.promise(() => db.update(inventory).set(...));
 *     return order;
 *   })
 * );
 */
export const withTransaction = <A, E>(
  effect: Effect.Effect<A, E, PgDatabase>
): Effect.Effect<A, E | PgTransactionError, PgDatabase> =>
  // biome-ignore lint/suspicious/noExplicitAny: drizzle transaction typing is complex
  (Effect.gen(function* () {
    const db = yield* PgDatabase;

    return yield* Effect.tryPromise({
      try: () =>
        // drizzle's transaction wraps in BEGIN/COMMIT/ROLLBACK
        // biome-ignore lint/suspicious/noExplicitAny: drizzle transaction typing is complex
        (db as any).transaction(async (tx: unknown) => {
          // Provide the tx as PgDatabase inside the transaction scope
          return Effect.runPromise(
            Effect.provide(
              effect,
              // biome-ignore lint/suspicious/noExplicitAny: tx is the drizzle transaction object
              Context.make(PgDatabase, tx as PostgresJsDatabase<any>)
            )
          );
        }),
      catch: (e) =>
        new PgTransactionError({
          message: `Transaction failed: ${String(e)}`,
          cause:   e,
        }),
    });
  // biome-ignore lint/suspicious/noExplicitAny: Effect.gen return type is correct at runtime
  }) as any) as Effect.Effect<A, E | PgTransactionError, PgDatabase>;
