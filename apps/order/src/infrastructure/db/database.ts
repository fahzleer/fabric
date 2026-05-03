import { Context, Effect, Layer } from "effect";
import { Kysely, PostgresDialect } from "kysely";
import pg from "pg";
import type { FabricOrdersDatabase } from "./types.ts";

export type Db = Kysely<FabricOrdersDatabase>;

export class Database extends Context.Tag("@fabric/order/Database")<Database, Db>() {
  static readonly layer = (url?: string): Layer.Layer<Database> =>
    Layer.scoped(
      Database,
      Effect.gen(function* () {
        const connectionString =
          url ??
          process.env["DATABASE_URL"] ??
          "postgresql://postgres:postgres@localhost:5432/fabric_orders";

        const pool = new pg.Pool({ connectionString, max: 10 });
        const db   = new Kysely<FabricOrdersDatabase>({
          dialect: new PostgresDialect({ pool }),
        });

        yield* Effect.addFinalizer(() =>
          Effect.promise(() => pool.end().catch(() => undefined))
        );

        return db;
      })
    );
}
