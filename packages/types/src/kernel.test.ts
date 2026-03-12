import { describe, expect, test } from "bun:test";
import {
  Err,
  None,
  Ok,
  Some,
  getOrElse,
  isErr,
  isNonEmpty,
  isNone,
  isOk,
  isSome,
  makeNonEmpty,
  mapMaybe,
  mapResult,
} from "./kernel";

describe("Maybe", () => {
  describe("Some", () => {
    test("creates a Some with the given value", () => {
      const s = Some(42);
      expect(s._tag).toBe("Some");
      expect(s.value).toBe(42);
    });

    test("works with string values", () => {
      const s = Some("hello");
      expect(s.value).toBe("hello");
    });

    test("works with object values", () => {
      const obj = { id: 1 };
      const s = Some(obj);
      expect(s.value).toBe(obj);
    });
  });

  describe("None", () => {
    test("creates a None", () => {
      const n = None();
      expect(n._tag).toBe("None");
    });
  });

  describe("isSome", () => {
    test("returns true for Some", () => {
      expect(isSome(Some(1))).toBe(true);
    });

    test("returns false for None", () => {
      expect(isSome(None())).toBe(false);
    });
  });

  describe("isNone", () => {
    test("returns true for None", () => {
      expect(isNone(None())).toBe(true);
    });

    test("returns false for Some", () => {
      expect(isNone(Some(1))).toBe(false);
    });
  });

  describe("mapMaybe", () => {
    test("applies fn to Some value", () => {
      const result = mapMaybe(Some(2), (x) => x * 3);
      expect(isSome(result)).toBe(true);
      if (isSome(result)) expect(result.value).toBe(6);
    });

    test("returns None for None input", () => {
      const result = mapMaybe(None<number>(), (x) => x * 3);
      expect(isNone(result)).toBe(true);
    });
  });

  describe("getOrElse", () => {
    test("returns value for Some", () => {
      expect(getOrElse(Some(10), 99)).toBe(10);
    });

    test("returns fallback for None", () => {
      expect(getOrElse(None<number>(), 99)).toBe(99);
    });
  });
});

describe("Result", () => {
  describe("Ok", () => {
    test("creates Ok with value", () => {
      const r = Ok(42);
      expect(r._tag).toBe("Ok");
      expect(r.value).toBe(42);
    });
  });

  describe("Err", () => {
    test("creates Err with error", () => {
      const r = Err("something went wrong");
      expect(r._tag).toBe("Err");
      expect(r.error).toBe("something went wrong");
    });
  });

  describe("isOk", () => {
    test("returns true for Ok", () => {
      expect(isOk(Ok(1))).toBe(true);
    });

    test("returns false for Err", () => {
      expect(isOk(Err("fail"))).toBe(false);
    });
  });

  describe("isErr", () => {
    test("returns true for Err", () => {
      expect(isErr(Err("fail"))).toBe(true);
    });

    test("returns false for Ok", () => {
      expect(isErr(Ok(1))).toBe(false);
    });
  });

  describe("mapResult", () => {
    test("applies fn to Ok value", () => {
      const result = mapResult(Ok(5), (x) => x * 2);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) expect(result.value).toBe(10);
    });

    test("passes through Err unchanged", () => {
      const err = Err("error");
      const result = mapResult(err, (x: number) => x * 2);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) expect(result.error).toBe("error");
    });
  });
});

describe("NonEmptyArray", () => {
  describe("isNonEmpty", () => {
    test("returns true for array with elements", () => {
      expect(isNonEmpty([1, 2, 3])).toBe(true);
    });

    test("returns true for single-element array", () => {
      expect(isNonEmpty([1])).toBe(true);
    });

    test("returns false for empty array", () => {
      expect(isNonEmpty([])).toBe(false);
    });
  });

  describe("makeNonEmpty", () => {
    test("creates NonEmptyArray from head", () => {
      const arr = makeNonEmpty(1);
      expect(arr).toEqual([1]);
    });

    test("creates NonEmptyArray from head and tail", () => {
      const arr = makeNonEmpty(1, 2, 3);
      expect(arr).toEqual([1, 2, 3]);
    });
  });
});
