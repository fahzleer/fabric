import { productApiAdapter } from "@/infrastructure/http-product-api.adapter";
import { getVariant } from "@/lib/ab-testing";
import { preloadProducts } from "@/lib/data";
import { Effect } from "effect";
import { connection } from "next/server";
import { FeaturedProductsGrid, ProductCard } from "./_components";

export default async function ProductsPage() {
  preloadProducts();

  await connection();

  const [result, heroCta] = await Promise.all([
    Effect.runPromise(Effect.either(productApiAdapter.getProducts())),
    getVariant("hero-cta-text").then((v) => (v === "treatment" ? "Explore Products" : "Shop Now")),
  ]);

  if (result._tag === "Left") {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-red-500">{result.left.message}</p>
      </div>
    );
  }

  const products = result.right;

  if (products.length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-gray-400">No products available.</p>
      </div>
    );
  }

  const featured = products.slice(0, 3);
  const rest = products.slice(3);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      <FeaturedProductsGrid products={featured} heroCta={heroCta ?? "Shop Now"} />

      {rest.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {rest.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
