import type { Maybe, NonEmptyArray } from "@fabric/types";
import { None, Some, isSome } from "@fabric/types";
import { InvalidStatusTransitionError, ProductOutOfStockError } from "@fabric/types";
import { Temporal } from "@js-temporal/polyfill";
import type {
  InvalidStatusTransitionError as InvalidStatusTransitionErrorType,
  ProductOutOfStockError as ProductOutOfStockErrorType,
} from "./product.errors";
import type {
  ProductCategory,
  ProductId,
  ProductImage,
  ProductName,
  ProductPrice,
  ProductSize,
  ProductStatus,
  StockQuantity,
} from "./product.value-objects";
import { canTransitionStatus } from "./product.value-objects";

export type StockMap = Readonly<Partial<Record<ProductSize, StockQuantity>>>;

export interface Product {
  readonly id: ProductId;
  readonly ownerId: string;
  readonly name: ProductName;
  readonly description: string;
  readonly price: ProductPrice;
  readonly category: ProductCategory;
  readonly status: ProductStatus;
  readonly stock: StockMap;
  readonly images: NonEmptyArray<ProductImage>;
  readonly createdAt: Temporal.Instant;
  readonly updatedAt: Temporal.Instant;
}

export const getPrimaryImage = (product: Product): ProductImage => {
  const primary = product.images.find((img) => img.isPrimary);
  return primary !== undefined ? primary : product.images[0];
};

export const getStockForSize = (product: Product, size: ProductSize): Maybe<StockQuantity> => {
  const stock = product.stock[size];
  return stock !== undefined ? Some(stock) : None<StockQuantity>();
};

export const getAvailableSizes = (product: Product): readonly ProductSize[] =>
  (Object.entries(product.stock) as [ProductSize, StockQuantity][])
    .filter(([, qty]) => qty > 0)
    .map(([size]) => size);

export const isProductAvailable = (product: Product): boolean =>
  product.status === "active" && getAvailableSizes(product).length > 0;

export const isSizeAvailable = (product: Product, size: ProductSize, quantity: number): boolean => {
  const stock = getStockForSize(product, size);
  return isSome(stock) && stock.value >= quantity;
};

export const transitionProductStatus = (
  product: Product,
  newStatus: ProductStatus
): { _tag: "Ok"; value: Product } | { _tag: "Err"; error: InvalidStatusTransitionErrorType } => {
  if (!canTransitionStatus(product.status, newStatus))
    return {
      _tag: "Err",
      error: InvalidStatusTransitionError(product.status, newStatus),
    };
  return {
    _tag: "Ok",
    value: { ...product, status: newStatus, updatedAt: Temporal.Now.instant() },
  };
};

export const reserveStock = (
  product: Product,
  size: ProductSize,
  quantity: number
): { _tag: "Ok"; value: Product } | { _tag: "Err"; error: ProductOutOfStockErrorType } => {
  const stockMaybe = getStockForSize(product, size);
  if (!isSome(stockMaybe))
    return {
      _tag: "Err",
      error: ProductOutOfStockError(product.id, size, quantity, 0),
    };

  const available = stockMaybe.value;
  if (available < quantity)
    return {
      _tag: "Err",
      error: ProductOutOfStockError(product.id, size, quantity, available),
    };

  const newStock: StockMap = {
    ...product.stock,
    [size]: (available - quantity) as StockQuantity,
  };

  return {
    _tag: "Ok",
    value: { ...product, stock: newStock, updatedAt: Temporal.Now.instant() },
  };
};

export const releaseStock = (product: Product, size: ProductSize, quantity: number): Product => {
  const stockEntry = product.stock[size];
  const current = stockEntry !== undefined ? (stockEntry as number) : 0;
  const newStock: StockMap = {
    ...product.stock,
    [size]: (current + quantity) as StockQuantity,
  };
  return { ...product, stock: newStock, updatedAt: Temporal.Now.instant() };
};

export interface ProductSummary {
  readonly id: ProductId;
  readonly name: ProductName;
  readonly price: ProductPrice;
  readonly category: ProductCategory;
  readonly status: ProductStatus;
  readonly primaryImage: ProductImage;
  readonly isInStock: boolean;
  readonly availableSizes: readonly ProductSize[];
  readonly ownerId: string;
}

export const toProductSummary = (product: Product): ProductSummary => ({
  id: product.id,
  name: product.name,
  price: product.price,
  category: product.category,
  status: product.status,
  primaryImage: getPrimaryImage(product),
  isInStock: isProductAvailable(product),
  availableSizes: getAvailableSizes(product),
  ownerId: product.ownerId,
});
