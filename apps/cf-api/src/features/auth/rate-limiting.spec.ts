import { describe, expect, mock, test } from "bun:test";
import type { MemcachedAdapter } from "@fabric/cache";
import type { Context } from "hono";
import { throttle } from "../../infrastructure/guards/auth.middleware";

type MockCtx = Context & {
  _headers: Record<string, string>;
  _jsonResult: () => { data: unknown; status: number } | undefined;
};

function makeMockCache(incrementReturn: number | null = 1): MemcachedAdapter {
  return {
    increment: mock(async (_key: string, _ttl: number) => incrementReturn),
    get: mock(async () => null),
    set: mock(async () => undefined),
    del: mock(async () => undefined),
    getOrSet: mock(async (_key: string, fetcher: () => Promise<unknown>) => fetcher()),
    delMulti: mock(async () => undefined),
    end: mock(() => undefined),
  } as unknown as MemcachedAdapter;
}

function makeCtx(opts: { ip?: string; forwardedFor?: string; path?: string } = {}): MockCtx {
  const responseHeaders: Record<string, string> = {};
  let jsonResult: { data: unknown; status: number } | undefined;

  const ctx = {
    req: {
      header: (name: string) => {
        if (name === "x-real-ip") return opts.ip;
        if (name === "x-forwarded-for") return opts.forwardedFor;
        return undefined;
      },
      path: opts.path ?? "/auth/login",
    },
    header: (name: string, value: string) => {
      responseHeaders[name] = value;
    },
    json: (data: unknown, status: number) => {
      jsonResult = { data, status };
      return jsonResult as unknown as Response;
    },
    _headers: responseHeaders,
    _jsonResult: () => jsonResult,
  };
  return ctx as unknown as MockCtx;
}

describe("throttle middleware — pass-through under limit", () => {
  test("1. first request (count=1) → passes through, calls next()", async () => {
    const cache = makeMockCache(1);
    const middleware = throttle(cache, { limit: 10, windowMs: 60_000 });
    const ctx = makeCtx({ ip: "1.2.3.4" });
    let nextCalled = false;

    await middleware(ctx, async () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
    expect(ctx._jsonResult()).toBeUndefined();
  });

  test("2. count=10 (at limit) → still passes (limit is inclusive)", async () => {
    const cache = makeMockCache(10);
    const middleware = throttle(cache, { limit: 10, windowMs: 60_000 });
    const ctx = makeCtx({ ip: "1.2.3.4" });
    let nextCalled = false;

    await middleware(ctx, async () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
    expect(ctx._jsonResult()).toBeUndefined();
  });

  test("3. sets X-RateLimit headers when count is below limit", async () => {
    const cache = makeMockCache(3);
    const middleware = throttle(cache, { limit: 10, windowMs: 60_000 });
    const ctx = makeCtx({ ip: "1.2.3.4" });

    await middleware(ctx, async () => undefined);

    expect(ctx._headers["X-RateLimit-Limit"]).toBe("10");
    expect(ctx._headers["X-RateLimit-Remaining"]).toBe("7");
  });
});

describe("throttle middleware — rate limit exceeded", () => {
  test("4. count=11 (over limit=10) → 429, next NOT called", async () => {
    const cache = makeMockCache(11);
    const middleware = throttle(cache, { limit: 10, windowMs: 60_000 });
    const ctx = makeCtx({ ip: "1.2.3.4" });
    let nextCalled = false;

    await middleware(ctx, async () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(false);
    expect(ctx._jsonResult()?.status).toBe(429);
  });

  test("5. 429 response contains _tag: RateLimitExceeded", async () => {
    const cache = makeMockCache(99);
    const middleware = throttle(cache, { limit: 10, windowMs: 60_000 });
    const ctx = makeCtx({ ip: "1.2.3.4" });

    await middleware(ctx, async () => undefined);

    const result = ctx._jsonResult();
    const data = result?.data as { _tag: string; error: string } | undefined;
    expect(result?.status).toBe(429);
    expect(data?._tag).toBe("RateLimitExceeded");
    expect(typeof data?.error).toBe("string");
  });

  test("6. 429 sets X-RateLimit-Remaining=0 and Retry-After header", async () => {
    const cache = makeMockCache(11);
    const middleware = throttle(cache, { limit: 10, windowMs: 60_000 });
    const ctx = makeCtx({ ip: "1.2.3.4" });

    await middleware(ctx, async () => undefined);

    expect(ctx._headers["X-RateLimit-Limit"]).toBe("10");
    expect(ctx._headers["X-RateLimit-Remaining"]).toBe("0");
    expect(ctx._headers["Retry-After"]).toBe("60");
  });

  test("7. windowMs=30_000 → Retry-After=30", async () => {
    const cache = makeMockCache(11);
    const middleware = throttle(cache, { limit: 5, windowMs: 30_000 });
    const ctx = makeCtx({ ip: "1.2.3.4" });

    await middleware(ctx, async () => undefined);

    expect(ctx._headers["Retry-After"]).toBe("30");
  });
});

describe("throttle middleware — fail-open on cache error", () => {
  test("8. cache returns null → fail-open (next() called, no 429)", async () => {
    const cache = makeMockCache(null);
    const middleware = throttle(cache, { limit: 10, windowMs: 60_000 });
    const ctx = makeCtx({ ip: "1.2.3.4" });
    let nextCalled = false;

    await middleware(ctx, async () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
    expect(ctx._jsonResult()).toBeUndefined();
  });

  test("8b. null count → no rate-limit headers set", async () => {
    const cache = makeMockCache(null);
    const middleware = throttle(cache, { limit: 10, windowMs: 60_000 });
    const ctx = makeCtx({ ip: "1.2.3.4" });

    await middleware(ctx, async () => undefined);

    expect(ctx._headers["X-RateLimit-Limit"]).toBeUndefined();
    expect(ctx._headers["X-RateLimit-Remaining"]).toBeUndefined();
  });
});

describe("throttle middleware — IP extraction", () => {
  test("9. prefers x-real-ip over x-forwarded-for", async () => {
    const cache = makeMockCache(1);
    const middleware = throttle(cache, { limit: 10, windowMs: 60_000 });
    const ctx = makeCtx({ ip: "1.1.1.1", forwardedFor: "2.2.2.2" });

    await middleware(ctx, async () => undefined);

    const incrementCall = (cache.increment as ReturnType<typeof mock>).mock.calls.at(0) ?? [];
    expect(incrementCall[0]).toContain("1.1.1.1");
    expect(incrementCall[0]).not.toContain("2.2.2.2");
  });

  test("10. uses first IP from x-forwarded-for when x-real-ip absent", async () => {
    const cache = makeMockCache(1);
    const middleware = throttle(cache, { limit: 10, windowMs: 60_000 });
    const ctx = makeCtx({ forwardedFor: "10.0.0.1, 10.0.0.2, 10.0.0.3" });

    await middleware(ctx, async () => undefined);

    const incrementCall = (cache.increment as ReturnType<typeof mock>).mock.calls.at(0) ?? [];
    expect(incrementCall[0]).toContain("10.0.0.1");
    expect(incrementCall[0]).not.toContain("10.0.0.2");
  });

  test('11. falls back to "unknown" when no IP header present', async () => {
    const cache = makeMockCache(1);
    const middleware = throttle(cache, { limit: 10, windowMs: 60_000 });
    const ctx = makeCtx({});

    await middleware(ctx, async () => undefined);

    const incrementCall = (cache.increment as ReturnType<typeof mock>).mock.calls.at(0) ?? [];
    expect(incrementCall[0]).toContain("unknown");
  });

  test("12. different paths produce different cache keys", async () => {
    const cache1 = makeMockCache(1);
    const cache2 = makeMockCache(1);
    const middleware1 = throttle(cache1, { limit: 10, windowMs: 60_000 });
    const middleware2 = throttle(cache2, { limit: 10, windowMs: 60_000 });
    const ip = "1.2.3.4";

    await middleware1(makeCtx({ ip, path: "/auth/login" }), async () => undefined);
    await middleware2(makeCtx({ ip, path: "/auth/register" }), async () => undefined);

    const key1 = ((cache1.increment as ReturnType<typeof mock>).mock.calls.at(0) ??
      [])[0] as string;
    const key2 = ((cache2.increment as ReturnType<typeof mock>).mock.calls.at(0) ??
      [])[0] as string;
    expect(key1).not.toBe(key2);
  });

  test("13. TTL passed to memcached.increment equals windowMs/1000 (rounded up)", async () => {
    const cache = makeMockCache(1);
    const middleware = throttle(cache, { limit: 10, windowMs: 60_000 });
    const ctx = makeCtx({ ip: "1.2.3.4" });

    await middleware(ctx, async () => undefined);

    const incrementCall = (cache.increment as ReturnType<typeof mock>).mock.calls.at(0) ?? [];
    expect(incrementCall[1]).toBe(60);
  });
});
