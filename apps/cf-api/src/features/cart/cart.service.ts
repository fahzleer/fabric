import { Some } from "@fabric/types";
import { makeCartId } from "@fabric/types";
import { Temporal } from "@js-temporal/polyfill";
import type { ActivityRepositoryPort } from "../../application/ports/activity.repository.port";
import type { CartRepositoryPort } from "../../application/ports/cart.repository.port";
import type { ProductRepositoryPort } from "../../application/ports/product.repository.port";
import {
  addItemToCart,
  makeEmptyCart,
  removeItemFromCart,
  updateCartItemQuantity,
} from "../../domain/cart/cart.entity";
import type { ProductSize } from "../../domain/product/product.value-objects";
import { makeProductId } from "../../domain/product/product.value-objects";
import type { UserId } from "../../domain/user/user.value-objects";
import { presentDomainError } from "../shared/http-error.presenter";

export class CartService {
  constructor(
    private readonly carts: CartRepositoryPort,
    private readonly products: ProductRepositoryPort,
    private readonly activity: ActivityRepositoryPort
  ) {}

  async getOrCreateCart(userId: UserId) {
    const result = await this.carts.findByUserId(userId);
    if (result._tag === "Err") return presentDomainError(result.error);

    if (result.value._tag === "Some") {
      return result.value.value;
    }

    const newCart = makeEmptyCart(makeCartId(crypto.randomUUID()), Some(userId));
    const saved = await this.carts.save(newCart);
    if (saved._tag === "Err") return presentDomainError(saved.error);
    return newCart;
  }

  async addItem(userId: UserId, productId: string, size: string, quantity: number) {
    const cart = await this.getOrCreateCart(userId);

    const productResult = await this.products.findById(makeProductId(productId));
    if (productResult._tag === "Err") return presentDomainError(productResult.error);
    const product = productResult.value;

    const addResult = addItemToCart(cart, {
      productId: makeProductId(productId),
      productName: product.name,
      unitPrice: product.price,
      size: size as ProductSize,
      quantity,
    });
    if (addResult._tag === "Err") return presentDomainError(addResult.error);

    const saved = await this.carts.save(addResult.value);
    if (saved._tag === "Err") return presentDomainError(saved.error);

    void this.activity.track({
      id: crypto.randomUUID(),
      userId: userId,
      eventType: "cart_item_added",
      eventData: { productId, size, quantity },
    });

    return addResult.value;
  }

  async removeItem(userId: UserId, productId: string, size: string) {
    const cart = await this.getOrCreateCart(userId);

    const removeResult = removeItemFromCart(cart, makeProductId(productId), size as ProductSize);
    if (removeResult._tag === "Err") return presentDomainError(removeResult.error);

    const saved = await this.carts.save(removeResult.value);
    if (saved._tag === "Err") return presentDomainError(saved.error);

    void this.activity.track({
      id: crypto.randomUUID(),
      userId: userId,
      eventType: "cart_item_removed",
      eventData: { productId, size },
    });

    return removeResult.value;
  }

  async updateItemQty(userId: UserId, productId: string, size: string, quantity: number) {
    const cart = await this.getOrCreateCart(userId);

    const updateResult = updateCartItemQuantity(
      cart,
      makeProductId(productId),
      size as ProductSize,
      quantity
    );
    if (updateResult._tag === "Err") return presentDomainError(updateResult.error);

    const saved = await this.carts.save(updateResult.value);
    if (saved._tag === "Err") return presentDomainError(saved.error);

    void this.activity.track({
      id: crypto.randomUUID(),
      userId: userId,
      eventType: "cart_item_quantity_updated",
      eventData: { productId, size, quantity },
    });

    return updateResult.value;
  }

  async clearCart(userId: UserId) {
    const result = await this.carts.findByUserId(userId);
    if (result._tag === "Err") return presentDomainError(result.error);
    if (result.value._tag === "None") return { cleared: true };

    const cart = result.value.value;
    const cleared = { ...cart, items: [], updatedAt: Temporal.Now.instant() };
    await this.carts.save(cleared);
    return { cleared: true };
  }
}
