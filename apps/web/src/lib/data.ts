import { makeProductId } from "@/domain/product/types";
import { productApiAdapter } from "@/infrastructure/http-product-api.adapter";
import { Effect } from "effect";
import { cache } from "react";

export function preloadProduct(id: string): void {
  void getProduct(id);
}

export function preloadProducts(): void {
  void getProducts();
}

export const getProduct = cache(async (id: string) => {
  const productId = makeProductId(id);
  const result = await Effect.runPromise(Effect.either(productApiAdapter.getProduct(productId)));
  if (result._tag === "Left") {
    throw result.left;
  }
  return result.right;
});

export const getProducts = cache(async () => {
  const result = await Effect.runPromise(Effect.either(productApiAdapter.getProducts()));
  if (result._tag === "Left") {
    console.error("[getProducts] Failed:", result.left.message);
    return [];
  }
  return result.right;
});

export const getFeaturedProducts = cache(async (limit = 6) => {
  const result = await Effect.runPromise(
    Effect.either(productApiAdapter.getFeaturedProducts(limit))
  );
  if (result._tag === "Left") {
    console.error("[getFeaturedProducts] Failed:", result.left.message);
    return [];
  }
  return result.right;
});
