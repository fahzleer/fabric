import { formatPrice } from "@/lib/price";
import { fetchStoreBySlug, fetchStoreProducts } from "@/lib/store-api";
import { isSome } from "@fabric/types";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const maybeStore = await fetchStoreBySlug(slug);
  if (!isSome(maybeStore)) return { title: "Store Not Found" };
  const store = maybeStore.value;

  return {
    title: `${store.storeName} — Fabric`,
    description: `Shop ${store.productCount} products from ${store.storeName} on Fabric`,
    openGraph: {
      title: store.storeName,
      description: `Browse all products from ${store.storeName}`,
      type: "website",
    },
  };
}

function StoreProductCard({
  product,
}: {
  product: {
    id: { value: string };
    name: { value: string };
    price: { amount: number; currency: string };
    primaryImage: { url: string; altText: string };
    tagline: string;
    isInStock: boolean;
  };
}) {
  const price = formatPrice(product.price);

  return (
    <Link
      href={`/product/${product.id.value}`}
      className="group block overflow-hidden rounded-xl border border-white/10 bg-gray-800/50 transition-colors hover:border-white/20 hover:bg-gray-800/80"
    >
      <div className="aspect-square overflow-hidden bg-gray-900 relative">
        <Image
          src={product.primaryImage.url}
          alt={product.primaryImage.altText || product.name.value}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
          className="object-cover transition-transform group-hover:scale-105"
        />
        {!product.isInStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <span className="rounded-full bg-black/70 px-3 py-1 text-xs font-medium text-gray-300">
              Out of stock
            </span>
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="text-sm font-semibold text-white line-clamp-2">{product.name.value}</h3>
        {product.tagline && (
          <p className="mt-1 text-xs text-gray-400 line-clamp-1">{product.tagline}</p>
        )}
        <p className="mt-2 text-base font-bold text-emerald-400">{price}</p>
      </div>
    </Link>
  );
}

export default async function StorefrontPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await connection();

  const { slug } = await params;
  const [maybeStore, products] = await Promise.all([
    fetchStoreBySlug(slug),
    fetchStoreProducts(slug, 1, 20),
  ]);

  if (!isSome(maybeStore)) notFound();
  const store = maybeStore.value;

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Breadcrumb */}
      <div className="border-b border-white/10 bg-gray-900/50">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          <nav className="flex items-center gap-2 text-xs text-gray-400">
            <Link href="/" className="hover:text-gray-300">
              Home
            </Link>
            <span>›</span>
            <Link href="/products" className="hover:text-gray-300">
              Products
            </Link>
            <span>›</span>
            <span className="text-gray-200">{store.storeName}</span>
          </nav>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Store header */}
        <div className="mb-10 rounded-2xl border border-white/10 bg-gray-800/50 p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-4">
            {/* Store avatar placeholder */}
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-2xl ring-2 ring-emerald-500/30">
              🏪
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-white">{store.storeName}</h1>
                <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-400 ring-1 ring-emerald-500/30">
                  Official Store
                </span>
              </div>
              <p className="mt-1 text-sm text-gray-400">
                {products.total} {products.total === 1 ? "product" : "products"} available
              </p>
            </div>
          </div>
        </div>

        {/* Product grid */}
        <div>
          <h2 className="mb-4 text-lg font-semibold text-white">
            All Products
            {products.total > 0 && (
              <span className="ml-2 text-sm font-normal text-gray-400">({products.total})</span>
            )}
          </h2>

          {products.data.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 px-6 py-16 text-center">
              <p className="text-3xl">📦</p>
              <p className="mt-4 text-sm font-medium text-gray-300">No products yet</p>
              <p className="mt-1 text-xs text-gray-500">
                This store hasn&apos;t listed any products yet. Check back soon!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {products.data.map((product) => (
                <StoreProductCard key={product.id.value} product={product} />
              ))}
            </div>
          )}
        </div>

        {/* Pagination hint (if more products) */}
        {products.total > products.perPage && (
          <p className="mt-8 text-center text-sm text-gray-500">
            Showing {products.data.length} of {products.total} products
          </p>
        )}
      </div>
    </div>
  );
}
