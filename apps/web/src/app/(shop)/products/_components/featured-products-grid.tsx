import { ABTrack } from "@/components/ab/ab-track";
import type { ProductSummary } from "@/domain/product/types";
import { formatPrice } from "@/lib/price";
import Image from "next/image";
import Link from "next/link";

type Props = {
  readonly products: readonly ProductSummary[];
  readonly heroCta?: string;
};

function HeroCard({ product, ctaText }: { product: ProductSummary; ctaText: string }) {
  const formattedPrice = formatPrice(product.price);

  return (
    <>
      <ABTrack experimentId="hero-cta-text" eventType="impression" />
      <Link
        href={`/product/${product.id}`}
        className="group relative flex h-full min-h-120 overflow-hidden rounded-2xl bg-gray-900 shadow-lg transition-shadow hover:shadow-xl"
      >
        {/* Background image */}
        <Image
          src={product.primaryImage.url}
          alt={product.primaryImage.altText}
          fill
          sizes="66vw"
          priority
          className="object-contain transition-transform duration-500 group-hover:scale-105"
          style={{ backgroundColor: "#111827" }}
        />

        {/* Gradient overlay — only bottom strip for readability */}
        <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/10 to-transparent" />

        {/* Content */}
        <div className="relative mt-auto p-6">
          <h3 className="text-2xl font-bold text-white">{product.name}</h3>
          <p className="mt-1 text-sm text-gray-300">{product.tagline}</p>
          <p className="mt-3 text-xl font-bold text-white">{formattedPrice}</p>
          <span className="mt-4 inline-block rounded-lg bg-white px-5 py-2 text-sm font-semibold text-gray-900 transition-colors group-hover:bg-gray-100">
            {ctaText}
          </span>
        </div>
      </Link>
    </>
  );
}

function SmallCard({ product }: { product: ProductSummary }) {
  const formattedPrice = formatPrice(product.price);

  return (
    <Link
      href={`/product/${product.id}`}
      className="group relative flex overflow-hidden rounded-2xl bg-gray-800 shadow-md transition-shadow hover:shadow-lg"
    >
      {/* Background image */}
      <Image
        src={product.primaryImage.url}
        alt={product.primaryImage.altText}
        fill
        sizes="33vw"
        className="object-contain transition-transform duration-500 group-hover:scale-105"
        style={{ backgroundColor: "#1f2937" }}
      />

      {/* Gradient overlay — only bottom strip for readability */}
      <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/5 to-transparent" />

      {/* Content */}
      <div className="relative mt-auto p-4">
        <h3 className="text-lg font-bold text-white">{product.name}</h3>
        <p className="mt-0.5 text-xl font-bold text-white">{formattedPrice}</p>
      </div>
    </Link>
  );
}

export function FeaturedProductsGrid({ products, heroCta = "Shop Now" }: Props) {
  if (products.length === 0) return null;

  const [hero, ...rest] = products;
  if (!hero) return null;

  return (
    <div className="grid h-130 grid-cols-3 gap-4">
      {/* Hero — spans 2 cols and full height */}
      <div className="col-span-2 row-span-2">
        <HeroCard product={hero} ctaText={heroCta} />
      </div>

      {/* Smaller cards — stack on right */}
      {rest.map((product) => (
        <SmallCard key={product.id} product={product} />
      ))}
    </div>
  );
}
