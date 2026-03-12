export interface Eq<A> {
  readonly eqv: (x: A, y: A) => boolean;
}

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value as object).sort();
  const pairs = keys.map(
    (k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`
  );
  return `{${pairs.join(",")}}`;
};

export const Eq = {
  by: <A, B>(f: (a: A) => B): Eq<A> => ({
    eqv: (x, y) => {
      const bx = f(x);
      const by_ = f(y);
      return stableStringify(bx) === stableStringify(by_);
    },
  }),
  primitive: <A extends string | number | boolean | symbol>(): Eq<A> => ({
    eqv: (x, y) => x === y,
  }),
  all: <A>(...eqs: ReadonlyArray<Eq<A>>): Eq<A> => ({
    eqv: (x, y) => eqs.every((eq) => eq.eqv(x, y)),
  }),
};

export type Ordering = -1 | 0 | 1;

export interface Ord<A> extends Eq<A> {
  readonly compare: (x: A, y: A) => Ordering;
}

export const Ord = {
  by: <A, B extends string | number>(f: (a: A) => B): Ord<A> => ({
    eqv: (x, y) => f(x) === f(y),
    compare: (x, y) => {
      const bx = f(x);
      const by_ = f(y);
      if (bx < by_) return -1;
      if (bx > by_) return 1;
      return 0;
    },
  }),
  number: (): Ord<number> => Ord.by((x) => x),
  string: (): Ord<string> => Ord.by((x) => x),
  reverse: <A>(ord: Ord<A>): Ord<A> => ({
    eqv: ord.eqv,
    compare: (x, y) => {
      const c = ord.compare(x, y);
      return (c === 0 ? 0 : c === 1 ? -1 : 1) as Ordering;
    },
  }),
  chain: <A>(...ords: ReadonlyArray<Ord<A>>): Ord<A> => ({
    eqv: (x, y) => ords.every((o) => o.eqv(x, y)),
    compare: (x, y) => {
      for (const o of ords) {
        const c = o.compare(x, y);
        if (c !== 0) return c;
      }
      return 0;
    },
  }),
};

export interface Semigroup<A> {
  readonly combine: (x: A, y: A) => A;
}

export const Semigroup = {
  sum: (): Semigroup<number> => ({ combine: (x, y) => x + y }),
  product: (): Semigroup<number> => ({ combine: (x, y) => x * y }),
  string: (): Semigroup<string> => ({ combine: (x, y) => x + y }),
  of: <A>(combine: (x: A, y: A) => A): Semigroup<A> => ({ combine }),
};

export interface Monoid<A> extends Semigroup<A> {
  readonly empty: A;
}

export const Monoid = {
  sum: (): Monoid<number> => ({ combine: (x, y) => x + y, empty: 0 }),
  product: (): Monoid<number> => ({ combine: (x, y) => x * y, empty: 1 }),
  string: (): Monoid<string> => ({ combine: (x, y) => x + y, empty: "" }),
  array: <A>(): Monoid<ReadonlyArray<A>> => ({
    combine: (x, y) => [...x, ...y],
    empty: [],
  }),
  of: <A>(sg: Semigroup<A>, empty: A): Monoid<A> => ({
    combine: sg.combine,
    empty,
  }),
  fold: <A>(monoid: Monoid<A>, values: ReadonlyArray<A>): A =>
    values.reduce(monoid.combine, monoid.empty),
};

export interface ListPipe<A> {
  readonly value: ReadonlyArray<A>;
  distinctBy(eq: Eq<A>): ListPipe<A>;
  groupBy<K extends string, V>(
    keyFn: (a: A) => K,
    valueFn: (a: A) => V,
    monoid: Monoid<V>
  ): MapPipe<K, V>;
  sortBy(ord: Ord<A>): ListPipe<A>;
  top(n: number, ord: Ord<A>): ListPipe<A>;
  map<B>(fn: (a: A) => B): ListPipe<B>;
  filter(fn: (a: A) => boolean): ListPipe<A>;
  toArray(): ReadonlyArray<A>;
}

export interface MapPipe<K extends string, V> {
  readonly value: ReadonlyMap<K, V>;
  orderBy(topN: number, ord: Ord<V>): ListPipe<readonly [K, V]>;
  toMap(): ReadonlyMap<K, V>;
  toRecord(): Readonly<Record<K, V>>;
}

class ListPipeImpl<A> implements ListPipe<A> {
  constructor(readonly value: ReadonlyArray<A>) {}

  distinctBy(eq: Eq<A>): ListPipe<A> {
    const seen: A[] = [];
    for (const a of [...this.value].reverse()) {
      if (!seen.some((x) => eq.eqv(x, a))) {
        seen.push(a);
      }
    }
    return new ListPipeImpl(seen.reverse());
  }

  groupBy<K extends string, V>(
    keyFn: (a: A) => K,
    valueFn: (a: A) => V,
    monoid: Monoid<V>
  ): MapPipe<K, V> {
    const map = new Map<K, V>();
    this.value.forEach((a) => {
      const k = keyFn(a);
      const v = valueFn(a);
      const existing = map.get(k);
      map.set(k, existing === undefined ? v : monoid.combine(existing, v));
    });
    return new MapPipeImpl(map as ReadonlyMap<K, V>);
  }

  sortBy(ord: Ord<A>): ListPipe<A> {
    return new ListPipeImpl([...this.value].sort(ord.compare));
  }

  top(n: number, ord: Ord<A>): ListPipe<A> {
    const sorted = [...this.value].sort(Ord.reverse(ord).compare);
    return new ListPipeImpl(sorted.slice(0, n));
  }

  map<B>(fn: (a: A) => B): ListPipe<B> {
    return new ListPipeImpl(this.value.map(fn));
  }

  filter(fn: (a: A) => boolean): ListPipe<A> {
    return new ListPipeImpl(this.value.filter(fn));
  }

  toArray(): ReadonlyArray<A> {
    return this.value;
  }
}

class MapPipeImpl<K extends string, V> implements MapPipe<K, V> {
  constructor(readonly value: ReadonlyMap<K, V>) {}

  orderBy(topN: number, ord: Ord<V>): ListPipe<readonly [K, V]> {
    const entries = Array.from(this.value.entries()) as Array<readonly [K, V]>;
    const sorted = entries.sort((a, b) => Ord.reverse(ord).compare(a[1], b[1]));
    return new ListPipeImpl(sorted.slice(0, topN));
  }

  toMap(): ReadonlyMap<K, V> {
    return this.value;
  }

  toRecord(): Readonly<Record<K, V>> {
    const obj = {} as Record<K, V>;
    Array.from(this.value.entries()).forEach(([k, v]) => {
      (obj as Record<string, V>)[k] = v;
    });
    return obj;
  }
}

export const pipe = <A>(xs: ReadonlyArray<A>): ListPipe<A> => new ListPipeImpl(xs);

export const EqById = <T extends { readonly id: string }>(): Eq<T> => Eq.by((t) => t.id);
export const EqBrandedId = <T extends { readonly value: string }>(): Eq<T> => Eq.by((t) => t.value);
export const MonoidMoneyCents: Monoid<number> = Monoid.sum();
export const OrdMoneyCents: Ord<number> = Ord.number();
