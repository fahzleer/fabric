import { Data } from "effect";

export class PgConnectionError extends Data.TaggedError("PgConnectionError")<{
  readonly message: string;
  readonly cause?:  unknown;
}> {}

export class PgQueryError extends Data.TaggedError("PgQueryError")<{
  readonly message: string;
  readonly query?:  string;
  readonly cause?:  unknown;
}> {}

export class PgTransactionError extends Data.TaggedError("PgTransactionError")<{
  readonly message: string;
  readonly cause?:  unknown;
}> {}

export class PgMigrationError extends Data.TaggedError("PgMigrationError")<{
  readonly message: string;
  readonly cause?:  unknown;
}> {}
