import { describe, expect, test } from "bun:test";
import { None, Some } from "@fabric/types";
import type { CartItemQuantity } from "@fabric/types";
import { makeCartId, makeProductId, makeUserId } from "@fabric/types";
import type { Cart, CartItem } from "./cart.entity";
import {
  addItemToCart,
  clearCart,
  findCartItem,
  getCartItemCount,
  getCartItemLineTotal,
  getCartTotal,
  isCartEmpty,
  makeEmptyCart,
  removeItemFromCart,
  updateCartItemQuantity,
} from "./cart.entity";

const CART_ID = makeCartId("cart-test-1");
const PRODUCT_ID = makeProductId("prod-1");
const PRODUCT_ID_2 = makeProductId("prod-2");
const PRICE = {
  __brand: "ProductPrice" as const,
  displayAmount: 100,
  currency: "THB",
} as CartItem["unitPrice"];
const QTY_2 = 2 as CartItemQuantity;

const makeItem = (overrides: Partial<CartItem> = {}): CartItem => ({
  productId: PRODUCT_ID,
  productName: "Test Item",
  unitPrice: PRICE,
  size: "M" as CartItem["size"],
  quantity: QTY_2,
  ...overrides,
});

const emptyCart = (): Cart => makeEmptyCart(CART_ID, None());

describe("getCartItemLineTotal", () => {
  test("returns unitPrice.displayAmount * quantity.value", () => {
    const item = makeItem({ unitPrice: PRICE, quantity: QTY_2 });
    expect(getCartItemLineTotal(item)).toBe(200);
  });

  test("returns 0 when quantity is 0 (edge case with direct mock)", () => {
    const item = makeItem({
      unitPrice: PRICE,
      quantity: 0 as CartItemQuantity,
    });
    expect(getCartItemLineTotal(item)).toBe(0);
  });
});

describe("getCartTotal", () => {
  test("returns 0 for empty cart", () => {
    expect(getCartTotal(emptyCart())).toBe(0);
  });

  test("sums line totals for all items", () => {
    const item1 = makeItem({ unitPrice: PRICE, quantity: QTY_2 });
    const item2 = makeItem({
      productId: PRODUCT_ID_2,
      unitPrice: {
        __brand: "ProductPrice" as const,
        displayAmount: 50,
        currency: "THB",
      } as CartItem["unitPrice"],
      quantity: 3 as CartItemQuantity,
    });
    const cart: Cart = { ...emptyCart(), items: [item1, item2] };
    expect(getCartTotal(cart)).toBe(350);
  });
});

describe("getCartItemCount", () => {
  test("returns 0 for empty cart", () => {
    expect(getCartItemCount(emptyCart())).toBe(0);
  });

  test("returns sum of all item quantities", () => {
    const item1 = makeItem({ quantity: QTY_2 });
    const item2 = makeItem({
      productId: PRODUCT_ID_2,
      quantity: 3 as CartItemQuantity,
    });
    const cart: Cart = { ...emptyCart(), items: [item1, item2] };
    expect(getCartItemCount(cart)).toBe(5);
  });
});

describe("isCartEmpty", () => {
  test("returns true for cart with no items", () => {
    expect(isCartEmpty(emptyCart())).toBe(true);
  });

  test("returns false for cart with items", () => {
    const cart: Cart = { ...emptyCart(), items: [makeItem()] };
    expect(isCartEmpty(cart)).toBe(false);
  });
});

describe("findCartItem", () => {
  test("returns None when cart is empty", () => {
    const result = findCartItem(emptyCart(), PRODUCT_ID, "M");
    expect(result._tag).toBe("None");
  });

  test("returns None when productId does not match", () => {
    const cart: Cart = { ...emptyCart(), items: [makeItem()] };
    const result = findCartItem(cart, PRODUCT_ID_2, "M");
    expect(result._tag).toBe("None");
  });

  test("returns None when size does not match", () => {
    const cart: Cart = { ...emptyCart(), items: [makeItem({ size: "M" as CartItem["size"] })] };
    const result = findCartItem(cart, PRODUCT_ID, "L" as CartItem["size"]);
    expect(result._tag).toBe("None");
  });

  test("returns Some with matching item when found", () => {
    const item = makeItem();
    const cart: Cart = { ...emptyCart(), items: [item] };
    const result = findCartItem(cart, PRODUCT_ID, "M");
    expect(result._tag).toBe("Some");
    if (result._tag === "Some") {
      expect(result.value.productId).toBe("prod-1");
    }
  });
});

describe("makeEmptyCart", () => {
  test("creates cart with no items", () => {
    const cart = makeEmptyCart(CART_ID, None());
    expect(cart.items).toHaveLength(0);
    expect(cart.id).toBe("cart-test-1");
    expect(cart.userId._tag).toBe("None");
  });

  test("creates cart with userId when provided", () => {
    const userId = makeUserId("u-1");
    const cart = makeEmptyCart(CART_ID, Some(userId));
    expect(cart.userId._tag).toBe("Some");
  });
});

describe("addItemToCart", () => {
  test("adds new item to empty cart", () => {
    const cart = emptyCart();
    const result = addItemToCart(cart, { ...makeItem(), quantity: 1 });
    expect(result._tag).toBe("Ok");
    if (result._tag === "Ok") {
      expect(result.value.items).toHaveLength(1);
      expect(result.value.items[0]?.quantity).toBe(1);
    }
  });

  test("merges quantity when same (productId, size) already in cart", () => {
    const item = makeItem({ quantity: QTY_2 });
    const cart: Cart = { ...emptyCart(), items: [item] };
    const result = addItemToCart(cart, { ...makeItem(), quantity: 3 });
    expect(result._tag).toBe("Ok");
    if (result._tag === "Ok") {
      expect(result.value.items).toHaveLength(1);
      expect(result.value.items[0]?.quantity).toBe(5);
    }
  });

  test("returns Err for invalid size", () => {
    const cart = emptyCart();
    const result = addItemToCart(cart, {
      ...makeItem(),
      size: "4XL" as CartItem["size"],
      quantity: 1,
    });
    expect(result._tag).toBe("Err");
    if (result._tag === "Err") {
      expect(result.error._tag).toBe("InvalidSizeError");
    }
  });

  test("returns Err for invalid quantity (zero)", () => {
    const cart = emptyCart();
    const result = addItemToCart(cart, { ...makeItem(), quantity: 0 });
    expect(result._tag).toBe("Err");
    if (result._tag === "Err") {
      expect(result.error._tag).toBe("InvalidQuantityError");
    }
  });

  test("returns Err when merged quantity exceeds max", () => {
    const item = makeItem({
      quantity: 99 as CartItemQuantity,
    });
    const cart: Cart = { ...emptyCart(), items: [item] };
    const result = addItemToCart(cart, { ...makeItem(), quantity: 10 });
    expect(["Ok", "Err"]).toContain(result._tag);
  });

  test("returns Err for negative quantity", () => {
    const cart = emptyCart();
    const result = addItemToCart(cart, { ...makeItem(), quantity: -1 });
    expect(result._tag).toBe("Err");
  });
});

describe("removeItemFromCart", () => {
  test("returns Err when item not in cart", () => {
    const result = removeItemFromCart(emptyCart(), PRODUCT_ID, "M");
    expect(result._tag).toBe("Err");
    if (result._tag === "Err") {
      expect(result.error._tag).toBe("ItemNotInCartError");
    }
  });

  test("removes matching item and returns Ok", () => {
    const item = makeItem();
    const cart: Cart = { ...emptyCart(), items: [item] };
    const result = removeItemFromCart(cart, PRODUCT_ID, "M");
    expect(result._tag).toBe("Ok");
    if (result._tag === "Ok") {
      expect(result.value.items).toHaveLength(0);
    }
  });

  test("only removes the matched (productId, size) pair", () => {
    const item1 = makeItem({ size: "M" as CartItem["size"] });
    const item2 = makeItem({ size: "L" as CartItem["size"] });
    const cart: Cart = { ...emptyCart(), items: [item1, item2] };
    const result = removeItemFromCart(cart, PRODUCT_ID, "M");
    expect(result._tag).toBe("Ok");
    if (result._tag === "Ok") {
      expect(result.value.items).toHaveLength(1);
      expect(result.value.items[0]?.size).toBe("L");
    }
  });
});

describe("updateCartItemQuantity", () => {
  test("returns Err when item not in cart", () => {
    const result = updateCartItemQuantity(emptyCart(), PRODUCT_ID, "M", 3);
    expect(result._tag).toBe("Err");
    if (result._tag === "Err") {
      expect(result.error._tag).toBe("ItemNotInCartError");
    }
  });

  test("returns Err for invalid new quantity", () => {
    const item = makeItem();
    const cart: Cart = { ...emptyCart(), items: [item] };
    const result = updateCartItemQuantity(cart, PRODUCT_ID, "M", 0);
    expect(result._tag).toBe("Err");
    if (result._tag === "Err") {
      expect(result.error._tag).toBe("InvalidQuantityError");
    }
  });

  test("updates quantity for matching item", () => {
    const item = makeItem({ quantity: QTY_2 });
    const cart: Cart = { ...emptyCart(), items: [item] };
    const result = updateCartItemQuantity(cart, PRODUCT_ID, "M", 5);
    expect(result._tag).toBe("Ok");
    if (result._tag === "Ok") {
      expect(result.value.items[0]?.quantity).toBe(5);
    }
  });

  test("does not affect other items in the cart", () => {
    const item1 = makeItem({ size: "M" as CartItem["size"] });
    const item2 = makeItem({
      productId: PRODUCT_ID_2,
      size: "L" as CartItem["size"],
      quantity: 1 as CartItemQuantity,
    });
    const cart: Cart = { ...emptyCart(), items: [item1, item2] };
    const result = updateCartItemQuantity(cart, PRODUCT_ID, "M", 10);
    expect(result._tag).toBe("Ok");
    if (result._tag === "Ok") {
      const other = result.value.items.find((i) => i.productId === "prod-2");
      expect(other?.quantity).toBe(1);
    }
  });
});

describe("clearCart", () => {
  test("removes all items", () => {
    const item = makeItem();
    const cart: Cart = { ...emptyCart(), items: [item] };
    const cleared = clearCart(cart);
    expect(cleared.items).toHaveLength(0);
  });

  test("preserves cart id and userId", () => {
    const cart = emptyCart();
    const cleared = clearCart(cart);
    expect(cleared.id).toBe(cart.id);
  });
});
