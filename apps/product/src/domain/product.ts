import { Data } from "effect";

// ── Value Objects ─────────────────────────────────────────────────────────────

export type ProductId   = string & { readonly _brand: "ProductId" };
export type MerchantId  = string & { readonly _brand: "MerchantId" };

export const makeProductId = (): ProductId => crypto.randomUUID() as ProductId;

// ── Domain Errors ─────────────────────────────────────────────────────────────

export class ProductNotFoundError extends Data.TaggedError("ProductNotFoundError")<{
  readonly productId: ProductId;
}> {}

export class InsufficientInventoryError extends Data.TaggedError("InsufficientInventoryError")<{
  readonly productId: ProductId;
  readonly sku:       string;
  readonly requested: number;
  readonly available: number;
}> {}

export class InvalidProductError extends Data.TaggedError("InvalidProductError")<{
  readonly reason: string;
}> {}

// ── Aggregate ─────────────────────────────────────────────────────────────────

export interface Product {
  readonly id:          ProductId;
  readonly merchantId:  MerchantId;
  readonly name:        string;
  readonly description: string;
  readonly priceCents:  number;
  readonly currency:    string;
  readonly category:    string;
  readonly tags:        string[];
  readonly inventory:   Record<string, number>; // sku → quantity e.g. { "S": 10, "M": 5 }
  readonly imageUrls:   string[];
  readonly isActive:    boolean;
  readonly createdAt:   string;
  readonly updatedAt:   string;
}

// ── Domain Logic ──────────────────────────────────────────────────────────────

export const totalInventory = (product: Product): number =>
  Object.values(product.inventory).reduce((sum, qty) => sum + qty, 0);

export const hasStock = (product: Product, sku: string, qty: number): boolean =>
  (product.inventory[sku] ?? 0) >= qty;

export const deductInventory = (
  product: Product,
  sku: string,
  qty: number
): Product => ({
  ...product,
  inventory: {
    ...product.inventory,
    [sku]: (product.inventory[sku] ?? 0) - qty,
  },
  updatedAt: new Date().toISOString(),
});
