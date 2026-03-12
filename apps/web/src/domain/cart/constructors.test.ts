import { describe, expect, test } from "bun:test";
import { makeProductId, makeProductPriceFromCents } from "@fabric/types";
import {
  addItemToCart,
  clearCart,
  makeEmptyCart,
  removeItemFromCart,
  updateCartItemQuantity,
} from "./constructors";
import type { CartItem } from "./types";

const PRODUCT_ID = makeProductId("prod-1");
const PRODUCT_ID_2 = makeProductId("prod-2");
const PRICE = makeProductPriceFromCents(10_000, "THB");

const makeName = (v: string) => ({ __brand: "ProductName" as const, value: v });
const makeImage = (url: string) => ({
  url: url as ReturnType<typeof import("@fabric/types")["makeProductId"]>["value"] & string,
  altText: "alt",
  isPrimary: true,
  order: 0,
});

const makeItem = (overrides: Partial<CartItem> = {}): CartItem => ({
  productId: PRODUCT_ID,
  size: "M",
  quantity: 1,
  productSnapshot: {
    name: makeName("Test Shirt") as CartItem["productSnapshot"]["name"],
    price: PRICE,
    image: makeImage("/test.jpg") as CartItem["productSnapshot"]["image"],
  },
  ...overrides,
});

describe("makeEmptyCart", () => {
  test("creates a cart with no items", () => {
    const cart = makeEmptyCart("cart-1");
    expect(cart.id).toBe("cart-1");
    expect(cart.items).toHaveLength(0);
  });

  test("sets a valid updatedAt timestamp string", () => {
    const cart = makeEmptyCart("cart-2");
    expect(typeof cart.updatedAt).toBe("string");
    expect(cart.updatedAt.length).toBeGreaterThan(0);
  });
});

describe("addItemToCart", () => {
  test("adds a new item to an empty cart", () => {
    const cart = makeEmptyCart("cart-1");
    const result = addItemToCart(cart, makeItem());
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.productId.value).toBe("prod-1");
  });

  test("merges quantity when same (productId, size) already exists", () => {
    const cart = makeEmptyCart("cart-1");
    const cartWithItem = addItemToCart(cart, makeItem({ quantity: 2 }));
    const result = addItemToCart(cartWithItem, makeItem({ quantity: 3 }));

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.quantity).toBe(5);
  });

  test("does not merge items with different sizes", () => {
    const cart = makeEmptyCart("cart-1");
    const cartWithM = addItemToCart(cart, makeItem({ size: "M" }));
    const result = addItemToCart(cartWithM, makeItem({ size: "L" }));

    expect(result.items).toHaveLength(2);
  });

  test("does not merge items with different productIds", () => {
    const cart = makeEmptyCart("cart-1");
    const cartWithProd1 = addItemToCart(cart, makeItem({ productId: PRODUCT_ID }));
    const result = addItemToCart(cartWithProd1, makeItem({ productId: PRODUCT_ID_2 }));

    expect(result.items).toHaveLength(2);
  });

  test("preserves other items unchanged when merging a specific (productId, size)", () => {
    const cart = makeEmptyCart("cart-1");
    let c = addItemToCart(cart, makeItem({ size: "M", quantity: 1 }));
    c = addItemToCart(c, makeItem({ size: "L", quantity: 2 }));
    const result = addItemToCart(c, makeItem({ size: "M", quantity: 3 }));

    expect(result.items).toHaveLength(2);
    expect(result.items.find((i) => i.size === "M")?.quantity).toBe(4);
    expect(result.items.find((i) => i.size === "L")?.quantity).toBe(2);
  });
});

describe("removeItemFromCart", () => {
  test("removes the matching item from the cart", () => {
    const cart = makeEmptyCart("cart-1");
    const cartWithItem = addItemToCart(cart, makeItem());
    const result = removeItemFromCart(cartWithItem, PRODUCT_ID, "M");

    expect(result.items).toHaveLength(0);
  });

  test("only removes the matched (productId, size) pair", () => {
    const cart = makeEmptyCart("cart-1");
    let c = addItemToCart(cart, makeItem({ size: "M" }));
    c = addItemToCart(c, makeItem({ size: "L" }));

    const result = removeItemFromCart(c, PRODUCT_ID, "M");
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.size).toBe("L");
  });

  test("is a no-op when item is not in cart", () => {
    const cart = makeEmptyCart("cart-1");
    const result = removeItemFromCart(cart, PRODUCT_ID, "M");
    expect(result.items).toHaveLength(0);
  });
});

describe("updateCartItemQuantity", () => {
  test("returns Ok and updates quantity for a valid new quantity", () => {
    const cart = makeEmptyCart("cart-1");
    const c = addItemToCart(cart, makeItem({ quantity: 1 }));
    const result = updateCartItemQuantity(c, PRODUCT_ID, "M", 5);

    expect(result._tag).toBe("Ok");
    if (result._tag === "Ok") {
      expect(result.value.items[0]?.quantity).toBe(5);
    }
  });

  test("returns Err(CartQuantityError) for quantity 0", () => {
    const cart = makeEmptyCart("cart-1");
    const c = addItemToCart(cart, makeItem());
    const result = updateCartItemQuantity(c, PRODUCT_ID, "M", 0);

    expect(result._tag).toBe("Err");
    if (result._tag === "Err") {
      expect(result.error._tag).toBe("CartQuantityError");
    }
  });

  test("returns Err for quantity > 99", () => {
    const cart = makeEmptyCart("cart-1");
    const c = addItemToCart(cart, makeItem());
    const result = updateCartItemQuantity(c, PRODUCT_ID, "M", 100);

    expect(result._tag).toBe("Err");
  });

  test("returns Err for negative quantity", () => {
    const cart = makeEmptyCart("cart-1");
    const c = addItemToCart(cart, makeItem());
    const result = updateCartItemQuantity(c, PRODUCT_ID, "M", -1);

    expect(result._tag).toBe("Err");
  });

  test("does not affect other items in the cart", () => {
    const cart = makeEmptyCart("cart-1");
    let c = addItemToCart(cart, makeItem({ productId: PRODUCT_ID, size: "M", quantity: 1 }));
    c = addItemToCart(c, makeItem({ productId: PRODUCT_ID_2, size: "L", quantity: 2 }));

    const result = updateCartItemQuantity(c, PRODUCT_ID, "M", 10);
    if (result._tag === "Ok") {
      const other = result.value.items.find((i) => i.productId.value === "prod-2");
      expect(other?.quantity).toBe(2);
    }
  });
});

describe("clearCart", () => {
  test("removes all items from the cart", () => {
    const cart = makeEmptyCart("cart-1");
    const c = addItemToCart(cart, makeItem());
    const result = clearCart(c);

    expect(result.items).toHaveLength(0);
  });

  test("preserves the cart id", () => {
    const cart = makeEmptyCart("cart-xyz");
    const result = clearCart(cart);
    expect(result.id).toBe("cart-xyz");
  });
});
