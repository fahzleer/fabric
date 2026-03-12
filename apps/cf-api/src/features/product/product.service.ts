import type { CurrencyCode, NonEmptyArray, ProductCategory, ProductStatus } from "@fabric/types";
import { isNonEmpty } from "@fabric/types";
import { Temporal } from "@js-temporal/polyfill";
import type { ActivityRepositoryPort } from "../../application/ports/activity.repository.port";
import type { EventPublisherPort } from "../../application/ports/event-publisher.port";
import type {
  PaginationInput,
  ProductFilterInput,
  ProductRepositoryPort,
} from "../../application/ports/product.repository.port";
import type { Product } from "../../domain/product/product.entity";
import type { ProductId, ProductImage } from "../../domain/product/product.value-objects";
import {
  makeProductId,
  makeProductImage,
  makeProductName,
  makeProductPrice,
} from "../../domain/product/product.value-objects";
import { presentDomainError } from "../shared/http-error.presenter";

export type CreateProductInput = {
  readonly ownerId: string;
  readonly name: string;
  readonly description: string;
  readonly price: number;
  readonly priceCurrency: string;
  readonly category: ProductCategory;
  readonly stock: Record<string, number>;
  readonly images: Array<{ url: string; alt: string; isPrimary: boolean; order: number }>;
};

export type UpdateProductInput = Partial<Omit<CreateProductInput, "ownerId">> & {
  readonly status?: ProductStatus;
};

function buildStock(raw: Record<string, number>): Product["stock"] {
  return Object.fromEntries(
    Object.entries(raw).map(([size, qty]) => [
      size,
      { __brand: "StockQuantity" as const, value: qty },
    ])
  ) as Product["stock"];
}

function buildImages(
  rawImages: Array<{ url: string; alt: string; isPrimary: boolean; order: number }>
): NonEmptyArray<ProductImage> | never {
  const results = rawImages.map((img) =>
    makeProductImage(img.url, img.alt, img.isPrimary, img.order)
  );
  for (const r of results) {
    if ("_tag" in r) return presentDomainError(r);
  }
  const valid = results as ProductImage[];
  if (!isNonEmpty(valid)) {
    return presentDomainError({
      _tag: "ValidationError",
      message: "At least one image is required",
    });
  }
  return valid;
}

function resolveName(existing: Product, input: UpdateProductInput): Product["name"] | never {
  if (input.name === undefined) return existing.name;
  const r = makeProductName(input.name);
  if ("_tag" in r) return presentDomainError(r);
  return r;
}

function resolvePrice(existing: Product, input: UpdateProductInput): Product["price"] | never {
  if (input.price !== undefined) {
    const result = makeProductPrice(
      input.price,
      (input.priceCurrency ?? existing.price.currency) as CurrencyCode
    );
    if ("_tag" in result) return presentDomainError(result);
    return result;
  }
  if (input.priceCurrency !== undefined) {
    return { ...existing.price, currency: input.priceCurrency as CurrencyCode };
  }
  return existing.price;
}

export class ProductService {
  constructor(
    private readonly products: ProductRepositoryPort,
    private readonly eventPublisher: EventPublisherPort,
    private readonly activity: ActivityRepositoryPort
  ) {}

  async getActiveProducts(pagination: PaginationInput, filter: ProductFilterInput = {}) {
    const result = await this.products.findActiveFiltered(pagination, filter);
    if (result._tag === "Err") return presentDomainError(result.error);
    return result.value;
  }

  async getProduct(id: ProductId) {
    const result = await this.products.findById(id);
    if (result._tag === "Err") return presentDomainError(result.error);
    return result.value;
  }

  async createProduct(input: CreateProductInput) {
    const nameResult = makeProductName(input.name);
    if ("_tag" in nameResult) return presentDomainError(nameResult);

    const priceResult = makeProductPrice(input.price, input.priceCurrency as CurrencyCode);
    if ("_tag" in priceResult) return presentDomainError(priceResult);
    const price = priceResult;
    const now = Temporal.Now.instant();

    const product: Product = {
      id: makeProductId(crypto.randomUUID()),
      ownerId: input.ownerId,
      name: nameResult,
      description: input.description,
      price,
      category: input.category,
      status: "active",
      stock: buildStock(input.stock),
      images: buildImages(input.images),
      createdAt: now,
      updatedAt: now,
    };

    const result = await this.products.create(product);
    if (result._tag === "Err") return presentDomainError(result.error);

    void this.eventPublisher.publish({
      event_id: crypto.randomUUID(),
      event_type: "ProductCreated",
      aggregate_id: product.id.value,
      occurred_at: now.toString(),
      schema_version: 1,
      payload: {
        product_id: product.id.value,
        owner_id: product.ownerId,
        name: product.name.value,
        price: product.price.amount,
        currency: product.price.currency,
        category: product.category,
        status: product.status,
        rev: 1,
      },
    });

    void this.activity.track({
      id: crypto.randomUUID(),
      userId: input.ownerId,
      eventType: "product_created",
      eventData: {
        productId: product.id.value,
        name: product.name.value,
        category: product.category,
      },
    });

    return result.value;
  }

  async updateProduct(
    id: ProductId,
    input: UpdateProductInput,
    callerId?: string,
    callerRole?: string
  ) {
    const current = await this.products.findById(id);
    if (current._tag === "Err") return presentDomainError(current.error);
    const existing = current.value;

    if (callerRole === "store_owner" && callerId !== undefined && existing.ownerId !== callerId) {
      return presentDomainError({ _tag: "ForbiddenError", message: "You do not own this product" });
    }

    const name = resolveName(existing, input);
    const price = resolvePrice(existing, input);
    const images =
      input.images !== undefined && input.images.length > 0
        ? buildImages(input.images)
        : existing.images;
    const stock = input.stock !== undefined ? buildStock(input.stock) : existing.stock;
    const now = Temporal.Now.instant();

    const updated: Product = {
      ...existing,
      name,
      price,
      description: input.description ?? existing.description,
      category: input.category ?? existing.category,
      status: input.status ?? existing.status,
      stock,
      images,
      updatedAt: now,
    };

    const result = await this.products.save(updated);
    if (result._tag === "Err") return presentDomainError(result.error);

    void this.eventPublisher.publish({
      event_id: crypto.randomUUID(),
      event_type: "ProductUpdated",
      aggregate_id: updated.id.value,
      occurred_at: now.toString(),
      schema_version: 1,
      payload: {
        product_id: updated.id.value,
        owner_id: updated.ownerId,
        name: updated.name.value,
        price: updated.price.amount,
        currency: updated.price.currency,
        category: updated.category,
        status: updated.status,
        rev: 2,
      },
    });

    void this.activity.track({
      id: crypto.randomUUID(),
      ...(callerId !== undefined && { userId: callerId }),
      eventType: "product_updated",
      eventData: { productId: updated.id.value, changes: Object.keys(input) },
    });

    return result.value;
  }

  async deleteProduct(id: ProductId, callerId?: string) {
    const current = await this.products.findById(id);
    if (current._tag === "Err") return presentDomainError(current.error);

    const result = await this.products.delete(id);
    if (result._tag === "Err") return presentDomainError(result.error);

    const now = Temporal.Now.instant();
    void this.eventPublisher.publish({
      event_id: crypto.randomUUID(),
      event_type: "ProductArchived",
      aggregate_id: id.value,
      occurred_at: now.toString(),
      schema_version: 1,
      payload: {
        product_id: id.value,
        owner_id: current.value.ownerId,
        rev: 0,
      },
    });

    void this.activity.track({
      id: crypto.randomUUID(),
      ...(callerId !== undefined && { userId: callerId }),
      eventType: "product_deleted",
      eventData: { productId: id.value, ownerId: current.value.ownerId },
    });

    return { deleted: true };
  }
}
