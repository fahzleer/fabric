import { Option } from "effect";
import type { ProductState } from "../domain/Product.ts";

export interface CacheStats {
  readonly size: number;
  readonly hitCount: number;
  readonly missCount: number;
}

export interface ReadCache {
  get(id: string): Option.Option<ProductState>;
  put(id: string, state: ProductState): void;
  invalidate(id: string): void;
  invalidateAll(): void;
  stats(): CacheStats;
}

interface CacheState {
  readonly entries: Map<string, ProductState>;
  hitCount: number;
  missCount: number;
}

export const createCache = (): ReadCache => {
  const state: CacheState = {
    entries: new Map(),
    hitCount: 0,
    missCount: 0,
  };

  return {
    get(id: string): Option.Option<ProductState> {
      const value = state.entries.get(id);
      if (value !== undefined) {
        state.hitCount++;
        return Option.some(value);
      }
      state.missCount++;
      return Option.none();
    },

    put(id: string, productState: ProductState): void {
      state.entries.set(id, productState);
    },

    invalidate(id: string): void {
      state.entries.delete(id);
    },

    invalidateAll(): void {
      state.entries.clear();
    },

    stats(): CacheStats {
      return {
        size: state.entries.size,
        hitCount: state.hitCount,
        missCount: state.missCount,
      };
    },
  };
};

export const getCached = (
  cache: ReadCache,
  id: string,
  dbReader: (id: string) => Option.Option<ProductState>
): Option.Option<ProductState> => {
  const cached = cache.get(id);
  if (Option.isSome(cached)) {
    return cached;
  }

  const fresh = dbReader(id);
  if (Option.isSome(fresh)) {
    cache.put(id, fresh.value);
  }
  return fresh;
};

export const invalidate = (cache: ReadCache, id: string): void => {
  cache.invalidate(id);
};

let _singleton: ReadCache | null = null;

export const startSingleton = (): ReadCache => {
  if (_singleton === null) {
    _singleton = createCache();
  }
  return _singleton;
};

export const _resetSingletonForTests = (): void => {
  _singleton = null;
};
