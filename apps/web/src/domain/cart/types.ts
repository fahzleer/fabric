import type {
  ProductId,
  ProductImage,
  ProductName,
  ProductPrice,
  ProductSize,
} from "@fabric/types";
import { formatPrice } from "../../lib/price";

export type {
  CartId,
  CartItemQuantity,
  CartItemQuantityError,
  CartNotFoundError,
  ItemNotInCartError,
  InvalidQuantityError,
  InvalidSizeError,
  CartError,
  CartDomainEvent,
  CartCreated,
  ItemAddedToCart,
  ItemRemovedFromCart,
  CartItemQuantityUpdated,
  CartCleared,
  CartAbandoned,
  CartSynced,
} from "@fabric/types";

export {
  makeCartId,
  makeCartItemQuantity,
  makeCartCreated,
  makeItemAddedToCart,
  makeItemRemovedFromCart,
  makeCartItemQuantityUpdated,
  makeCartCleared,
  makeCartAbandoned,
  makeCartSynced,
} from "@fabric/types";

import type { ItemNotInCartError } from "@fabric/types";
export type CartItemNotFoundError = ItemNotInCartError;

import type { InvalidQuantityError } from "@fabric/types";
export type CartInvalidQuantityError = InvalidQuantityError;

export interface CartItem {
  readonly productId: ProductId;
  readonly size: ProductSize;
  readonly quantity: number;
  readonly productSnapshot: {
    readonly name: ProductName;
    readonly price: ProductPrice;
    readonly image: ProductImage;
  };
}

export interface ShoppingCart {
  readonly id: string;
  readonly items: readonly CartItem[];
  readonly updatedAt: string;
}

export const getCartItemLineTotal = (item: CartItem): number =>
  item.productSnapshot.price.displayAmount * item.quantity;

export const getCartTotal = (cart: ShoppingCart): number =>
  cart.items.reduce((sum, item) => sum + getCartItemLineTotal(item), 0);

export const getCartItemCount = (cart: ShoppingCart): number =>
  cart.items.reduce((sum, item) => sum + item.quantity, 0);

export const isCartEmpty = (cart: ShoppingCart): boolean => cart.items.length === 0;

export const formatCartTotal = (cart: ShoppingCart): string => {
  const firstItem = cart.items[0];
  const currency = firstItem !== undefined ? firstItem.productSnapshot.price.currency : "THB";
  return formatPrice({ amount: getCartTotal(cart), currency });
};
