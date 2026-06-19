import type { TaggedError } from "@fabric/types";
import type { Effect } from "effect";
import type { Product, ProductId, ProductSummary } from "../../domain/product/types";
import type { ProductNotFoundError } from "../../domain/product/types";

export type NetworkError = TaggedError<"NetworkError"> & {
  readonly statusCode: number;
  readonly cause: unknown;
};

export const NetworkError = (cause: unknown, statusCode = 0): NetworkError => ({
  _tag: "NetworkError",
  message: typeof cause === "string" ? cause : `Network request failed (status: ${statusCode})`,
  statusCode,
  cause,
});

export interface ProductApiPort {
  getProducts(): Effect.Effect<readonly ProductSummary[], NetworkError>;
  getProduct(id: ProductId): Effect.Effect<Product, ProductNotFoundError | NetworkError>;
  getFeaturedProducts(limit: number): Effect.Effect<readonly ProductSummary[], NetworkError>;
}
