import type { Effect } from "effect";
import type {
  CartInvalidQuantityError,
  CartItemNotFoundError,
  ShoppingCart,
} from "../../domain/cart/types";
import type { ProductId, ProductSize } from "../../domain/product/types";
import type { ProductOutOfStockError } from "../../domain/product/types";
import type { NetworkError } from "./product-api.port";

export interface CartPort {
  getCart(): Effect.Effect<ShoppingCart, NetworkError>;

  addItem(
    productId: ProductId,
    size: ProductSize,
    quantity: number
  ): Effect.Effect<ShoppingCart, ProductOutOfStockError | CartInvalidQuantityError | NetworkError>;

  removeItem(
    productId: ProductId,
    size: ProductSize
  ): Effect.Effect<ShoppingCart, CartItemNotFoundError | NetworkError>;

  updateQuantity(
    productId: ProductId,
    size: ProductSize,
    newQuantity: number
  ): Effect.Effect<ShoppingCart, CartItemNotFoundError | CartInvalidQuantityError | NetworkError>;

  clearCart(): Effect.Effect<ShoppingCart, NetworkError>;
}
