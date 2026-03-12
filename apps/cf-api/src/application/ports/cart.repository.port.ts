import type { Maybe, Result } from "@fabric/types";
import type { Cart } from "../../domain/cart";
import type { CartNotFoundError } from "../../domain/cart/cart.errors";
import type { CartId } from "../../domain/cart/cart.value-objects";
import type { UserId } from "../../domain/user/user.value-objects";
import type { DeletedResult, RepositoryError } from "./product.repository.port";

export interface CartRepositoryPort {
  findById(id: CartId): Promise<Result<Cart, CartNotFoundError | RepositoryError>>;
  findByUserId(userId: UserId): Promise<Result<Maybe<Cart>, RepositoryError>>;
  save(cart: Cart): Promise<Result<Cart, RepositoryError>>;
  delete(id: CartId): Promise<Result<DeletedResult, CartNotFoundError | RepositoryError>>;
}

export const CART_REPOSITORY = Symbol("CART_REPOSITORY");
