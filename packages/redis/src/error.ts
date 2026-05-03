import { Data } from "effect";

export class RedisConnectionError extends Data.TaggedError("RedisConnectionError")<{
  readonly message: string;
  readonly cause?:  unknown;
}> {}

export class RedisCommandError extends Data.TaggedError("RedisCommandError")<{
  readonly command: string;
  readonly message: string;
  readonly cause?:  unknown;
}> {}

export class RedisLockError extends Data.TaggedError("RedisLockError")<{
  readonly key:     string;
  readonly message: string;
}> {}
