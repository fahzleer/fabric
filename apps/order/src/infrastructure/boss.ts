import { Context, Effect, Layer } from "effect";
import { PgBoss, fromKysely } from "pg-boss";
import { Database } from "./db/database.ts";

export { fromKysely };

export class Boss extends Context.Tag("@fabric/order/Boss")<Boss, PgBoss>() {
  static readonly layer: Layer.Layer<Boss, never, Database> = Layer.scoped(
    Boss,
    Effect.gen(function* () {
      const db = yield* Database;

      const boss = new PgBoss({ db: fromKysely(db) });

      yield* Effect.promise(() => boss.start());

      yield* Effect.addFinalizer(() =>
        Effect.promise(() => boss.stop({ graceful: true }).catch(() => undefined))
      );

      return boss;
    })
  );
}
