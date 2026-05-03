import { Effect } from "effect";
import { PgDatabase } from "./database.ts";
import { PgMigrationError } from "./error.ts";

/**
 * Run Drizzle migrations from a given folder.
 * Use in your service's startup script.
 *
 * @example
 * await Effect.runPromise(
 *   migrate("./src/infrastructure/db/migrations").pipe(
 *     Effect.provide(PgDatabase.fromEnv())
 *   )
 * );
 */
export const migrate = (
  migrationsFolder: string
): Effect.Effect<void, PgMigrationError, PgDatabase> =>
  Effect.gen(function* () {
    const db = yield* PgDatabase;

    yield* Effect.tryPromise({
      try: async () => {
        // Dynamic import to keep drizzle-kit out of production bundle
        const { migrate: drizzleMigrate } = await import("drizzle-orm/postgres-js/migrator");
        await drizzleMigrate(db, { migrationsFolder });
      },
      catch: (e) =>
        new PgMigrationError({
          message: `Migration failed: ${String(e)}`,
          cause:   e,
        }),
    });
  });
