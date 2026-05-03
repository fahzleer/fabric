import { makeProductViewed } from "@fabric/types";
import { Effect } from "effect";
import type { Product, ProductId, ProductNotFoundError } from "../../domain/product/types";
import type { ClientEventBusPort } from "../ports/event-bus.port";
import type { NetworkError, ProductApiPort } from "../ports/product-api.port";

export type GetProductDetailInput = {
  readonly productId: ProductId;
  readonly sessionId: string;
  readonly navigationType: "soft" | "hard";
  readonly referrer: string;
};

export type GetProductDetailOutput = {
  readonly product: Product;
};

export const getProductDetailUseCase = (
  input: GetProductDetailInput,
  deps: {
    readonly productApi: ProductApiPort;
    readonly eventBus: ClientEventBusPort;
  }
): Effect.Effect<GetProductDetailOutput, ProductNotFoundError | NetworkError> =>
  Effect.gen(function* () {
    const product = yield* deps.productApi.getProduct(input.productId);

    yield* Effect.forkDaemon(
      deps.eventBus.publish(
        makeProductViewed({
          productId: input.productId,
          sessionId: input.sessionId,
        })
      )
    );

    return { product };
  });
