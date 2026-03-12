import { describe, expect, test } from "bun:test";
import {
  Eq,
  EqBrandedId,
  EqById,
  Monoid,
  MonoidMoneyCents,
  Ord,
  OrdMoneyCents,
  Semigroup,
  pipe,
} from "./typeclasses";

describe("Eq", () => {
  describe("Eq.by", () => {
    test("considers equal when projection is equal", () => {
      const eq = Eq.by((x: { id: number }) => x.id);
      expect(eq.eqv({ id: 1 }, { id: 1 })).toBe(true);
    });

    test("considers not equal when projection differs", () => {
      const eq = Eq.by((x: { id: number }) => x.id);
      expect(eq.eqv({ id: 1 }, { id: 2 })).toBe(false);
    });

    test("handles nested objects with stable stringify", () => {
      const eq = Eq.by((x: { meta: { a: number; b: number } }) => x.meta);
      expect(eq.eqv({ meta: { a: 1, b: 2 } }, { meta: { b: 2, a: 1 } })).toBe(true);
    });

    test("handles array values with stable stringify (array branch)", () => {
      const eq = Eq.by((x: { tags: string[] }) => x.tags);
      expect(eq.eqv({ tags: ["a", "b"] }, { tags: ["a", "b"] })).toBe(true);
      expect(eq.eqv({ tags: ["a"] }, { tags: ["b"] })).toBe(false);
    });

    test("handles null values with stable stringify", () => {
      const eq = Eq.by((x: { v: null | number }) => x.v);
      expect(eq.eqv({ v: null }, { v: null })).toBe(true);
      expect(eq.eqv({ v: null }, { v: 1 })).toBe(false);
    });
  });

  describe("Eq.primitive", () => {
    test("compares numbers by strict equality", () => {
      const eq = Eq.primitive<number>();
      expect(eq.eqv(1, 1)).toBe(true);
      expect(eq.eqv(1, 2)).toBe(false);
    });

    test("compares strings by strict equality", () => {
      const eq = Eq.primitive<string>();
      expect(eq.eqv("a", "a")).toBe(true);
      expect(eq.eqv("a", "b")).toBe(false);
    });
  });

  describe("Eq.all", () => {
    test("returns true when all eqs agree", () => {
      const eqA = Eq.by((x: { a: number; b: number }) => x.a);
      const eqB = Eq.by((x: { a: number; b: number }) => x.b);
      const eq = Eq.all(eqA, eqB);
      expect(eq.eqv({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
    });

    test("returns false when any eq disagrees", () => {
      const eqA = Eq.by((x: { a: number; b: number }) => x.a);
      const eqB = Eq.by((x: { a: number; b: number }) => x.b);
      const eq = Eq.all(eqA, eqB);
      expect(eq.eqv({ a: 1, b: 2 }, { a: 1, b: 3 })).toBe(false);
    });
  });
});

describe("Ord", () => {
  describe("Ord.by", () => {
    test("returns -1 when first < second", () => {
      const ord = Ord.by((x: { n: number }) => x.n);
      expect(ord.compare({ n: 1 }, { n: 2 })).toBe(-1);
    });

    test("returns 1 when first > second", () => {
      const ord = Ord.by((x: { n: number }) => x.n);
      expect(ord.compare({ n: 2 }, { n: 1 })).toBe(1);
    });

    test("returns 0 when equal", () => {
      const ord = Ord.by((x: { n: number }) => x.n);
      expect(ord.compare({ n: 1 }, { n: 1 })).toBe(0);
    });
  });

  describe("Ord.number", () => {
    test("orders numbers correctly", () => {
      const ord = Ord.number();
      expect(ord.compare(1, 2)).toBe(-1);
      expect(ord.compare(2, 1)).toBe(1);
      expect(ord.compare(1, 1)).toBe(0);
    });
  });

  describe("Ord.string", () => {
    test("orders strings lexicographically", () => {
      const ord = Ord.string();
      expect(ord.compare("apple", "banana")).toBe(-1);
      expect(ord.compare("banana", "apple")).toBe(1);
      expect(ord.compare("same", "same")).toBe(0);
    });

    test("eqv returns true for equal strings", () => {
      const ord = Ord.string();
      expect(ord.eqv("hello", "hello")).toBe(true);
      expect(ord.eqv("hello", "world")).toBe(false);
    });
  });

  describe("Ord.reverse", () => {
    test("inverts the ordering", () => {
      const ord = Ord.reverse(Ord.number());
      expect(ord.compare(1, 2)).toBe(1);
      expect(ord.compare(2, 1)).toBe(-1);
      expect(ord.compare(1, 1)).toBe(0);
    });
  });

  describe("Ord.chain", () => {
    test("breaks ties with subsequent ord", () => {
      const ordA = Ord.by((x: { a: number; b: number }) => x.a);
      const ordB = Ord.by((x: { a: number; b: number }) => x.b);
      const ord = Ord.chain(ordA, ordB);
      expect(ord.compare({ a: 1, b: 1 }, { a: 1, b: 2 })).toBe(-1);
    });

    test("uses first ord when not tied", () => {
      const ordA = Ord.by((x: { a: number; b: number }) => x.a);
      const ordB = Ord.by((x: { a: number; b: number }) => x.b);
      const ord = Ord.chain(ordA, ordB);
      expect(ord.compare({ a: 1, b: 99 }, { a: 2, b: 1 })).toBe(-1);
    });

    test("eqv returns true when all ords agree", () => {
      const ordA = Ord.by((x: { a: number; b: number }) => x.a);
      const ordB = Ord.by((x: { a: number; b: number }) => x.b);
      const ord = Ord.chain(ordA, ordB);
      expect(ord.eqv({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
      expect(ord.eqv({ a: 1, b: 2 }, { a: 2, b: 2 })).toBe(false);
    });

    test("compare returns 0 when all ords are equal", () => {
      const ordA = Ord.by((x: { a: number }) => x.a);
      const ord = Ord.chain(ordA);
      expect(ord.compare({ a: 5 }, { a: 5 })).toBe(0);
    });
  });
});

describe("Semigroup", () => {
  test("sum combines numbers by addition", () => {
    const s = Semigroup.sum();
    expect(s.combine(3, 4)).toBe(7);
  });

  test("product combines numbers by multiplication", () => {
    const s = Semigroup.product();
    expect(s.combine(3, 4)).toBe(12);
  });

  test("string concatenates strings", () => {
    const s = Semigroup.string();
    expect(s.combine("hello", " world")).toBe("hello world");
  });

  test("of wraps a custom combine function", () => {
    const s = Semigroup.of<number[]>((x, y) => [...x, ...y]);
    expect(s.combine([1], [2, 3])).toEqual([1, 2, 3]);
  });
});

describe("Monoid", () => {
  test("sum has identity 0", () => {
    const m = Monoid.sum();
    expect(m.empty).toBe(0);
    expect(m.combine(m.empty, 5)).toBe(5);
  });

  test("product has identity 1", () => {
    const m = Monoid.product();
    expect(m.empty).toBe(1);
    expect(m.combine(m.empty, 5)).toBe(5);
  });

  test("string has identity empty string", () => {
    const m = Monoid.string();
    expect(m.empty).toBe("");
    expect(m.combine(m.empty, "hi")).toBe("hi");
  });

  test("array has identity empty array", () => {
    const m = Monoid.array<number>();
    expect(m.empty).toEqual([]);
    expect(m.combine(m.empty, [1, 2])).toEqual([1, 2]);
  });

  test("of builds a monoid from a semigroup and identity value", () => {
    const sg = Semigroup.of<number[]>((x, y) => [...x, ...y]);
    const m = Monoid.of(sg, []);
    expect(m.empty).toEqual([]);
    expect(m.combine([1], [2, 3])).toEqual([1, 2, 3]);
    expect(Monoid.fold(m, [[1], [2], [3]])).toEqual([1, 2, 3]);
  });

  test("fold reduces array using monoid", () => {
    const m = Monoid.sum();
    expect(Monoid.fold(m, [1, 2, 3, 4])).toBe(10);
  });

  test("fold of empty array returns identity", () => {
    const m = Monoid.sum();
    expect(Monoid.fold(m, [])).toBe(0);
  });
});

describe("pipe (ListPipe)", () => {
  test("distinctBy removes duplicates (keeps last occurrence, preserves relative order)", () => {
    const eq = Eq.by((x: { id: number }) => x.id);
    const result = pipe([{ id: 1 }, { id: 2 }, { id: 1 }, { id: 3 }])
      .distinctBy(eq)
      .toArray();
    expect(result).toEqual([{ id: 2 }, { id: 1 }, { id: 3 }]);
  });

  test("sortBy sorts ascending", () => {
    const ord = Ord.by((x: { n: number }) => x.n);
    const result = pipe([{ n: 3 }, { n: 1 }, { n: 2 }])
      .sortBy(ord)
      .toArray();
    expect(result).toEqual([{ n: 1 }, { n: 2 }, { n: 3 }]);
  });

  test("top returns top N elements descending", () => {
    const ord = Ord.number();
    const result = pipe([5, 1, 3, 2, 4]).top(3, ord).toArray();
    expect(result).toEqual([5, 4, 3]);
  });

  test("map transforms each element", () => {
    const result = pipe([1, 2, 3])
      .map((x) => x * 2)
      .toArray();
    expect(result).toEqual([2, 4, 6]);
  });

  test("filter keeps matching elements", () => {
    const result = pipe([1, 2, 3, 4])
      .filter((x) => x % 2 === 0)
      .toArray();
    expect(result).toEqual([2, 4]);
  });

  test("groupBy groups and merges values", () => {
    const items = [
      { category: "a", amount: 10 },
      { category: "b", amount: 20 },
      { category: "a", amount: 5 },
    ];
    const result = pipe(items)
      .groupBy(
        (x) => x.category,
        (x) => x.amount,
        Monoid.sum()
      )
      .toRecord();
    expect(result).toEqual({ a: 15, b: 20 });
  });

  test("groupBy then orderBy returns top N pairs", () => {
    const items = [
      { cat: "a", val: 10 },
      { cat: "b", val: 30 },
      { cat: "a", val: 5 },
      { cat: "c", val: 20 },
    ];
    const result = pipe(items)
      .groupBy(
        (x) => x.cat,
        (x) => x.val,
        Monoid.sum()
      )
      .orderBy(2, Ord.number())
      .toArray();
    expect(result).toEqual([
      ["b", 30],
      ["c", 20],
    ]);
  });

  test("groupBy then toMap returns ReadonlyMap", () => {
    const items = [
      { key: "x", n: 1 },
      { key: "y", n: 2 },
      { key: "x", n: 3 },
    ];
    const map = pipe(items)
      .groupBy(
        (x) => x.key,
        (x) => x.n,
        Monoid.sum()
      )
      .toMap();
    expect(map.get("x")).toBe(4);
    expect(map.get("y")).toBe(2);
  });
});

describe("pre-built instances", () => {
  test("EqById compares by id field", () => {
    const eq = EqById<{ id: string; name: string }>();
    expect(eq.eqv({ id: "1", name: "a" }, { id: "1", name: "b" })).toBe(true);
    expect(eq.eqv({ id: "1", name: "a" }, { id: "2", name: "a" })).toBe(false);
  });

  test("EqBrandedId compares by value field", () => {
    const eq = EqBrandedId<{ value: string }>();
    expect(eq.eqv({ value: "abc" }, { value: "abc" })).toBe(true);
    expect(eq.eqv({ value: "abc" }, { value: "xyz" })).toBe(false);
  });

  test("MonoidMoneyCents sums cents correctly", () => {
    expect(Monoid.fold(MonoidMoneyCents, [100, 250, 50])).toBe(400);
  });

  test("OrdMoneyCents orders amounts numerically", () => {
    expect(OrdMoneyCents.compare(100, 200)).toBe(-1);
    expect(OrdMoneyCents.compare(200, 100)).toBe(1);
    expect(OrdMoneyCents.compare(100, 100)).toBe(0);
  });
});
