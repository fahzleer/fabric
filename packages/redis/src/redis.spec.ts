import { describe, expect, it } from "bun:test";
import { Effect, Exit, Layer } from "effect";
import { RedisCommandError, RedisConnectionError, RedisLockError } from "./error.ts";
import { cacheGet, cacheDel, cacheSet, cacheGetOrSet, cacheIncr } from "./cache.ts";
import { acquireLock, withLock } from "./lock.ts";
import { RedisClient } from "./client.ts";

// ── Error constructors ────────────────────────────────────────────────────────

describe("RedisConnectionError", () => {
  it("has correct _tag", () => {
    const err = new RedisConnectionError({ message: "conn refused" });
    expect(err._tag).toBe("RedisConnectionError");
    expect(err.message).toBe("conn refused");
  });
});

describe("RedisCommandError", () => {
  it("has correct _tag and command", () => {
    const err = new RedisCommandError({ command: "GET", message: "timeout" });
    expect(err._tag).toBe("RedisCommandError");
    expect(err.command).toBe("GET");
  });
});

describe("RedisLockError", () => {
  it("has correct _tag and key", () => {
    const err = new RedisLockError({ key: "my-lock", message: "already held" });
    expect(err._tag).toBe("RedisLockError");
    expect(err.key).toBe("my-lock");
  });
});

// ── Stub Redis layer ──────────────────────────────────────────────────────────

const makeStubRedis = () => {
  const store = new Map<string, { value: string; expireAt?: number }>();

  const checkExpiry = (key: string) => {
    const entry = store.get(key);
    if (entry && entry.expireAt && Date.now() > entry.expireAt) {
      store.delete(key);
      return undefined;
    }
    return entry;
  };

  return {
    get: async (key: string) => checkExpiry(key)?.value ?? null,
    set: async (key: string, value: string, ...args: unknown[]) => {
      const argList = args as (string | number)[];
      let ex: number | undefined;
      let nx = false;
      for (let i = 0; i < argList.length; i++) {
        if (String(argList[i]).toUpperCase() === "EX") ex = Number(argList[i + 1]);
        if (String(argList[i]).toUpperCase() === "NX") nx = true;
      }
      if (nx && store.has(key)) return null;
      store.set(key, {
        value,
        expireAt: ex ? Date.now() + ex * 1000 : undefined,
      });
      return "OK";
    },
    setex: async (key: string, seconds: number, value: string) => {
      store.set(key, { value, expireAt: Date.now() + seconds * 1000 });
      return "OK";
    },
    del: async (...keys: string[]) => {
      let count = 0;
      for (const k of keys) { if (store.delete(k)) count++; }
      return count;
    },
    incr: async (key: string) => {
      const entry = checkExpiry(key);
      const val   = entry ? Number(entry.value) + 1 : 1;
      store.set(key, { value: String(val) });
      return val;
    },
    expire: async (key: string, seconds: number) => {
      const entry = store.get(key);
      if (!entry) return 0;
      entry.expireAt = Date.now() + seconds * 1000;
      return 1;
    },
    eval: async (_script: string, _numkeys: number, key: string, token: string) => {
      const entry = store.get(key);
      if (entry?.value === token) { store.delete(key); return 1; }
      return 0;
    },
    ping: async () => "PONG",
    quit: async () => "OK",
  } as unknown as import("ioredis").default;
};

const StubRedisLayer = Layer.succeed(RedisClient, makeStubRedis());

const run = <A, E>(effect: Effect.Effect<A, E, RedisClient>) =>
  Effect.runPromise(Effect.provide(effect, StubRedisLayer));

const runExit = <A, E>(effect: Effect.Effect<A, E, RedisClient>) =>
  Effect.runPromiseExit(Effect.provide(effect, StubRedisLayer));

// ── cacheGet / cacheSet / cacheDel ────────────────────────────────────────────

describe("cacheSet / cacheGet", () => {
  it("round-trips a JSON value", async () => {
    await run(cacheSet("user:1", { name: "Saifah" }, 60));
    const result = await run(cacheGet<{ name: string }>("user:1"));
    expect(result).toEqual({ name: "Saifah" });
  });

  it("returns null for missing key", async () => {
    const result = await run(cacheGet("missing:key"));
    expect(result).toBeNull();
  });

  it("set without TTL works", async () => {
    await run(cacheSet("k1", 42));
    const result = await run(cacheGet<number>("k1"));
    expect(result).toBe(42);
  });
});

describe("cacheDel", () => {
  it("deletes an existing key", async () => {
    await run(cacheSet("del:key", "value"));
    await run(cacheDel("del:key"));
    const result = await run(cacheGet("del:key"));
    expect(result).toBeNull();
  });
});

// ── cacheGetOrSet ─────────────────────────────────────────────────────────────

describe("cacheGetOrSet", () => {
  it("calls compute when key missing", async () => {
    let calls = 0;
    const result = await run(
      cacheGetOrSet("compute:key", async () => { calls++; return "computed"; }, 60)
    );
    expect(result).toBe("computed");
    expect(calls).toBe(1);
  });

  it("uses cached value on second call", async () => {
    let calls = 0;
    const compute = async () => { calls++; return "value"; };
    await run(cacheGetOrSet("cached:key2", compute, 60));
    await run(cacheGetOrSet("cached:key2", compute, 60));
    expect(calls).toBe(1);
  });
});

// ── cacheIncr ─────────────────────────────────────────────────────────────────

describe("cacheIncr", () => {
  it("starts at 1 for missing key", async () => {
    const result = await run(cacheIncr("counter:1"));
    expect(result).toBe(1);
  });

  it("increments existing counter", async () => {
    await run(cacheIncr("counter:2"));
    await run(cacheIncr("counter:2"));
    const result = await run(cacheIncr("counter:2"));
    expect(result).toBe(3);
  });
});

// ── acquireLock / withLock ────────────────────────────────────────────────────

describe("acquireLock", () => {
  it("acquires lock and releases it", async () => {
    const release = await run(acquireLock("test-lock", 10));
    expect(typeof release).toBe("function");
    await run(release());
  });

  it("fails when lock is already held", async () => {
    // Acquire and hold (don't release)
    await run(acquireLock("held-lock", 30));

    const exit = await runExit(acquireLock("held-lock", 30));
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const cause = exit.cause;
      // The cause wraps a RedisLockError
      expect(String(cause)).toContain("RedisLockError");
    }
  });
});

describe("withLock", () => {
  it("runs effect inside lock and returns result", async () => {
    const result = await run(
      withLock("work-lock", 10, Effect.succeed("done"))
    );
    expect(result).toBe("done");
  });

  it("releases lock even on failure", async () => {
    const exit = await runExit(
      withLock("fail-lock", 10, Effect.fail(new RedisCommandError({
        command: "FAIL",
        message: "intentional",
      })))
    );
    expect(Exit.isFailure(exit)).toBe(true);

    // Lock should be released — we can acquire it again
    const result = await run(withLock("fail-lock", 10, Effect.succeed("recovered")));
    expect(result).toBe("recovered");
  });
});
