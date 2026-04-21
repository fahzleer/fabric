import { makeItemAddedToCart, makeItemRemovedFromCart } from "@fabric/types";
import { Effect } from "effect";
import type { CartInvalidQuantityError, ShoppingCart } from "../../domain/cart/types";
import type { ProductId, ProductOutOfStockError, ProductSize } from "../../domain/product/types";
import type { ProductPrice } from "../../domain/product/types";
import type { CartPort } from "../ports/cart.port";
import type { ClientEventBusPort } from "../ports/event-bus.port";
import type { NetworkError } from "../ports/product-api.port";

export type AddToCartInput = {
  readonly productId: ProductId;
  readonly size: ProductSize;
  readonly quantity: number;
  readonly unitPrice: ProductPrice;
};

export type AddToCartOutput = {
  readonly cart: ShoppingCart;
};

export const addToCartUseCase = (
  input: AddToCartInput,
  deps: {
    readonly cart: CartPort;
    readonly eventBus: ClientEventBusPort;
  }
): Effect.Effect<
  AddToCartOutput,
  ProductOutOfStockError | CartInvalidQuantityError | NetworkError
> =>
  Effect.gen(function* () {
    const updatedCart = yield* deps.cart.addItem(input.productId, input.size, input.quantity);

    yield* Effect.forkDaemon(
      deps.eventBus.publish(
        makeItemAddedToCart({
          cartId: updatedCart.id,
          productId: input.productId.value,
          size: input.size,
          quantity: input.quantity,
          unitPriceInCents: Math.round(input.unitPrice.displayAmount * 100),
          currency: input.unitPrice.currency,
        })
      )
    );

    return { cart: updatedCart };
  });

export type RemoveFromCartInput = {
  readonly productId: ProductId;
  readonly size: ProductSize;
};

export type RemoveFromCartOutput = {
  readonly cart: ShoppingCart;
};

import type { CartItemNotFoundError } from "../../domain/cart/types";

export const removeFromCartUseCase = (
  input: RemoveFromCartInput,
  deps: {
    readonly cart: CartPort;
    readonly eventBus: ClientEventBusPort;
  }
): Effect.Effect<RemoveFromCartOutput, CartItemNotFoundError | NetworkError> =>
  Effect.gen(function* () {
    const updatedCart = yield* deps.cart.removeItem(input.productId, input.size);

    yield* Effect.forkDaemon(
      deps.eventBus.publish(
        makeItemRemovedFromCart({
          cartId: updatedCart.id,
          productId: input.productId.value,
          size: input.size,
        })
      )
    );

    return { cart: updatedCart };
  });
