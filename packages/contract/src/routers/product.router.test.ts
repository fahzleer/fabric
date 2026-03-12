import { describe, expect, test } from "bun:test";
import { VALID_SORT_FIELDS } from "./product.router";

describe("VALID_SORT_FIELDS", () => {
  test("is a Set", () => {
    expect(VALID_SORT_FIELDS).toBeInstanceOf(Set);
  });

  test("contains exactly 5 entries", () => {
    expect(VALID_SORT_FIELDS.size).toBe(5);
  });

  test("contains price_asc", () => {
    expect(VALID_SORT_FIELDS.has("price_asc")).toBe(true);
  });

  test("contains price_desc", () => {
    expect(VALID_SORT_FIELDS.has("price_desc")).toBe(true);
  });

  test("contains name_asc", () => {
    expect(VALID_SORT_FIELDS.has("name_asc")).toBe(true);
  });

  test("contains name_desc", () => {
    expect(VALID_SORT_FIELDS.has("name_desc")).toBe(true);
  });

  test("contains created_desc", () => {
    expect(VALID_SORT_FIELDS.has("created_desc")).toBe(true);
  });

  test("does not contain invalid sort value", () => {
    expect(VALID_SORT_FIELDS.has("invalid_sort" as never)).toBe(false);
  });
});
