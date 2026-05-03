export type {
  ProductId,
  ProductName,
  ProductNameError,
  ProductPrice,
  ProductPriceError,
  ProductSize,
  ProductStatus,
  ProductCategory,
  StockQuantity,
  StockQuantityError,
  ProductImage,
  ProductImageError,
} from "@fabric/types";

export {
  ProductIdSchema,
  makeProductId,
  ProductNameSchema,
  makeProductName,
  ProductPriceSchema,
  makeProductPrice,
  ProductSizeSchema,
  ALL_SIZES,
  isValidSize,
  ProductStatusSchema,
  ProductCategorySchema,
  StockQuantitySchema,
  makeStockQuantity,
  ProductImageSchema,
  makeProductImage,
  VALID_STATUS_TRANSITIONS,
  canTransitionStatus,
} from "@fabric/types";

export type { ProductError } from "@fabric/types";

export {
  ProductNotFoundError,
  ProductOutOfStockError,
  InvalidProductDataError,
  InvalidStatusTransitionError,
} from "@fabric/types";

import type { Maybe, ProductSize } from "@fabric/types";
import { None, Some } from "@fabric/types";

export interface StockInfo {
  readonly size: ProductSize;
  readonly quantity: number;
  readonly reserved: number;
}

export const makeStockInfo = (
  size: ProductSize,
  quantity: number,
  reserved: number
): StockInfo => ({
  size,
  quantity,
  reserved,
});

export const getStockAvailable = (s: StockInfo): number => s.quantity - s.reserved;
export const isStockInStock = (s: StockInfo): boolean => getStockAvailable(s) > 0;

import type {
  NonEmptyArray,
  ProductCategory,
  ProductId,
  ProductImage,
  ProductName,
  ProductPrice,
  ProductStatus,
} from "@fabric/types";

export interface Product {
  readonly id: ProductId;
  readonly name: ProductName;
  readonly slug: string;
  readonly description: string;
  readonly tagline: string;
  readonly price: ProductPrice;
  readonly category: ProductCategory;
  readonly status: ProductStatus;
  readonly images: NonEmptyArray<ProductImage>;
  readonly stock: readonly StockInfo[];
  readonly material: string;
  readonly care: string;
  readonly metadata: {
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly viewCount: number;
    readonly salesCount: number;
  };
}

export interface ProductSummary {
  readonly id: ProductId;
  readonly name: ProductName;
  readonly slug: string;
  readonly tagline: string;
  readonly price: ProductPrice;
  readonly primaryImage: ProductImage;
  readonly category: ProductCategory;
  readonly status: ProductStatus;
  readonly inStock: boolean;
}

export const getProductPrimaryImage = (p: Product): ProductImage => {
  const primary = p.images.find((img) => img.isPrimary);
  return primary !== undefined ? primary : p.images[0];
};

export const isProductAvailable = (p: Product): boolean =>
  p.status === "active" && p.stock.some(isStockInStock);

export const getProductStockForSize = (p: Product, size: ProductSize): Maybe<StockInfo> => {
  const found = p.stock.find((s) => s.size === size);
  return found !== undefined ? Some(found) : None<StockInfo>();
};

export const isProductSizeAvailable = (p: Product, size: ProductSize): boolean => {
  const stock = getProductStockForSize(p, size);
  return stock._tag === "Some" ? isStockInStock(stock.value) : false;
};

export const getProductAvailableSizes = (p: Product): ProductSize[] =>
  p.stock.filter(isStockInStock).map((s) => s.size);

export const toProductSummary = (p: Product): ProductSummary => ({
  id: p.id,
  name: p.name,
  slug: p.slug,
  tagline: p.tagline,
  price: p.price,
  primaryImage: getProductPrimaryImage(p),
  category: p.category,
  status: p.status,
  inStock: isProductAvailable(p),
});
