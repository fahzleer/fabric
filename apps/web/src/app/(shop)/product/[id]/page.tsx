import { makeProductId } from "@/domain/product/types";
import { productApiAdapter } from "@/infrastructure/http-product-api.adapter";
import { preloadProduct } from "@/lib/data";
import { formatPrice } from "@/lib/price";
import { fetchStoreForProduct } from "@/lib/store-api";
import { isSome } from "@fabric/types";
import { Effect } from "effect";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { AddToCartButton } from "./_components/add-to-cart-button";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[]>>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const productId = makeProductId(id);

  const result = await Effect.runPromise(Effect.either(productApiAdapter.getProduct(productId)));

  if (result._tag === "Left") {
    return {
      title: "Product Not Found",
      description: "The product you are looking for does not exist.",
    };
  }

  const product = result.right;
  const primaryImage = product.images.find((img) => img.isPrimary) ?? product.images[0];

  return {
    title: product.name,
    description: product.tagline || product.description.slice(0, 160),
    openGraph: {
      title: product.name,
      description: product.tagline || product.description.slice(0, 160),
      images: primaryImage
        ? [
            {
              url: primaryImage.url,
              alt: primaryImage.altText,
              width: 1200,
              height: 630,
            },
          ]
        : undefined,
      type: "website",
      locale: "th_TH",
    },
    twitter: {
      card: "summary_large_image",
      title: product.name,
      description: product.tagline || product.description.slice(0, 160),
      images: primaryImage ? [primaryImage.url] : undefined,
    },
    alternates: {
      canonical: `/product/${id}`,
    },
    other: {
      "product:price:amount": String(product.price.displayAmount),
      "product:price:currency": product.price.currency,
      "product:availability": product.stock.some((s) => s.quantity - s.reserved > 0)
        ? "in stock"
        : "out of stock",
    },
  };
}

export default async function ProductPage({ params: paramsPromise }: PageProps) {
  const params = await paramsPromise;
  const productId = makeProductId(params.id);

  preloadProduct(params.id);

  await connection();

  const [result, storeInfo] = await Promise.all([
    Effect.runPromise(Effect.either(productApiAdapter.getProduct(productId))),
    fetchStoreForProduct(params.id),
  ]);

  if (result._tag === "Left") {
    notFound();
  }

  const product = result.right;

  const primaryImage = product.images.find((img) => img.isPrimary) ?? product.images[0];
  const formattedPrice = formatPrice(product.price);

  const availableSizes = product.stock
    .filter((s) => s.quantity - s.reserved > 0)
    .map((s) => s.size);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/products" className="text-blue-600 hover:text-blue-800">
            ← Back to Products
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="aspect-square overflow-hidden rounded-lg bg-gray-100 flex items-center justify-center p-8 relative">
              <Image
                src={primaryImage.url}
                alt={primaryImage.altText}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-contain"
                priority
                style={{ backgroundColor: "#f3f4f6" }}
              />
            </div>
            {product.images.length > 1 && (
              <div className="grid grid-cols-4 gap-4">
                {product.images.map((image) => (
                  <div
                    key={image.order}
                    className="aspect-square overflow-hidden rounded border border-gray-200 bg-gray-100 flex items-center justify-center p-2 relative"
                  >
                    <Image
                      src={image.url}
                      alt={image.altText}
                      fill
                      sizes="(max-width: 768px) 25vw, 15vw"
                      className="object-contain"
                      style={{ backgroundColor: "#f3f4f6" }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{product.name}</h1>
              {isSome(storeInfo) && (
                <Link
                  href={`/store/${storeInfo.value.slug}`}
                  className="mt-1.5 inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                >
                  🏪 Sold by {storeInfo.value.storeName} →
                </Link>
              )}
              {product.tagline.length > 0 && (
                <p className="mt-2 text-lg text-gray-600">{product.tagline}</p>
              )}
              <p className="mt-4 text-3xl font-bold text-gray-900">{formattedPrice}</p>
            </div>

            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-900">Description</h3>
              <p className="mt-2 text-gray-600">{product.description}</p>
            </div>

            <div className="mt-6">
              <AddToCartButton
                productId={productId}
                availableSizes={availableSizes}
                price={product.price}
                productName={product.name}
                productImageUrl={primaryImage.url}
              />
            </div>

            <div className="mt-8 border-t border-gray-200 pt-8 space-y-4">
              {product.material.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-900">Material</h3>
                  <p className="mt-2 text-sm text-gray-600">{product.material}</p>
                </div>
              )}
              {product.care.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-900">Care Instructions</h3>
                  <p className="mt-2 text-sm text-gray-600">{product.care}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
