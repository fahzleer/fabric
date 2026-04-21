import type { DomainEvent } from "./events";
import type { Brand, TaggedError } from "./kernel";

const makeDomainEventInternal = <TType extends string, TPayload>(
  _type: TType,
  payload: TPayload
): DomainEvent<TType, TPayload> => ({
  _type,
  _version: 1,
  eventId: crypto.randomUUID(),
  occurredAt: new Date().toISOString(),
  payload,
});

export type CartId = Brand<string, "CartId">;
export const makeCartId = (value: string): CartId => value as CartId;

export interface CartItemQuantityError extends TaggedError<"CartItemQuantityError"> {}
export type CartItemQuantity = Brand<number, "CartItemQuantity">;

export const makeCartItemQuantity = (n: number): CartItemQuantity | CartItemQuantityError => {
  if (!Number.isInteger(n) || n < 1 || n > 99) {
    return {
      _tag: "CartItemQuantityError",
      message: `Cart item quantity must be between 1 and 99, got: ${n}`,
    };
  }
  return n as CartItemQuantity;
};

export interface CartNotFoundError extends TaggedError<"CartNotFoundError"> {}
export const CartNotFoundError = (cartId: string): CartNotFoundError => ({
  _tag: "CartNotFoundError",
  message: `Cart not found: ${cartId}`,
});

export interface ItemNotInCartError extends TaggedError<"ItemNotInCartError"> {}
export const ItemNotInCartError = (productId: string, size: string): ItemNotInCartError => ({
  _tag: "ItemNotInCartError",
  message: `Item not in cart: ${productId} size ${size}`,
});

export interface InvalidQuantityError extends TaggedError<"InvalidQuantityError"> {}
export const InvalidQuantityError = (message: string): InvalidQuantityError => ({
  _tag: "InvalidQuantityError",
  message,
});

export interface InvalidSizeError extends TaggedError<"InvalidSizeError"> {}
export const InvalidSizeError = (size: string): InvalidSizeError => ({
  _tag: "InvalidSizeError",
  message: `Invalid size: ${size}`,
});

export type CartError =
  | CartNotFoundError
  | ItemNotInCartError
  | InvalidQuantityError
  | InvalidSizeError;

export type CartCreatedPayload = { readonly cartId: string; readonly userId?: string };
export type CartCreated = DomainEvent<"CartCreated", CartCreatedPayload>;
export const makeCartCreated = (payload: CartCreatedPayload): CartCreated =>
  makeDomainEventInternal("CartCreated", payload);

export type ItemAddedToCartPayload = {
  readonly cartId: string;
  readonly productId: string;
  readonly size: string;
  readonly quantity: number;
  readonly unitPriceInCents: number;
  readonly currency: string;
};
export type ItemAddedToCart = DomainEvent<"ItemAddedToCart", ItemAddedToCartPayload>;
export const makeItemAddedToCart = (payload: ItemAddedToCartPayload): ItemAddedToCart =>
  makeDomainEventInternal("ItemAddedToCart", payload);

export type ItemRemovedFromCartPayload = {
  readonly cartId: string;
  readonly productId: string;
  readonly size: string;
};
export type ItemRemovedFromCart = DomainEvent<"ItemRemovedFromCart", ItemRemovedFromCartPayload>;
export const makeItemRemovedFromCart = (payload: ItemRemovedFromCartPayload): ItemRemovedFromCart =>
  makeDomainEventInternal("ItemRemovedFromCart", payload);

export type CartItemQuantityUpdatedPayload = {
  readonly cartId: string;
  readonly productId: string;
  readonly size: string;
  readonly previousQuantity: number;
  readonly newQuantity: number;
};
export type CartItemQuantityUpdated = DomainEvent<
  "CartItemQuantityUpdated",
  CartItemQuantityUpdatedPayload
>;
export const makeCartItemQuantityUpdated = (
  payload: CartItemQuantityUpdatedPayload
): CartItemQuantityUpdated => makeDomainEventInternal("CartItemQuantityUpdated", payload);

export type CartClearedPayload = { readonly cartId: string };
export type CartCleared = DomainEvent<"CartCleared", CartClearedPayload>;
export const makeCartCleared = (payload: CartClearedPayload): CartCleared =>
  makeDomainEventInternal("CartCleared", payload);

export type CartAbandonedPayload = { readonly cartId: string; readonly userId?: string };
export type CartAbandoned = DomainEvent<"CartAbandoned", CartAbandonedPayload>;
export const makeCartAbandoned = (payload: CartAbandonedPayload): CartAbandoned =>
  makeDomainEventInternal("CartAbandoned", payload);

export type CartSyncedPayload = { readonly cartId: string; readonly userId: string };
export type CartSynced = DomainEvent<"CartSynced", CartSyncedPayload>;
export const makeCartSynced = (payload: CartSyncedPayload): CartSynced =>
  makeDomainEventInternal("CartSynced", payload);

export type CartDomainEvent =
  | CartCreated
  | ItemAddedToCart
  | ItemRemovedFromCart
  | CartItemQuantityUpdated
  | CartCleared
  | CartAbandoned
  | CartSynced;
