import { Effect } from "effect";
import { RedisClient } from "./client.ts";
import { RedisCommandError } from "./error.ts";

// ── JSON-aware cache helpers ───────────────────────────────────────────────────

/**
 * Get a JSON-serialised value from Redis.
 * Returns `null` if the key does not exist.
 */
export const cacheGet = <T>(
  key: string
): Effect.Effect<T | null, RedisCommandError, RedisClient> =>
  Effect.gen(function* () {
    const client = yield* RedisClient;
    return yield* Effect.tryPromise({
      try: async () => {
        const raw = await client.get(key);
        return raw ? (JSON.parse(raw) as T) : null;
      },
      catch: (e) =>
        new RedisCommandError({ command: "GET", message: String(e), cause: e }),
    });
  });

/**
 * Set a JSON-serialised value in Redis.
 *
 * @param ttlSeconds - optional TTL; omit for no expiry
 */
export const cacheSet = <T>(
  key:        string,
  value:      T,
  ttlSeconds?: number
): Effect.Effect<void, RedisCommandError, RedisClient> =>
  Effect.gen(function* () {
    const client = yield* RedisClient;
    yield* Effect.tryPromise({
      try: async () => {
        const serialised = JSON.stringify(value);
        if (ttlSeconds) {
          await client.setex(key, ttlSeconds, serialised);
        } else {
          await client.set(key, serialised);
        }
      },
      catch: (e) =>
        new RedisCommandError({ command: "SET", message: String(e), cause: e }),
    });
  });

/**
 * Delete a key.
 */
export const cacheDel = (
  key: string
): Effect.Effect<void, RedisCommandError, RedisClient> =>
  Effect.gen(function* () {
    const client = yield* RedisClient;
    yield* Effect.tryPromise({
      try:   () => client.del(key).then(() => undefined),
      catch: (e) =>
        new RedisCommandError({ command: "DEL", message: String(e), cause: e }),
    });
  });

/**
 * Get-or-set pattern: return cached value, or compute + cache it.
 */
export const cacheGetOrSet = <T>(
  key:        string,
  compute:    () => Promise<T>,
  ttlSeconds?: number
): Effect.Effect<T, RedisCommandError, RedisClient> =>
  Effect.gen(function* () {
    const cached = yield* cacheGet<T>(key);
    if (cached !== null) return cached;

    const value = yield* Effect.tryPromise({
      try:   compute,
      catch: (e) =>
        new RedisCommandError({
          command: "compute",
          message: `Cache compute failed: ${String(e)}`,
          cause:   e,
        }),
    });

    yield* cacheSet(key, value, ttlSeconds);
    return value;
  });

/**
 * Increment a counter. Returns new value.
 */
export const cacheIncr = (
  key: string
): Effect.Effect<number, RedisCommandError, RedisClient> =>
  Effect.gen(function* () {
    const client = yield* RedisClient;
    return yield* Effect.tryPromise({
      try:   () => client.incr(key),
      catch: (e) =>
        new RedisCommandError({ command: "INCR", message: String(e), cause: e }),
    });
  });

/**
 * Set TTL (expire) on an existing key.
 */
export const cacheExpire = (
  key:        string,
  ttlSeconds: number
): Effect.Effect<void, RedisCommandError, RedisClient> =>
  Effect.gen(function* () {
    const client = yield* RedisClient;
    yield* Effect.tryPromise({
      try:   () => client.expire(key, ttlSeconds).then(() => undefined),
      catch: (e) =>
        new RedisCommandError({ command: "EXPIRE", message: String(e), cause: e }),
    });
  });
