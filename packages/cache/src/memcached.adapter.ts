import { Result, TaggedError } from "better-result";
import Memcached from "memcached";

export class MemcachedGetError extends TaggedError("MemcachedGetError")<{ message: string }>() {}
export class MemcachedSetError extends TaggedError("MemcachedSetError")<{ message: string }>() {}
export class MemcachedDelError extends TaggedError("MemcachedDelError")<{ message: string }>() {}

export type MemcachedServers = string | string[];

export interface MemcachedAdapterOptions {
  servers: MemcachedServers;
  options?: Memcached.options;
}

export const CacheKeys = {
  product: (id: string) => `product:${id}`,
  products: () => "products:all",
  cart: (id: string) => `cart:${id}`,
  user: (id: string) => `user:${id}`,
  rateLimitKey: (ip: string, path: string) => `rate_limit:${path}:${ip}`,
} as const;

export class MemcachedAdapter {
  private readonly client: Memcached;

  constructor(opts: MemcachedAdapterOptions) {
    this.client = new Memcached(opts.servers, opts.options);
  }

  get<T>(key: string): Promise<Result<T | undefined, MemcachedGetError>> {
    return Result.tryPromise({
      try: () =>
        new Promise<T | undefined>((resolve, reject) => {
          this.client.get(key, (err, data) => {
            if (err) reject(err);
            else resolve(data as T | undefined);
          });
        }),
      catch: (e) => new MemcachedGetError({ message: String(e) }),
    });
  }

  set(
    key: string,
    value: unknown,
    ttlSeconds: number
  ): Promise<Result<boolean, MemcachedSetError>> {
    return Result.tryPromise({
      try: () =>
        new Promise<boolean>((resolve, reject) => {
          this.client.set(key, value, ttlSeconds, (err, result) => {
            if (err) reject(err);
            else resolve(result);
          });
        }),
      catch: (e) => new MemcachedSetError({ message: String(e) }),
    });
  }

  del(key: string): Promise<Result<void, MemcachedDelError>> {
    return Result.tryPromise({
      try: () =>
        new Promise<void>((resolve, reject) => {
          this.client.del(key, (err) => {
            if (err) reject(err);
            else resolve();
          });
        }),
      catch: (e) => new MemcachedDelError({ message: String(e) }),
    });
  }

  async getOrSet<T>(
    key: string,
    ttlSeconds: number,
    factory: () => Promise<T>
  ): Promise<Result<T, MemcachedGetError | MemcachedSetError>> {
    const cached = await this.get<T>(key);

    if (Result.isOk(cached) && cached.value !== undefined) {
      return Result.ok(cached.value);
    }

    const value = await factory();
    const setResult = await this.set(key, value, ttlSeconds);

    if (Result.isError(setResult)) {
      return Result.err(setResult.error);
    }

    return Result.ok(value);
  }

  /**
   * Atomically increments a counter key by 1, creating it with the given TTL if it
   * does not yet exist. Returns the new counter value, or null on any cache error
   * (fail-open: callers should treat null as "no limit exceeded").
   */
  async increment(key: string, ttlSeconds: number): Promise<number | null> {
    // Attempt to increment an existing key.
    // Memcached incr returns a number on success, false when the key doesn't exist.
    const incr = await new Promise<number | boolean>((resolve, reject) => {
      this.client.incr(key, 1, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    }).catch(() => null);

    if (typeof incr === "number") return incr;

    // Key didn't exist — create it atomically (add is a no-op if key already exists).
    const added = await new Promise<number | boolean>((resolve, reject) => {
      this.client.add(key, 1, ttlSeconds, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    }).catch(() => null);

    if (added === null) return null; // cache error → fail open
    if (added === true) return 1; // successfully created with value 1

    // Race: another request created the key between our incr and add — retry once.
    const retry = await new Promise<number | boolean>((resolve, reject) => {
      this.client.incr(key, 1, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    }).catch(() => null);

    return typeof retry === "number" ? retry : null;
  }

  quit(): void {
    this.client.end();
  }
}
