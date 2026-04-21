import type { Maybe } from "@fabric/types";
import { None, Some, isSome } from "@fabric/types";
import { InvalidQuantityError, InvalidSizeError, ItemNotInCartError } from "@fabric/types";
import { Temporal } from "@js-temporal/polyfill";
import type { ProductId, ProductPrice, ProductSize } from "../product/product.value-objects";
import { isValidSize } from "../product/product.value-objects";
import type { UserId } from "../user/user.value-objects";
import type {
  InvalidQuantityError as InvalidQuantityErrorType,
  InvalidSizeError as InvalidSizeErrorType,
  ItemNotInCartError as ItemNotInCartErrorType,
} from "./cart.errors";
import type { CartId, CartItemQuantity } from "./cart.value-objects";
import { makeCartItemQuantity } from "./cart.value-objects";

export interface CartItem {
  readonly productId: ProductId;
  readonly productName: string;
  readonly unitPrice: ProductPrice;
  readonly size: ProductSize;
  readonly quantity: CartItemQuantity;
}

export const getCartItemLineTotal = (item: CartItem): number =>
  item.unitPrice.displayAmount * item.quantity;

export interface Cart {
  readonly id: CartId;
  readonly userId: Maybe<UserId>;
  readonly items: readonly CartItem[];
  readonly createdAt: Temporal.Instant;
  readonly updatedAt: Temporal.Instant;
}

export const getCartTotal = (cart: Cart): number =>
  cart.items.reduce((sum, item) => sum + getCartItemLineTotal(item), 0);

export const getCartItemCount = (cart: Cart): number =>
  cart.items.reduce((sum, item) => sum + item.quantity, 0);

export const isCartEmpty = (cart: Cart): boolean => cart.items.length === 0;

export const findCartItem = (
  cart: Cart,
  productId: ProductId,
  size: ProductSize
): Maybe<CartItem> => {
  const found = cart.items.find((item) => item.productId === productId && item.size === size);
  return found !== undefined ? Some(found) : None<CartItem>();
};

export const makeEmptyCart = (id: CartId, userId: Maybe<UserId>): Cart => ({
  id,
  userId,
  items: [],
  createdAt: Temporal.Now.instant(),
  updatedAt: Temporal.Now.instant(),
});

export const addItemToCart = (
  cart: Cart,
  item: Omit<CartItem, "quantity"> & { quantity: number }
):
  | { _tag: "Ok"; value: Cart }
  | { _tag: "Err"; error: InvalidQuantityErrorType | InvalidSizeErrorType } => {
  if (!isValidSize(item.size)) return { _tag: "Err", error: InvalidSizeError(item.size) };

  const qtyResult = makeCartItemQuantity(item.quantity);
  if (typeof qtyResult !== "number")
    return { _tag: "Err", error: InvalidQuantityError(qtyResult.message) };

  const existingIndex = cart.items.findIndex(
    (i) => i.productId === item.productId && i.size === item.size
  );

  if (existingIndex !== -1) {
    const existing = cart.items[existingIndex];
    if (existing === undefined)
      return { _tag: "Err", error: InvalidQuantityError("Cart item not found at expected index") };
    const newQty = (existing.quantity as number) + item.quantity;
    const newQtyResult = makeCartItemQuantity(newQty);
    if (typeof newQtyResult !== "number")
      return { _tag: "Err", error: InvalidQuantityError(newQtyResult.message) };

    const updatedItems = cart.items.map((cartItem, idx) =>
      idx === existingIndex ? { ...cartItem, quantity: newQtyResult } : cartItem
    );
    return {
      _tag: "Ok",
      value: { ...cart, items: updatedItems, updatedAt: Temporal.Now.instant() },
    };
  }

  const newItem: CartItem = { ...item, quantity: qtyResult };
  return {
    _tag: "Ok",
    value: {
      ...cart,
      items: [...cart.items, newItem],
      updatedAt: Temporal.Now.instant(),
    },
  };
};

export const removeItemFromCart = (
  cart: Cart,
  productId: ProductId,
  size: ProductSize
): { _tag: "Ok"; value: Cart } | { _tag: "Err"; error: ItemNotInCartErrorType } => {
  const exists = isSome(findCartItem(cart, productId, size));
  if (!exists)
    return {
      _tag: "Err",
      error: ItemNotInCartError(productId, size),
    };

  return {
    _tag: "Ok",
    value: {
      ...cart,
      items: cart.items.filter((item) => !(item.productId === productId && item.size === size)),
      updatedAt: Temporal.Now.instant(),
    },
  };
};

export const updateCartItemQuantity = (
  cart: Cart,
  productId: ProductId,
  size: ProductSize,
  newQuantity: number
):
  | { _tag: "Ok"; value: Cart }
  | { _tag: "Err"; error: ItemNotInCartErrorType | InvalidQuantityErrorType } => {
  const existingMaybe = findCartItem(cart, productId, size);
  if (!isSome(existingMaybe))
    return {
      _tag: "Err",
      error: ItemNotInCartError(productId, size),
    };

  const qtyResult = makeCartItemQuantity(newQuantity);
  if (typeof qtyResult !== "number")
    return { _tag: "Err", error: InvalidQuantityError(qtyResult.message) };

  return {
    _tag: "Ok",
    value: {
      ...cart,
      items: cart.items.map((item) =>
        item.productId === productId && item.size === size ? { ...item, quantity: qtyResult } : item
      ),
      updatedAt: Temporal.Now.instant(),
    },
  };
};

export const clearCart = (cart: Cart): Cart => ({
  ...cart,
  items: [],
  updatedAt: Temporal.Now.instant(),
});
