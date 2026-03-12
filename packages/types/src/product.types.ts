import { type } from "arktype";
import type { DomainEvent } from "./events";
import type { CurrencyCode, TaggedError } from "./kernel";

export type ProductId = { readonly __brand: "ProductId"; readonly value: string };
export const makeProductId = (value: string): ProductId => ({ __brand: "ProductId", value });
export const ProductIdSchema = type("string");

export interface ProductNameError extends TaggedError<"ProductNameError"> {}
export type ProductName = { readonly __brand: "ProductName"; readonly value: string };

export const makeProductName = (raw: string): ProductName | ProductNameError => {
  const trimmed = raw.trim();
  if (trimmed.length < 2 || trimmed.length > 120) {
    return {
      _tag: "ProductNameError",
      message: "Product name must be between 2 and 120 characters",
    };
  }
  return { __brand: "ProductName", value: trimmed };
};

export const ProductNameSchema = type("2 <= string <= 120");

export interface ProductPriceError extends TaggedError<"ProductPriceError"> {}
export type ProductPrice = {
  readonly __brand: "ProductPrice";
  readonly amount: number;
  readonly currency: CurrencyCode;
};

export const makeProductPrice = (
  amount: number,
  currency: CurrencyCode
): ProductPrice | ProductPriceError => {
  if (!Number.isFinite(amount) || amount < 0) {
    return {
      _tag: "ProductPriceError",
      message: `Price must be a non-negative number, got: ${amount}`,
    };
  }
  return { __brand: "ProductPrice", amount, currency };
};

export const makeProductPriceFromCents = (cents: number, currency: CurrencyCode): ProductPrice => ({
  __brand: "ProductPrice",
  amount: cents / 100,
  currency,
});

export const formatProductPrice = (price: ProductPrice): string => {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: price.currency,
    minimumFractionDigits: Number.isInteger(price.amount) ? 0 : 2,
  }).format(price.amount);
};

export const ProductPriceSchema = type({ amount: "number >= 0", currency: "string" });

export type ProductSize = "XS" | "S" | "M" | "L" | "XL" | "XXL" | "XXXL";

export const ALL_SIZES: readonly ProductSize[] = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"];

export const isValidSize = (s: string): s is ProductSize =>
  (ALL_SIZES as readonly string[]).includes(s);

export const ProductSizeSchema = type("'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL' | 'XXXL'");

export type ProductStatus = "draft" | "active" | "archived";

export const VALID_STATUS_TRANSITIONS: Readonly<Record<ProductStatus, readonly ProductStatus[]>> = {
  draft: ["active"],
  active: ["archived"],
  archived: [],
};

export const canTransitionStatus = (from: ProductStatus, to: ProductStatus): boolean =>
  (VALID_STATUS_TRANSITIONS[from] as readonly ProductStatus[]).includes(to);

export const ProductStatusSchema = type("'draft' | 'active' | 'archived'");

export type ProductCategory = "basic" | "premium" | "limited_edition" | "custom";
export const ProductCategorySchema = type("'basic' | 'premium' | 'limited_edition' | 'custom'");

export interface StockQuantityError extends TaggedError<"StockQuantityError"> {}
export type StockQuantity = { readonly __brand: "StockQuantity"; readonly value: number };

export const makeStockQuantity = (n: number): StockQuantity | StockQuantityError => {
  if (!Number.isInteger(n) || n < 0) {
    return {
      _tag: "StockQuantityError",
      message: `Stock quantity must be a non-negative integer, got: ${n}`,
    };
  }
  return { __brand: "StockQuantity", value: n };
};

export const StockQuantitySchema = type("number >= 0");

export interface ProductImageError extends TaggedError<"ProductImageError"> {}
export type ProductImage = {
  readonly url: { readonly __brand: "ProductImageUrl" } & string;
  readonly altText: string;
  readonly isPrimary: boolean;
  readonly order: number;
};

export const makeProductImage = (
  url: string,
  altText: string,
  isPrimary: boolean,
  order: number
): ProductImage | ProductImageError => {
  if (!(url.startsWith("http") || url.startsWith("/"))) {
    return { _tag: "ProductImageError", message: `Invalid image URL: ${url}` };
  }
  return {
    url: url as ProductImage["url"],
    altText,
    isPrimary,
    order,
  };
};

export const ProductImageSchema = type({
  url: "string",
  altText: "string",
  isPrimary: "boolean",
  order: "number >= 0",
});

export type ProductError =
  | ProductNameError
  | ProductPriceError
  | StockQuantityError
  | ProductImageError
  | ProductNotFoundError
  | ProductOutOfStockError
  | InvalidProductDataError
  | InvalidStatusTransitionError;

export interface ProductNotFoundError extends TaggedError<"ProductNotFoundError"> {}
export const ProductNotFoundError = (productId: string): ProductNotFoundError => ({
  _tag: "ProductNotFoundError",
  message: `Product not found: ${productId}`,
});

export interface ProductOutOfStockError extends TaggedError<"ProductOutOfStockError"> {}
export const ProductOutOfStockError = (
  productId: string,
  size: string,
  requested: number,
  available: number
): ProductOutOfStockError => ({
  _tag: "ProductOutOfStockError",
  message: `Product ${productId} size ${size}: requested ${requested}, available ${available}`,
});

export interface InvalidProductDataError extends TaggedError<"InvalidProductDataError"> {}
export const InvalidProductDataError = (message: string): InvalidProductDataError => ({
  _tag: "InvalidProductDataError",
  message,
});

export interface InvalidStatusTransitionError extends TaggedError<"InvalidStatusTransitionError"> {}
export const InvalidStatusTransitionError = (
  from: ProductStatus,
  to: ProductStatus
): InvalidStatusTransitionError => ({
  _tag: "InvalidStatusTransitionError",
  message: `Cannot transition product status from '${from}' to '${to}'`,
});

export type ProductCreatedPayload = {
  readonly productId: string;
  readonly name: string;
  readonly price: number;
  readonly currency: string;
  readonly category: ProductCategory;
  readonly status: ProductStatus;
};

export type ProductCreated = DomainEvent<"ProductCreated", ProductCreatedPayload>;
export const makeProductCreated = (payload: ProductCreatedPayload): ProductCreated =>
  makeDomainEventInternal("ProductCreated", payload);

export type ProductUpdatedPayload = {
  readonly productId: string;
  readonly changes: Partial<ProductCreatedPayload>;
};

export type ProductUpdated = DomainEvent<"ProductUpdated", ProductUpdatedPayload>;
export const makeProductUpdated = (payload: ProductUpdatedPayload): ProductUpdated =>
  makeDomainEventInternal("ProductUpdated", payload);

export type ProductStockUpdatedPayload = {
  readonly productId: string;
  readonly size: ProductSize;
  readonly previousQuantity: number;
  readonly newQuantity: number;
};

export type ProductStockUpdated = DomainEvent<"ProductStockUpdated", ProductStockUpdatedPayload>;
export const makeProductStockUpdated = (payload: ProductStockUpdatedPayload): ProductStockUpdated =>
  makeDomainEventInternal("ProductStockUpdated", payload);

export type ProductStatusChangedPayload = {
  readonly productId: string;
  readonly from: ProductStatus;
  readonly to: ProductStatus;
};

export type ProductStatusChanged = DomainEvent<"ProductStatusChanged", ProductStatusChangedPayload>;
export const makeProductStatusChanged = (
  payload: ProductStatusChangedPayload
): ProductStatusChanged => makeDomainEventInternal("ProductStatusChanged", payload);

export type ProductViewedPayload = {
  readonly productId: string;
  readonly userId?: string;
  readonly sessionId?: string;
};

export type ProductViewed = DomainEvent<"ProductViewed", ProductViewedPayload>;
export const makeProductViewed = (payload: ProductViewedPayload): ProductViewed =>
  makeDomainEventInternal("ProductViewed", payload);

export type ProductEvent =
  | ProductCreated
  | ProductUpdated
  | ProductStockUpdated
  | ProductStatusChanged
  | ProductViewed;

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
