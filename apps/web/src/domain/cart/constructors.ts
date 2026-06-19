import type { ProductId, ProductSize, Result, TaggedError } from "@fabric/types";
import { Err, Ok } from "@fabric/types";
import { Temporal } from "@js-temporal/polyfill";
import type { CartItem, ShoppingCart } from "./types";

export const makeEmptyCart = (id: string): ShoppingCart => ({
  id,
  items: [],
  updatedAt: Temporal.Now.instant().toString(),
});

export const addItemToCart = (cart: ShoppingCart, item: CartItem): ShoppingCart => {
  const existingIdx = cart.items.findIndex(
    (i) => i.productId.value === item.productId.value && i.size === item.size
  );

  const newItems =
    existingIdx !== -1
      ? cart.items.map((i, idx) =>
          idx === existingIdx ? { ...i, quantity: i.quantity + item.quantity } : i
        )
      : [...cart.items, item];

  return {
    ...cart,
    items: newItems,
    updatedAt: Temporal.Now.instant().toString(),
  };
};

export const removeItemFromCart = (
  cart: ShoppingCart,
  productId: ProductId,
  size: ProductSize
): ShoppingCart => ({
  ...cart,
  items: cart.items.filter((i) => !(i.productId.value === productId.value && i.size === size)),
  updatedAt: Temporal.Now.instant().toString(),
});

export type CartQuantityError = TaggedError<"CartQuantityError">;

export const updateCartItemQuantity = (
  cart: ShoppingCart,
  productId: ProductId,
  size: ProductSize,
  quantity: number
): Result<ShoppingCart, CartQuantityError> => {
  if (quantity <= 0 || quantity > 99)
    return Err({
      _tag: "CartQuantityError",
      message: `Quantity must be between 1 and 99, got ${quantity}`,
    });

  return Ok({
    ...cart,
    items: cart.items.map((item) =>
      item.productId.value === productId.value && item.size === size ? { ...item, quantity } : item
    ),
    updatedAt: Temporal.Now.instant().toString(),
  });
};

export const clearCart = (cart: ShoppingCart): ShoppingCart => ({
  ...cart,
  items: [],
  updatedAt: Temporal.Now.instant().toString(),
});
