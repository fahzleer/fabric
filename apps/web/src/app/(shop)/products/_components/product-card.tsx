import type { ProductSummary } from "@/domain/product/types";
import { formatPrice } from "@/lib/price";
import Image from "next/image";
import Link from "next/link";

type ProductCardProps = {
  readonly product: ProductSummary;
};

export function ProductCard({ product }: ProductCardProps) {
  const formattedPrice = formatPrice(product.price);

  return (
    <Link
      href={`/product/${product.id}`}
      className="group block overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="aspect-square overflow-hidden bg-gray-100 relative">
        <Image
          src={product.primaryImage.url}
          alt={product.primaryImage.altText}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
          className="object-cover transition-transform group-hover:scale-105"
          style={{ backgroundColor: "#e5e7eb" }}
        />
      </div>

      <div className="p-4">
        <h3 className="text-lg font-semibold text-gray-900">{product.name}</h3>
        <p className="mt-1 text-sm text-gray-600">{product.tagline}</p>
        <div className="mt-2 flex items-center justify-between">
          <p className="text-xl font-bold text-gray-900">{formattedPrice}</p>
          {!product.inStock && (
            <span className="text-sm text-red-500 font-medium">Out of stock</span>
          )}
        </div>
      </div>
    </Link>
  );
}
