import { Context, Effect, Layer } from "effect";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.ts";

export type Db = PostgresJsDatabase<typeof schema>;

export class Database extends Context.Tag("@fabric/customer/Database")<Database, Db>() {
  static readonly layer = (url?: string): Layer.Layer<Database> =>
    Layer.scoped(
      Database,
      Effect.gen(function* () {
        const connectionUrl =
          url ?? process.env["DATABASE_URL"] ?? "postgres://localhost:5432/fabric_customers";
        const client = postgres(connectionUrl, { max: 10 });
        yield* Effect.addFinalizer(() =>
          Effect.promise(() => client.end({ timeout: 5 }).catch(() => undefined))
        );
        return drizzle(client, { schema });
      })
    );
}
