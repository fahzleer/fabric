import type { FirebaseCartItemRecord } from "@fabric/firebase";
import { CartNotFoundError } from "@fabric/types";
import { None, Some, isSome } from "@fabric/types";
import type { RepositoryError } from "@fabric/types";
import type { Maybe, Result } from "@fabric/types";
import { Temporal } from "@js-temporal/polyfill";
import type { Database } from "firebase-admin/database";
import type { CartRepositoryPort } from "../../application/ports/cart.repository.port";
import {
  Deleted,
  type DeletedResult,
  makeRepositoryError,
} from "../../application/ports/product.repository.port";
import type { Cart, CartItem } from "../../domain/cart/cart.entity";
import type { CartNotFoundError as CartNotFoundErrorType } from "../../domain/cart/cart.errors";
import type { CartId } from "../../domain/cart/cart.value-objects";
import { makeProductId } from "../../domain/product/product.value-objects";
import type { ProductSize } from "../../domain/product/product.value-objects";
import type { UserId } from "../../domain/user/user.value-objects";

function cartKey(cart: Cart): string {
  return isSome(cart.userId) ? cart.userId.value.value : `anon_${cart.id.value}`;
}

interface CartMeta {
  id: string;
  userId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export class FirebaseCartRepository implements CartRepositoryPort {
  constructor(private readonly db: Database) {}

  async findById(id: CartId): Promise<Result<Cart, CartNotFoundErrorType | RepositoryError>> {
    try {
      const snap = await this.db
        .ref("carts")
        .orderByChild("meta/id")
        .equalTo(id.value)
        .once("value");

      if (!snap.exists()) {
        return { _tag: "Err", error: CartNotFoundError(id.value) };
      }

      let cart: Cart | undefined;
      snap.forEach((child) => {
        const data = child.val() as {
          meta: CartMeta;
          items?: Record<string, FirebaseCartItemRecord>;
        };
        if (data.meta?.deletedAt) return;
        cart = this.recordToCart(child.key ?? "", data);
      });

      if (cart === undefined) {
        return { _tag: "Err", error: CartNotFoundError(id.value) };
      }

      return { _tag: "Ok", value: cart };
    } catch (cause) {
      return { _tag: "Err", error: makeRepositoryError(`Failed to find cart ${id.value}`, cause) };
    }
  }

  async findByUserId(userId: UserId): Promise<Result<Maybe<Cart>, RepositoryError>> {
    try {
      const snap = await this.db.ref(`carts/${userId.value}`).once("value");
      if (!snap.exists()) {
        return { _tag: "Ok", value: None() };
      }
      const data = snap.val() as { meta: CartMeta; items?: Record<string, FirebaseCartItemRecord> };
      if (data.meta?.deletedAt) {
        return { _tag: "Ok", value: None() };
      }
      const cart = this.recordToCart(userId.value, data);
      return { _tag: "Ok", value: Some(cart) };
    } catch (cause) {
      return {
        _tag: "Err",
        error: makeRepositoryError(`Failed to find cart for user ${userId.value}`, cause),
      };
    }
  }

  async save(cart: Cart): Promise<Result<Cart, RepositoryError>> {
    try {
      const key = cartKey(cart);
      const meta: CartMeta = {
        id: cart.id.value,
        userId: isSome(cart.userId) ? cart.userId.value.value : null,
        createdAt: cart.createdAt.toString(),
        updatedAt: Temporal.Now.instant().toString(),
      };

      const items: Record<string, FirebaseCartItemRecord> = {};
      for (const item of cart.items) {
        const itemKey = `${item.productId.value}_${item.size}`;
        items[itemKey] = {
          qty: item.quantity.value,
          priceCents: Math.round(item.unitPrice.amount * 100),
          productName: item.productName,
          size: item.size,
          addedAt: Temporal.Now.instant().toString(),
        };
      }

      await this.db.ref(`carts/${key}`).set({ meta, items });
      return { _tag: "Ok", value: cart };
    } catch (cause) {
      return {
        _tag: "Err",
        error: makeRepositoryError(`Failed to save cart ${cart.id.value}`, cause),
      };
    }
  }

  async delete(
    id: CartId
  ): Promise<Result<DeletedResult, CartNotFoundErrorType | RepositoryError>> {
    try {
      const snap = await this.db
        .ref("carts")
        .orderByChild("meta/id")
        .equalTo(id.value)
        .once("value");

      if (!snap.exists()) {
        return { _tag: "Err", error: CartNotFoundError(id.value) };
      }

      const now = Temporal.Now.instant().toString();
      const updates: Record<string, string> = {};
      snap.forEach((child) => {
        if (child.key) {
          updates[`carts/${child.key}/meta/deletedAt`] = now;
          updates[`carts/${child.key}/meta/updatedAt`] = now;
        }
      });
      await this.db.ref().update(updates);

      return { _tag: "Ok", value: Deleted };
    } catch (cause) {
      return {
        _tag: "Err",
        error: makeRepositoryError(`Failed to delete cart ${id.value}`, cause),
      };
    }
  }

  private recordToCart(
    _key: string,
    data: { meta: CartMeta; items?: Record<string, FirebaseCartItemRecord> }
  ): Cart {
    const meta = data.meta;
    const rawItems = data.items ?? {};

    const _cartItems: CartItem[] = Object.entries(rawItems).map(([, item]) => ({
      productId: makeProductId(item.size.split("_")[0] ?? ""),
      productName: item.productName,
      unitPrice: {
        __brand: "ProductPrice" as const,
        amount: item.priceCents / 100,
        currency: "THB" as Cart["items"][number]["unitPrice"]["currency"],
      },
      size: item.size as ProductSize,
      quantity: { __brand: "CartItemQuantity" as const, value: item.qty },
    }));

    const cartItemsWithId: CartItem[] = Object.entries(rawItems).map(([itemKey, item]) => {
      const lastUnderscoreIdx = itemKey.lastIndexOf("_");
      const productIdStr = itemKey.substring(0, lastUnderscoreIdx);
      return {
        productId: makeProductId(productIdStr),
        productName: item.productName,
        unitPrice: {
          __brand: "ProductPrice" as const,
          amount: item.priceCents / 100,
          currency: "THB" as CartItem["unitPrice"]["currency"],
        },
        size: item.size as ProductSize,
        quantity: { __brand: "CartItemQuantity" as const, value: item.qty },
      };
    });

    return {
      id: { __brand: "CartId" as const, value: meta.id } as CartId,
      userId:
        meta.userId !== null
          ? Some({ __brand: "UserId" as const, value: meta.userId } as UserId)
          : None<UserId>(),
      items: cartItemsWithId,
      createdAt: Temporal.Instant.from(meta.createdAt),
      updatedAt: Temporal.Instant.from(meta.updatedAt),
    };
  }
}
