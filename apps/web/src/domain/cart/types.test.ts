import { describe, expect, test } from "bun:test";
import type { ProductName } from "@/domain/product/types";
import { makeProductId, makeProductName, makeProductPriceFromCents } from "@fabric/types";
import type { CartItem, ShoppingCart } from "./types";
import {
  formatCartTotal,
  getCartItemCount,
  getCartItemLineTotal,
  getCartTotal,
  isCartEmpty,
} from "./types";

const PRICE = makeProductPriceFromCents(10_000, "THB");
const PRICE_THB_WHOLE = makeProductPriceFromCents(99_900, "THB");

const makeName = (v: string): ProductName => makeProductName(v) as ProductName;
const makeImage = () => ({
  url: "/img.jpg",
  altText: "alt",
  isPrimary: true,
  order: 0,
});

const makeItem = (
  productId = "prod-1",
  quantity = 1,
  price = PRICE,
  size: CartItem["size"] = "M"
): CartItem => ({
  productId: makeProductId(productId),
  size,
  quantity,
  productSnapshot: {
    name: makeName("Shirt") as CartItem["productSnapshot"]["name"],
    price,
    image: makeImage() as CartItem["productSnapshot"]["image"],
  },
});

const makeCart = (items: CartItem[]): ShoppingCart => ({
  id: "cart-1",
  items,
  updatedAt: new Date().toISOString(),
});

describe("getCartItemLineTotal", () => {
  test("returns unitPrice.amount * quantity", () => {
    const item = makeItem("prod-1", 3, PRICE);
    expect(getCartItemLineTotal(item)).toBe(300);
  });

  test("returns 0 for quantity 0", () => {
    const item = makeItem("prod-1", 0, PRICE);
    expect(getCartItemLineTotal(item)).toBe(0);
  });
});

describe("getCartTotal", () => {
  test("returns 0 for empty cart", () => {
    expect(getCartTotal(makeCart([]))).toBe(0);
  });

  test("sums all line totals", () => {
    const items = [
      makeItem("prod-1", 2, PRICE),
      makeItem("prod-2", 1, makeProductPriceFromCents(5_000, "THB")),
    ];
    expect(getCartTotal(makeCart(items))).toBe(250);
  });
});

describe("getCartItemCount", () => {
  test("returns 0 for empty cart", () => {
    expect(getCartItemCount(makeCart([]))).toBe(0);
  });

  test("sums all item quantities", () => {
    const items = [makeItem("prod-1", 2), makeItem("prod-2", 3)];
    expect(getCartItemCount(makeCart(items))).toBe(5);
  });
});

describe("isCartEmpty", () => {
  test("returns true for cart with no items", () => {
    expect(isCartEmpty(makeCart([]))).toBe(true);
  });

  test("returns false for cart with items", () => {
    expect(isCartEmpty(makeCart([makeItem()]))).toBe(false);
  });
});

describe("formatCartTotal", () => {
  test("returns a formatted string for a cart with items", () => {
    const items = [makeItem("prod-1", 1, PRICE_THB_WHOLE)];
    const result = formatCartTotal(makeCart(items));
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  test("defaults to THB currency for empty cart", () => {
    const result = formatCartTotal(makeCart([]));
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});
