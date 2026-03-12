"use client";

import { NetworkError } from "@/application/ports/product-api.port";
import type { ShoppingCart } from "@/domain/cart/types";
import type { CartInvalidQuantityError, CartItemNotFoundError } from "@/domain/cart/types";
import type { ProductId, ProductSize } from "@/domain/product/types";
import type { ProductOutOfStockError } from "@/domain/product/types";
import BigNumber from "bignumber.js";
import { Effect } from "effect";
import { type DexieCartItem, cartDb, dexieItemsToCart } from "./cart.db";

function makeItemKey(productId: string, size: string): string {
  return `${productId}:${size}`;
}

export const dexieCartAdapter = {
  getCart(): Effect.Effect<ShoppingCart, NetworkError> {
    return Effect.tryPromise({
      try: async () => {
        const items = await cartDb.cartItems.toArray();
        return dexieItemsToCart(items);
      },
      catch: (e) => NetworkError(e),
    });
  },

  addItem(
    productId: ProductId,
    size: ProductSize,
    quantity: number,
    priceSnapshot?: {
      amount: number;
      currency: string;
      productName: string;
      productImageUrl: string;
    }
  ): Effect.Effect<ShoppingCart, ProductOutOfStockError | CartInvalidQuantityError | NetworkError> {
    return Effect.tryPromise({
      try: async () => {
        const key = makeItemKey(productId.value, size);
        const existing = await cartDb.cartItems.get(key);
        
        const newQty = existing
          ? new BigNumber(existing.quantity).plus(quantity).toNumber()
          : quantity;

        const itemData: DexieCartItem = {
          id: key,
          productId: productId.value,
          size,
          quantity: newQty,
          unitPriceCents: priceSnapshot?.amount != null
            ? Math.round(priceSnapshot.amount * 100)
            : (existing?.unitPriceCents ?? 0),
          currency: priceSnapshot?.currency ?? existing?.currency ?? "THB",
          productName: priceSnapshot?.productName ?? existing?.productName ?? "",
          productImageUrl: priceSnapshot?.productImageUrl ?? existing?.productImageUrl ?? "",
          addedAt: existing?.addedAt ?? new Date().toISOString(),
        };

        await cartDb.cartItems.put(itemData);
        const items = await cartDb.cartItems.toArray();
        return dexieItemsToCart(items);
      },
      catch: (e) => NetworkError(e),
    });
  },

  removeItem(
    productId: ProductId,
    size: ProductSize
  ): Effect.Effect<ShoppingCart, CartItemNotFoundError | NetworkError> {
    return Effect.tryPromise({
      try: async () => {
        const key = makeItemKey(productId.value, size);
        await cartDb.cartItems.delete(key);
        const items = await cartDb.cartItems.toArray();
        return dexieItemsToCart(items);
      },
      catch: (e) => NetworkError(e),
    });
  },

  updateQuantity(
    productId: ProductId,
    size: ProductSize,
    newQuantity: number
  ): Effect.Effect<ShoppingCart, CartItemNotFoundError | CartInvalidQuantityError | NetworkError> {
    return Effect.tryPromise({
      try: async () => {
        const key = makeItemKey(productId.value, size);
        const qty = new BigNumber(newQuantity).toNumber();
        await cartDb.cartItems.update(key, { quantity: qty });
        const items = await cartDb.cartItems.toArray();
        return dexieItemsToCart(items);
      },
      catch: (e) => NetworkError(e),
    });
  },

  clearCart(): Effect.Effect<ShoppingCart, NetworkError> {
    return Effect.tryPromise({
      try: async () => {
        await cartDb.cartItems.clear();
        return dexieItemsToCart([]);
      },
      catch: (e) => NetworkError(e),
    });
  },
};
