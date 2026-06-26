import type { ProductSummary } from "@/domain/product/types";
import { formatPrice } from "@/lib/price";
import Image from "next/image";
import Link from "next/link";
import { CATEGORY_LABELS } from "../_lib/product-helpers";

type BadgeType = "bestseller" | "premium" | "limited";

type ProductCardProps = {
  readonly product: ProductSummary;
  readonly badge?: BadgeType | undefined;
};

function badgeStyle(badge: BadgeType): string {
  switch (badge) {
    case "bestseller":
      return "bg-warning-subtle text-warning-foreground";
    case "premium":
      return "bg-info-subtle text-info";
    case "limited":
      return "bg-destructive-subtle text-destructive";
  }
}

function badgeLabel(badge: BadgeType): string {
  switch (badge) {
    case "bestseller":
      return "ขายดี";
    case "premium":
      return "Premium";
    case "limited":
      return "Limited";
  }
}

export function ProductCard({ product, badge }: ProductCardProps) {
  const formattedPrice = formatPrice(product.price);
  const categoryLabel = CATEGORY_LABELS[product.category];

  return (
    <Link
      href={`/product/${product.id.value}`}
      className="group block overflow-hidden rounded-lg border border-border bg-card shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="aspect-square overflow-hidden bg-muted relative">
        {badge && (
          <span
            className={`absolute left-2 top-2 z-10 rounded-full px-2 py-0.5 text-xs font-semibold ${badgeStyle(badge)}`}
          >
            {badgeLabel(badge)}
          </span>
        )}
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
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-lg font-semibold text-foreground">{product.name.value}</h3>
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {categoryLabel}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{product.tagline}</p>
        <div className="mt-2 flex items-center justify-between">
          <p className="font-price text-xl font-bold text-foreground">{formattedPrice}</p>
          {!product.inStock && (
            <span className="text-sm font-medium text-destructive">Out of stock</span>
          )}
        </div>
      </div>
    </Link>
  );
}
