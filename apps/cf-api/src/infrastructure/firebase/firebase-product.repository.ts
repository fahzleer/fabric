import type { FirebaseProductRecord } from "@fabric/firebase";
import { ProductNotFoundError, ProductOutOfStockError } from "@fabric/types";
import type { RepositoryError } from "@fabric/types";
import type { NonEmptyArray } from "@fabric/types";
import { isNonEmpty } from "@fabric/types";
import type { Result } from "@fabric/types";
import { Temporal } from "@js-temporal/polyfill";
import type { Database } from "firebase-admin/database";
import type {
  DeletedResult,
  PaginatedResult,
  PaginationInput,
  ProductFilterInput,
  ProductRepositoryPort,
  StockReservationItem,
} from "../../application/ports/product.repository.port";
import { Deleted, makeRepositoryError } from "../../application/ports/product.repository.port";
import type { Product, ProductSummary } from "../../domain/product";
import { toProductSummary } from "../../domain/product";
import type { ProductId, ProductImage } from "../../domain/product/product.value-objects";
import { firebaseQuery } from "../../shared/abort/abort-context";

function toFirebaseRecord(product: Product, rev: number): FirebaseProductRecord {
  return {
    id: product.id,
    rev,
    ownerId: product.ownerId,
    name: product.name,
    description: product.description,
    price: product.price.displayAmount,
    currency: product.price.currency,
    category: product.category,
    status: product.status,
    stock: Object.fromEntries(Object.entries(product.stock).map(([size, qty]) => [size, qty])),
    imageUrls: product.images.map((img) => img.url as string),
    isPrimaryImageFirst: product.images[0]?.isPrimary ?? true,
    createdAt: product.createdAt.toString(),
    updatedAt: product.updatedAt.toString(),
  };
}

function fromFirebaseRecord(record: FirebaseProductRecord): Product {
  const stock = Object.fromEntries(
    Object.entries(record.stock).map(([size, qty]) => [size, qty])
  ) as Product["stock"];

  const placeholderImage: ProductImage = {
    url: "/placeholder.jpg" as ProductImage["url"],
    altText: "Product image",
    isPrimary: true,
    order: 0,
  };

  const images: NonEmptyArray<ProductImage> = isNonEmpty(
    record.imageUrls.map((url, idx) => ({
      url: url as ProductImage["url"],
      altText: "",
      isPrimary: idx === 0,
      order: idx,
    }))
  )
    ? (record.imageUrls.map((url, idx) => ({
        url: url as ProductImage["url"],
        altText: "",
        isPrimary: idx === 0,
        order: idx,
      })) as unknown as NonEmptyArray<ProductImage>)
    : [placeholderImage];

  return Object.freeze({
    id: record.id as Product["id"],
    ownerId: record.ownerId,
    name: record.name as Product["name"],
    description: record.description,
    price: Object.freeze({
      __brand: "ProductPrice" as const,
      displayAmount: record.price,
      currency: record.currency as Product["price"]["currency"],
    }),
    category: record.category as Product["category"],
    status: record.status as Product["status"],
    stock: Object.freeze(stock),
    images: Object.freeze(images),
    createdAt: Temporal.Instant.from(record.createdAt),
    updatedAt: Temporal.Instant.from(record.updatedAt),
  });
}

export class FirebaseProductRepository implements ProductRepositoryPort {
  constructor(private readonly db: Database) {}

  async findById(
    id: ProductId
  ): Promise<Result<Product, ReturnType<typeof ProductNotFoundError> | RepositoryError>> {
    try {
      const snap = await firebaseQuery(this.db.ref(`product_write/${id}`).once("value"));
      if (!snap.exists()) {
        return { _tag: "Err", error: ProductNotFoundError(id) };
      }
      return { _tag: "Ok", value: fromFirebaseRecord(snap.val() as FirebaseProductRecord) };
    } catch (cause) {
      return {
        _tag: "Err",
        error: makeRepositoryError(`Failed to find product ${id}`, cause),
      };
    }
  }

  async findActive(
    pagination: PaginationInput
  ): Promise<Result<PaginatedResult<ProductSummary>, RepositoryError>> {
    return this.findActiveFiltered(pagination, {});
  }

  async findActiveFiltered(
    pagination: PaginationInput,
    filter: ProductFilterInput
  ): Promise<Result<PaginatedResult<ProductSummary>, RepositoryError>> {
    try {
      const snap = await firebaseQuery(
        this.db.ref("product_write").orderByChild("status").equalTo("active").once("value")
      );

      const allProducts: Product[] = [];
      snap.forEach((child) => {
        allProducts.push(fromFirebaseRecord(child.val() as FirebaseProductRecord));
      });

      const filtered = allProducts.filter((p) => {
        if (filter.category !== undefined && p.category !== filter.category) return false;
        if (filter.minPrice !== undefined && p.price.displayAmount < filter.minPrice) return false;
        if (filter.maxPrice !== undefined && p.price.displayAmount > filter.maxPrice) return false;
        return true;
      });

      if (filter.sort === "price_asc") {
        filtered.sort((a, b) => a.price.displayAmount - b.price.displayAmount);
      } else if (filter.sort === "price_desc") {
        filtered.sort((a, b) => b.price.displayAmount - a.price.displayAmount);
      } else {
        filtered.sort((a, b) => Temporal.Instant.compare(b.createdAt, a.createdAt));
      }

      const { page, perPage } = pagination;
      const total = filtered.length;
      const offset = (page - 1) * perPage;
      const pageItems = filtered.slice(offset, offset + perPage).map(toProductSummary);

      return {
        _tag: "Ok",
        value: {
          items: pageItems,
          total,
          page,
          perPage,
        },
      };
    } catch (cause) {
      return { _tag: "Err", error: makeRepositoryError("Failed to list products", cause) };
    }
  }

  async create(product: Product): Promise<Result<Product, RepositoryError>> {
    try {
      const record = toFirebaseRecord(product, 1);
      const revKey = `${product.id}_1`;
      await this.db.ref().update({
        [`product_write/${product.id}`]: record,
        [`product_write_history/${revKey}`]: record,
      });
      return { _tag: "Ok", value: product };
    } catch (cause) {
      return { _tag: "Err", error: makeRepositoryError("Failed to create product", cause) };
    }
  }

  async save(product: Product): Promise<Result<Product, RepositoryError>> {
    try {
      const currentSnap = await this.db.ref(`product_write/${product.id}`).once("value");
      const currentRev = currentSnap.exists()
        ? ((currentSnap.val() as FirebaseProductRecord).rev ?? 1)
        : 1;
      const nextRev = currentRev + 1;

      const record = toFirebaseRecord(product, nextRev);
      const revKey = `${product.id}_${nextRev}`;
      await this.db.ref().update({
        [`product_write/${product.id}`]: record,
        [`product_write_history/${revKey}`]: record,
      });
      return { _tag: "Ok", value: product };
    } catch (cause) {
      return { _tag: "Err", error: makeRepositoryError("Failed to save product", cause) };
    }
  }

  async delete(
    id: ProductId
  ): Promise<Result<DeletedResult, ReturnType<typeof ProductNotFoundError> | RepositoryError>> {
    try {
      const currentSnap = await this.db.ref(`product_write/${id}`).once("value");
      if (!currentSnap.exists()) {
        return { _tag: "Err", error: ProductNotFoundError(id) };
      }
      const current = currentSnap.val() as FirebaseProductRecord;
      const nextRev = current.rev + 1;
      const archived = { ...current, status: "archived", rev: nextRev };
      const revKey = `${id}_${nextRev}`;
      await this.db.ref().update({
        [`product_write/${id}`]: archived,
        [`product_write_history/${revKey}`]: archived,
      });
      return { _tag: "Ok", value: Deleted };
    } catch (cause) {
      return {
        _tag: "Err",
        error: makeRepositoryError(`Failed to delete product ${id}`, cause),
      };
    }
  }

  async reserveStockAtomicUpdate(
    id: ProductId,
    size: string,
    quantity: number
  ): Promise<
    Result<
      Product,
      | ReturnType<typeof ProductNotFoundError>
      | ReturnType<typeof ProductOutOfStockError>
      | RepositoryError
    >
  > {
    try {
      const ref = this.db.ref(`product_write/${id}`);
      let domainError:
        | ReturnType<typeof ProductNotFoundError>
        | ReturnType<typeof ProductOutOfStockError>
        | null = null;

      await ref.transaction((current: FirebaseProductRecord | null) => {
        if (current === null) {
          domainError = ProductNotFoundError(id);
          return;
        }
        const currentQty = current.stock[size] ?? 0;
        if (currentQty < quantity) {
          domainError = ProductOutOfStockError(id, size, quantity, currentQty);
          return;
        }
        return { ...current, stock: { ...current.stock, [size]: currentQty - quantity } };
      });

      if (domainError !== null) {
        return { _tag: "Err", error: domainError };
      }

      const updated = await ref.once("value");
      return { _tag: "Ok", value: fromFirebaseRecord(updated.val() as FirebaseProductRecord) };
    } catch (cause) {
      return {
        _tag: "Err",
        error: makeRepositoryError(`Failed to reserve stock for ${id}`, cause),
      };
    }
  }

  async reserveStockBatch(
    items: readonly StockReservationItem[]
  ): Promise<
    Result<
      readonly Product[],
      | ReturnType<typeof ProductNotFoundError>
      | ReturnType<typeof ProductOutOfStockError>
      | RepositoryError
    >
  > {
    const reserved: Array<{ id: string; size: string; qty: number }> = [];

    for (const item of items) {
      const result = await this.reserveStockAtomicUpdate(item.id, item.size, item.quantity);
      if (result._tag === "Err") {
        await Promise.allSettled(
          reserved.map(async (r) => {
            await this.db
              .ref(`product_write/${r.id}`)
              .transaction((current: FirebaseProductRecord | null) => {
                if (current === null) return current;
                return {
                  ...current,
                  stock: { ...current.stock, [r.size]: (current.stock[r.size] ?? 0) + r.qty },
                };
              });
          })
        );
        return { _tag: "Err", error: result.error };
      }
      reserved.push({ id: item.id, size: item.size, qty: item.quantity });
    }

    const products = await Promise.all(items.map((item) => this.findById(item.id)));
    const successes = products.filter((r): r is { _tag: "Ok"; value: Product } => r._tag === "Ok");
    if (successes.length !== products.length) {
      return {
        _tag: "Err",
        error: makeRepositoryError("Failed to read products after batch reserve", null),
      };
    }

    return { _tag: "Ok", value: successes.map((r: { _tag: "Ok"; value: Product }) => r.value) };
  }

  async findByOwner(
    ownerId: string,
    pagination: PaginationInput
  ): Promise<Result<PaginatedResult<ProductSummary>, RepositoryError>> {
    try {
      const snap = await firebaseQuery(
        this.db.ref("product_write").orderByChild("status").equalTo("active").once("value")
      );

      const ownerProducts: Product[] = [];
      snap.forEach((child) => {
        const record = child.val() as FirebaseProductRecord;
        if (record.ownerId === ownerId) {
          ownerProducts.push(fromFirebaseRecord(record));
        }
      });

      ownerProducts.sort((a, b) => Temporal.Instant.compare(b.createdAt, a.createdAt));

      const { page, perPage } = pagination;
      const total = ownerProducts.length;
      const offset = (page - 1) * perPage;
      const pageItems = ownerProducts.slice(offset, offset + perPage).map(toProductSummary);

      return {
        _tag: "Ok",
        value: { items: pageItems, total, page, perPage },
      };
    } catch (cause) {
      return {
        _tag: "Err",
        error: makeRepositoryError(`Failed to list products for owner ${ownerId}`, cause),
      };
    }
  }
}
