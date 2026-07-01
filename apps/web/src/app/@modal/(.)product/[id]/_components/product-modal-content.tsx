import { AddToCartButton } from "@/app/(shop)/product/[id]/_components/add-to-cart-button";
import type { Product } from "@/domain/product/types";
import { formatPrice } from "@/lib/price";
import Image from "next/image";

interface ProductModalContentProps {
  product: Product;
}

export function ProductModalContent({ product }: ProductModalContentProps) {
  const primaryImage = product.images.find((img) => img.isPrimary) ?? product.images[0];
  const formattedPrice = formatPrice(product.price);
  const availableSizes = product.stock
    .filter((s) => s.quantity - s.reserved > 0)
    .map((s) => s.size);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2">
      <div className="aspect-square bg-secondary flex items-center justify-center p-8 relative">
        <Image
          src={primaryImage.url}
          alt={primaryImage.altText}
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          priority
          className="object-contain"
          style={{ backgroundColor: "#f3f4f6" }}
        />
      </div>

      <div className="p-6 flex flex-col">
        <div>
          <h2 className="text-2xl font-bold text-foreground">{product.name.value}</h2>
          {product.tagline.length > 0 && (
            <p className="mt-1 text-sm text-muted-foreground">{product.tagline}</p>
          )}
          <p className="mt-3 text-2xl font-bold text-foreground">{formattedPrice}</p>
        </div>

        <div className="mt-4 flex-1">
          <h3 className="text-sm font-medium text-foreground">Description</h3>
          <p className="mt-2 text-sm text-muted-foreground">{product.description}</p>
        </div>

        <div className="mt-6">
          <AddToCartButton
            productId={product.id}
            availableSizes={availableSizes}
            price={product.price}
            productName={product.name.value}
            productImageUrl={primaryImage.url}
          />
        </div>

        <div className="mt-3">
          <a
            href={`/product/${product.id.value}`}
            className="block w-full text-center rounded-lg border border-border-strong px-4 py-2 text-sm text-muted-foreground font-medium hover:bg-muted transition-colors"
          >
            View Full Details
          </a>
        </div>
      </div>
    </div>
  );
}
