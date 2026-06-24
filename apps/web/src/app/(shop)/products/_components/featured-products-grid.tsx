import type { ProductSummary } from "@/domain/product/types";
import { formatPrice } from "@/lib/price";
import Image from "next/image";
import Link from "next/link";

type Props = {
  readonly products: readonly ProductSummary[];
};

function HeroCard({ product }: { product: ProductSummary }) {
  const formattedPrice = formatPrice(product.price);

  return (
    <Link
      href={`/product/${product.id.value}`}
      className="group block overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-gray-50">
        <Image
          src={product.primaryImage.url}
          alt={product.primaryImage.altText}
          fill
          sizes="66vw"
          priority
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>
      <div className="p-6">
        <h3 className="text-2xl font-bold text-gray-900">{product.name.value}</h3>
        <p className="mt-1 text-sm text-gray-500">{product.tagline}</p>
        <p className="mt-3 text-xl font-bold text-gray-900">{formattedPrice}</p>
      </div>
    </Link>
  );
}

function SmallCard({ product }: { product: ProductSummary }) {
  const formattedPrice = formatPrice(product.price);

  return (
    <Link
      href={`/product/${product.id.value}`}
      className="group block overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-square overflow-hidden bg-gray-50">
        <Image
          src={product.primaryImage.url}
          alt={product.primaryImage.altText}
          fill
          sizes="33vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>
      <div className="p-4">
        <h3 className="text-base font-semibold text-gray-900">{product.name.value}</h3>
        <p className="mt-0.5 text-lg font-bold text-gray-900">{formattedPrice}</p>
      </div>
    </Link>
  );
}

export function FeaturedProductsGrid({ products }: Props) {
  if (products.length === 0) return null;

  const [hero, ...rest] = products;
  if (!hero) return null;

  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="col-span-2">
        <HeroCard product={hero} />
      </div>
      <div className="flex flex-col gap-4">
        {rest.map((product) => (
          <SmallCard key={product.id.value} product={product} />
        ))}
      </div>
    </div>
  );
}
