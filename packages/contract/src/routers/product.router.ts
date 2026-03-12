import type { ProductCategory, ProductSize, ProductStatus } from "@fabric/types";

export type { ProductCategory, ProductSize, ProductStatus };

export type ProductSortField =
  | "price_asc"
  | "price_desc"
  | "name_asc"
  | "name_desc"
  | "created_desc";

export const VALID_SORT_FIELDS = new Set<ProductSortField>([
  "price_asc",
  "price_desc",
  "name_asc",
  "name_desc",
  "created_desc",
]);

export type ProductImageDto = {
  readonly url: string;
  readonly altText: string;
  readonly isPrimary: boolean;
  readonly order: number;
};

export type ProductSummaryDto = {
  readonly id: string;
  readonly name: string;
  readonly price: number;
  readonly priceCurrency: string;
  readonly category: ProductCategory;
  readonly status: ProductStatus;
  readonly primaryImage: ProductImageDto | null;
  readonly availableSizes: readonly ProductSize[];
};

export type ProductDetailDto = ProductSummaryDto & {
  readonly description: string;
  readonly images: readonly ProductImageDto[];
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type PaginatedProductsDto = {
  readonly items: readonly ProductSummaryDto[];
  readonly total: number;
  readonly page: number;
  readonly perPage: number;
};

export type ListProductsInput = {
  readonly page?: number;
  readonly perPage?: number;
  readonly category?: ProductCategory;
  readonly minPrice?: number;
  readonly maxPrice?: number;
  readonly sort?: ProductSortField;
};

export type GetProductInput = {
  readonly id: string;
};
