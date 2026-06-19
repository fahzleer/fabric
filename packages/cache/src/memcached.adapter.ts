import { Err, Ok, type Result, type TaggedError, isErr, isOk, tryCatchAsync } from "@fabric/types";
import Memcached from "memcached";

export class MemcachedGetError implements TaggedError<"MemcachedGetError"> {
  readonly _tag = "MemcachedGetError";
  constructor(readonly message: string) {}
}

export class MemcachedSetError implements TaggedError<"MemcachedSetError"> {
  readonly _tag = "MemcachedSetError";
  constructor(readonly message: string) {}
}

export class MemcachedDelError implements TaggedError<"MemcachedDelError"> {
  readonly _tag = "MemcachedDelError";
  constructor(readonly message: string) {}
}

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
    return tryCatchAsync<T | undefined, MemcachedGetError>(async () => {
      const data = await new Promise<T | undefined>((resolve, reject) => {
        this.client.get(key, (err, result) => {
          if (err) reject(err);
          else resolve(result as T | undefined);
        });
      });
      return data;
    }).then((result) =>
      isErr(result) ? Err(new MemcachedGetError(String(result.error))) : result
    );
  }

  set(
    key: string,
    value: unknown,
    ttlSeconds: number
  ): Promise<Result<boolean, MemcachedSetError>> {
    return tryCatchAsync<boolean, MemcachedSetError>(async () => {
      const result = await new Promise<boolean>((resolve, reject) => {
        this.client.set(key, value, ttlSeconds, (err, ok) => {
          if (err) reject(err);
          else resolve(ok);
        });
      });
      return result;
    }).then((result) =>
      isErr(result) ? Err(new MemcachedSetError(String(result.error))) : result
    );
  }

  del(key: string): Promise<Result<void, MemcachedDelError>> {
    return tryCatchAsync<void, MemcachedDelError>(async () => {
      await new Promise<void>((resolve, reject) => {
        this.client.del(key, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }).then((result) =>
      isErr(result) ? Err(new MemcachedDelError(String(result.error))) : result
    );
  }

  async getOrSet<T>(
    key: string,
    ttlSeconds: number,
    factory: () => Promise<T>
  ): Promise<Result<T, MemcachedGetError | MemcachedSetError>> {
    const cached = await this.get<T>(key);

    if (isOk(cached) && cached.value !== undefined) {
      return Ok(cached.value);
    }

    const value = await factory();
    const setResult = await this.set(key, value, ttlSeconds);

    if (isErr(setResult)) {
      return Err(setResult.error);
    }

    return Ok(value);
  }

  async increment(key: string, ttlSeconds: number): Promise<number | null> {
    const incr = await new Promise<number | boolean>((resolve, reject) => {
      this.client.incr(key, 1, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    }).catch(() => null);

    if (typeof incr === "number") return incr;

    const added = await new Promise<number | boolean>((resolve, reject) => {
      this.client.add(key, 1, ttlSeconds, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    }).catch(() => null);

    if (added === null) return null;
    if (added === true) return 1;

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
