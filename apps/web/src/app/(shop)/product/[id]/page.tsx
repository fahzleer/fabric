import { SceneCanvas } from "@/components/3d/scene-canvas";
import { AuthorBio } from "@/components/seo/author-bio";
import { FaqSection } from "@/components/seo/faq-section";
import { FreshnessLabel } from "@/components/seo/freshness-label";
import { TrustBadges } from "@/components/seo/trust-badges";
import { makeProductId } from "@/domain/product/types";
import { productApiAdapter } from "@/infrastructure/http-product-api.adapter";
import { auth } from "@/lib/auth";
import { preloadProduct } from "@/lib/data";
import { formatPrice } from "@/lib/price";
import { fetchStoreForProduct } from "@/lib/store-api";
import { isSome } from "@fabric/types";
import { Effect } from "effect";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { AddToCartButton } from "./_components/add-to-cart-button";
import { ProductPixelTracker } from "./_components/product-pixel-tracker";

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
    title: product.name.value,
    description: product.tagline || product.description.slice(0, 160),
    openGraph: {
      title: product.name.value,
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
      siteName: "Fabric",
    },
    twitter: {
      card: "summary_large_image",
      title: product.name.value,
      description: product.tagline || product.description.slice(0, 160),
      images: primaryImage ? [primaryImage.url] : undefined,
    },
    alternates: {
      canonical: `/product/${id}`,
    },
    other: {
      "product:price:amount": String(product.price.amount),
      "product:price:currency": product.price.currency,
      "product:availability": product.stock.some((s) => s.quantity - s.reserved > 0)
        ? "in stock"
        : "out of stock",
    },
  };
}

type ProductData = ReturnType<typeof productApiAdapter.getProduct> extends Effect.Effect<
  infer A,
  unknown,
  unknown
>
  ? A
  : never;

function buildProductSchema(
  product: ProductData,
  productUrl: string,
  updatedAt: string,
  storeName: string,
  availableSizes: string[]
) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name.value,
    description: product.description,
    image: product.images.map((img) => img.url),
    url: productUrl,
    dateModified: updatedAt,
    brand: { "@type": "Brand", name: storeName },
    offers: {
      "@type": "Offer",
      priceCurrency: product.price.currency,
      price: product.price.amount,
      availability:
        availableSizes.length > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      url: productUrl,
      seller: { "@type": "Organization", name: storeName },
    },
    ...(product.material.length > 0 ? { material: product.material } : {}),
  };
}

function buildBreadcrumbSchema(baseUrl: string, productName: string, productUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: baseUrl },
      { "@type": "ListItem", position: 2, name: "Products", item: `${baseUrl}/products` },
      { "@type": "ListItem", position: 3, name: productName, item: productUrl },
    ],
  };
}

export default async function ProductPage({ params: paramsPromise }: PageProps) {
  const params = await paramsPromise;
  const productId = makeProductId(params.id);

  preloadProduct(params.id);

  await connection();

  const [result, storeInfo, session] = await Promise.all([
    Effect.runPromise(Effect.either(productApiAdapter.getProduct(productId))),
    fetchStoreForProduct(params.id),
    auth.api.getSession({ headers: await headers() }),
  ]);

  const role = (session?.user as { role?: string })?.role;
  const isMerchant = role === "store_owner" || role === "admin";

  if (result._tag === "Left") {
    notFound();
  }

  const product = result.right;

  const primaryImage = product.images.find((img) => img.isPrimary) ?? product.images[0];
  const formattedPrice = formatPrice(product.price);

  const availableSizes = product.stock
    .filter((s) => s.quantity - s.reserved > 0)
    .map((s) => s.size);

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://fabric.cool";
  const productUrl = `${baseUrl}/product/${params.id}`;

  const updatedAt = product.metadata.updatedAt.slice(0, 10);

  const storeName = isSome(storeInfo) ? storeInfo.value.storeName : "Fabric";
  const productSchema = buildProductSchema(
    product,
    productUrl,
    updatedAt,
    storeName,
    availableSizes
  );
  const breadcrumbSchema = buildBreadcrumbSchema(baseUrl, product.name.value, productUrl);

  return (
    <div className="min-h-screen bg-muted">
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: controlled server-side JSON-LD, no user input
        dangerouslySetInnerHTML={{ __html: JSON.stringify([productSchema, breadcrumbSchema]) }}
      />
      <ProductPixelTracker
        productId={params.id}
        productName={product.name.value}
        price={product.price.amount}
        currency={product.price.currency}
      />
      <header className="border-b border-border bg-card shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <nav aria-label="breadcrumb" className="text-sm text-muted-foreground">
            <ol className="flex items-center gap-1">
              <li>
                <Link href="/" className="hover:text-muted-foreground">
                  หน้าแรก
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li>
                <Link href="/products" className="hover:text-muted-foreground">
                  สินค้า
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li className="text-foreground font-medium truncate max-w-[200px] sm:max-w-md">
                {product.name.value}
              </li>
            </ol>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="aspect-square overflow-hidden rounded-lg bg-secondary flex items-center justify-center p-8 relative">
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
                    className="aspect-square overflow-hidden rounded border border-border bg-secondary flex items-center justify-center p-2 relative"
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
            <div className="flex items-start justify-between gap-4">
              <h1 className="font-display text-3xl text-foreground">{product.name.value}</h1>
              <SceneCanvas
                variant="accent"
                className="hidden h-24 w-24 shrink-0 rounded-full sm:block"
                lazyMount
              />
            </div>
            <div>
              {isSome(storeInfo) && (
                <Link
                  href={`/store/${storeInfo.value.slug}`}
                  className="mt-1.5 inline-flex items-center gap-1 text-sm text-info hover:text-info/80"
                >
                  🏪 Sold by {storeInfo.value.storeName} →
                </Link>
              )}
              {product.tagline.length > 0 && (
                <p className="mt-2 text-lg text-muted-foreground">{product.tagline}</p>
              )}
              <p className="mt-4 font-price text-3xl font-bold text-foreground">{formattedPrice}</p>
            </div>

            <div className="mt-6">
              <h3 className="text-sm font-medium text-foreground">Description</h3>
              <p className="mt-2 text-muted-foreground">{product.description}</p>
            </div>

            <TrustBadges className="mt-4" />

            <div className="mt-6">
              {isMerchant ? (
                <div className="rounded-lg border border-warning bg-warning-subtle px-4 py-3 text-sm text-warning">
                  คุณกำลังดูในฐานะ merchant —{" "}
                  <Link
                    href="/merchant/dashboard"
                    className="font-medium underline hover:text-warning/80"
                  >
                    ไปที่ร้านค้าของคุณ →
                  </Link>
                </div>
              ) : (
                <AddToCartButton
                  productId={productId}
                  availableSizes={availableSizes}
                  price={product.price}
                  productName={product.name.value}
                  productImageUrl={primaryImage.url}
                />
              )}
            </div>

            <div className="mt-8 border-t border-border pt-8 space-y-4">
              {product.material.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-foreground">Material</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{product.material}</p>
                </div>
              )}
              {product.care.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-foreground">Care Instructions</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{product.care}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <FaqSection
          items={[
            {
              question: `${product.name.value} มีไซส์อะไรบ้าง?`,
              answer:
                availableSizes.length > 0
                  ? `ไซส์ที่มีในสต็อก: ${availableSizes.join(", ")} หากไซส์ที่ต้องการหมด สามารถติดต่อร้านค้าเพื่อสั่งจองได้`
                  : "ขณะนี้สินค้าหมดสต็อกชั่วคราว กรุณาติดต่อร้านค้าเพื่อสอบถาม",
            },
            {
              question: "ชำระเงินได้ด้วยวิธีใดบ้าง?",
              answer:
                "รองรับการชำระเงินผ่าน PromptPay (สแกน QR), บัตรเครดิต/เดบิต (Visa, Mastercard) และ Crypto (USDC บน Base network)",
            },
            {
              question: "จัดส่งสินค้าภายในกี่วัน?",
              answer: "จัดส่งภายใน 2–3 วันทำการหลังจากยืนยันการชำระเงิน ส่งทั่วไทยผ่านบริษัทขนส่งชั้นนำ",
            },
            {
              question: "สามารถคืนหรือเปลี่ยนสินค้าได้ไหม?",
              answer:
                "สามารถแจ้งคืนหรือเปลี่ยนสินค้าได้ภายใน 7 วันหลังได้รับสินค้า หากสินค้ามีความชำรุดหรือไม่ตรงกับที่สั่ง",
            },
            {
              question: "สินค้าของ Fabric มีคุณภาพอย่างไร?",
              answer:
                product.material.length > 0
                  ? `ผลิตจาก ${product.material} คัดสรรวัตถุดิบคุณภาพสูง ผ่านการควบคุมคุณภาพก่อนจัดส่ง`
                  : "คัดสรรวัตถุดิบคุณภาพสูง ผ่านการควบคุมคุณภาพก่อนจัดส่งทุกชิ้น",
            },
          ]}
        />

        <div className="mt-12 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-t border-border pt-8">
          <div>
            <h2 className="text-lg font-semibold text-foreground">พร้อมชำระเงิน?</h2>
            <FreshnessLabel updatedAt={updatedAt} quarter="Q2 2026" />
          </div>
          <Link
            href="/checkout"
            className="rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            ไปที่หน้าชำระเงิน
          </Link>
        </div>

        <AuthorBio name="Fabric Editorial" jobTitle="Product Team" updatedAt={updatedAt} />
      </main>
    </div>
  );
}
