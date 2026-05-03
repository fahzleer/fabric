import { Effect } from "effect";
import { RedisClient } from "./client.ts";
import { RedisLockError } from "./error.ts";

// ── Distributed lock (Redlock-lite) ──────────────────────────────────────────
//
// Simple single-node SET NX EX lock.
// For multi-node Redlock, use the full redlock library.

/**
 * Acquire a distributed lock. Returns a release function.
 * Throws RedisLockError if the lock is already held.
 *
 * @example
 * yield* withLock("payment:order-123", 10, Effect.gen(function* () {
 *   // exclusive section
 * }));
 */
export const acquireLock = (
  key:        string,
  ttlSeconds: number
): Effect.Effect<() => Effect.Effect<void, never, RedisClient>, RedisLockError, RedisClient> =>
  Effect.gen(function* () {
    const client  = yield* RedisClient;
    const lockKey = `lock:${key}`;
    const token   = crypto.randomUUID();

    const acquired = yield* Effect.tryPromise({
      try:   () => client.set(lockKey, token, "EX", ttlSeconds, "NX"),
      catch: () => new RedisLockError({ key, message: "Redis error during lock acquire" }),
    });

    if (!acquired) {
      return yield* Effect.fail(
        new RedisLockError({ key, message: `Lock already held: ${key}` })
      );
    }

    // Release: only delete if token matches (prevents releasing someone else's lock)
    const release = () =>
      Effect.gen(function* () {
        const client2 = yield* RedisClient;
        const script  = `
          if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
          else
            return 0
          end
        `;
        yield* Effect.tryPromise({
          try:   () => client2.eval(script, 1, lockKey, token),
          catch: () => undefined,
        }).pipe(Effect.catchAll(() => Effect.void));
      });

    return release;
  });

/**
 * Run an Effect inside a distributed lock, automatically releasing on completion.
 */
export const withLock = <A, E>(
  key:        string,
  ttlSeconds: number,
  effect:     Effect.Effect<A, E, RedisClient>
): Effect.Effect<A, E | RedisLockError, RedisClient> =>
  Effect.gen(function* () {
    const release = yield* acquireLock(key, ttlSeconds);
    const result  = yield* effect.pipe(
      Effect.onExit(() => release())
    );
    return result;
  });
