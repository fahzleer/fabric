import { ExperimentCookieSetter } from "@/components/experiment-cookie-setter";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld";
import { productApiAdapter } from "@/infrastructure/http-product-api.adapter";
import { preloadProducts } from "@/lib/data";
import {
  ANCHOR_TEXT_EXPERIMENT,
  TITLE_TAG_EXPERIMENT,
  getServerVariant,
  getVariantTitle,
} from "@/lib/server-experiment";
import { Effect } from "effect";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { FeaturedProductsGrid, ProductsCatalog, StickyTrustBar } from "./_components";
import { deduplicateProducts, enrichProducts } from "./_lib/product-helpers";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://fabric.cool";
const DESCRIPTION =
  "เลือกซื้อเสื้อ premium quality จาก Fabric — ผ้าดี ทรงสวย ทุกไซส์ ส่งทั่วไทย ชำระผ่าน PromptPay บัตรเครดิต หรือ Crypto";

export async function generateMetadata(): Promise<Metadata> {
  const variant = await getServerVariant(TITLE_TAG_EXPERIMENT);
  const title = getVariantTitle(TITLE_TAG_EXPERIMENT, variant);
  return {
    title,
    description: DESCRIPTION,
    alternates: { canonical: `${APP_URL}/products` },
    openGraph: {
      title: `${title} — Fabric`,
      description: DESCRIPTION,
      url: `${APP_URL}/products`,
      type: "website",
    },
  };
}

export default async function ProductsPage() {
  preloadProducts();

  await connection();

  const result = await Effect.runPromise(Effect.either(productApiAdapter.getProducts()));

  if (result._tag === "Left") {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-destructive">{result.left.message}</p>
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
  const catalogProducts = enrichProducts(deduplicateProducts(products));

  const anchorVariant = await getServerVariant(ANCHOR_TEXT_EXPERIMENT);

  const anchorLabels: Record<string, string> =
    anchorVariant === "variant"
      ? {
          "/payment/compare": "เลือกจ่ายให้คุ้ม",
          "/payment/promptpay": "จ่ายด้วย PromptPay",
          "/payment/card": "จ่ายด้วยบัตร",
          "/payment/crypto": "จ่ายด้วย Crypto",
          "/guides/how-to-order": "สั่งซื้อยังไง",
          "/guides/returns": "ต้องการคืนของ",
          "/about": "ทำไมต้อง Fabric",
        }
      : {
          "/payment/compare": "เปรียบเทียบวิธีชำระเงิน",
          "/payment/promptpay": "ชำระผ่าน PromptPay",
          "/payment/card": "บัตรเครดิต / เดบิต",
          "/payment/crypto": "ชำระด้วย USDC Crypto",
          "/guides/how-to-order": "วิธีสั่งซื้อครั้งแรก",
          "/guides/returns": "นโยบายคืนสินค้า",
          "/about": "เกี่ยวกับ Fabric",
        };

  const internalLinks = [
    { href: "/payment/compare", label: anchorLabels["/payment/compare"] },
    { href: "/payment/promptpay", label: anchorLabels["/payment/promptpay"] },
    { href: "/payment/card", label: anchorLabels["/payment/card"] },
    { href: "/payment/crypto", label: anchorLabels["/payment/crypto"] },
    { href: "/guides/how-to-order", label: anchorLabels["/guides/how-to-order"] },
    { href: "/guides/returns", label: anchorLabels["/guides/returns"] },
    { href: "/about", label: anchorLabels["/about"] },
  ];

  return (
    <>
      <StickyTrustBar />
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <BreadcrumbJsonLd
          items={[
            { name: "หน้าแรก", href: "/" },
            { name: "สินค้าทั้งหมด", href: "/products" },
          ]}
        />
        <nav aria-label="breadcrumb" className="text-sm text-gray-500">
          <ol className="flex items-center gap-1">
            <li>
              <Link href="/" className="hover:text-gray-700">
                หน้าแรก
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="font-medium text-gray-900">สินค้าทั้งหมด</li>
          </ol>
        </nav>

        <ExperimentCookieSetter experimentId={TITLE_TAG_EXPERIMENT} />
        <ExperimentCookieSetter experimentId={ANCHOR_TEXT_EXPERIMENT} />

        <FeaturedProductsGrid products={featured} />

        {catalogProducts.length > 0 && <ProductsCatalog products={catalogProducts} />}

        <nav aria-label="ข้อมูลเพิ่มเติม" className="border-t border-gray-100 pt-8">
          <p className="mb-3 text-sm font-medium text-gray-500">ข้อมูลที่เป็นประโยชน์</p>
          <div className="flex flex-wrap gap-2">
            {internalLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-full border border-gray-200 px-3 py-1.5 text-xs text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </nav>

        <div className="flex flex-col items-start justify-between gap-4 border-t border-gray-100 pt-8 sm:flex-row sm:items-center">
          <h2 className="text-lg font-semibold text-gray-900">พร้อมเริ่มช้อปหรือยัง?</h2>
          <Link
            href="/auth/register"
            className="rounded-lg bg-gray-900 px-6 py-3 text-center text-sm font-medium text-white hover:bg-gray-800"
          >
            สร้างบัญชีฟรี
          </Link>
        </div>
      </div>
    </>
  );
}
