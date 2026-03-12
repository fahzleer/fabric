import type { RepositoryError, Result } from "@fabric/types";
import { RepositoryError as makeRepositoryError } from "@fabric/types";
import type { Product, ProductSummary } from "../../domain/product";
import type {
  ProductNotFoundError,
  ProductOutOfStockError,
} from "../../domain/product/product.errors";
import type { ProductId } from "../../domain/product/product.value-objects";

export { makeRepositoryError };
export type { RepositoryError };

export type PaginationInput = {
  readonly page: number;
  readonly perPage: number;
};

export type ProductSortField =
  | "price_asc"
  | "price_desc"
  | "name_asc"
  | "name_desc"
  | "created_desc";

export type ProductFilterInput = {
  readonly category?: string;
  readonly minPrice?: number;
  readonly maxPrice?: number;
  readonly sort?: ProductSortField;
};

export type PaginatedResult<T> = {
  readonly items: readonly T[];
  readonly total: number;
  readonly page: number;
  readonly perPage: number;
};

export type DeletedResult = { readonly _tag: "Deleted" };
export const Deleted: DeletedResult = { _tag: "Deleted" };

export type StockReservationItem = {
  readonly id: ProductId;
  readonly size: string;
  readonly quantity: number;
};

export interface ProductRepositoryPort {
  findById(id: ProductId): Promise<Result<Product, ProductNotFoundError | RepositoryError>>;

  findActive(
    pagination: PaginationInput
  ): Promise<Result<PaginatedResult<ProductSummary>, RepositoryError>>;

  findActiveFiltered(
    pagination: PaginationInput,
    filter: ProductFilterInput
  ): Promise<Result<PaginatedResult<ProductSummary>, RepositoryError>>;

  create(product: Product): Promise<Result<Product, RepositoryError>>;

  save(product: Product): Promise<Result<Product, RepositoryError>>;

  delete(id: ProductId): Promise<Result<DeletedResult, ProductNotFoundError | RepositoryError>>;

  reserveStockAtomicUpdate(
    id: ProductId,
    size: string,
    quantity: number
  ): Promise<Result<Product, ProductNotFoundError | ProductOutOfStockError | RepositoryError>>;

  reserveStockBatch(
    items: readonly StockReservationItem[]
  ): Promise<
    Result<readonly Product[], ProductNotFoundError | ProductOutOfStockError | RepositoryError>
  >;

  findByOwner(
    ownerId: string,
    pagination: PaginationInput
  ): Promise<Result<PaginatedResult<ProductSummary>, RepositoryError>>;
}

export const PRODUCT_REPOSITORY = Symbol("PRODUCT_REPOSITORY");
