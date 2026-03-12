import { Effect } from "effect";
import type { ProductSummary } from "../../domain/product/types";
import type { ProductApiPort } from "../ports/product-api.port";
import type { NetworkError } from "../ports/product-api.port";

export type GetProductsInput = {
  readonly sessionId: string;
};

export type GetProductsOutput = {
  readonly products: readonly ProductSummary[];
  readonly total: number;
};

export const getProductsUseCase = (
  _input: GetProductsInput,
  deps: {
    readonly productApi: ProductApiPort;
  }
): Effect.Effect<GetProductsOutput, NetworkError> =>
  Effect.gen(function* () {
    const products = yield* deps.productApi.getProducts();

    return {
      products,
      total: products.length,
    };
  });
