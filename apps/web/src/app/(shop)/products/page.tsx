import { productApiAdapter } from "@/infrastructure/http-product-api.adapter";
import { preloadProducts } from "@/lib/data";
import { Effect } from "effect";
import { connection } from "next/server";
import { FeaturedProductsGrid, ProductCard } from "./_components";

export default async function ProductsPage() {
  preloadProducts();

  await connection();

  const result = await Effect.runPromise(Effect.either(productApiAdapter.getProducts()));

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
      <FeaturedProductsGrid products={featured} />

      {rest.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {rest.map((p) => (
            <ProductCard key={p.id.value} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
