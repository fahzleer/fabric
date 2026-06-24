import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld";
import { FaqSection } from "@/components/seo/faq-section";
import { TrustBadges } from "@/components/seo/trust-badges";
import type { Metadata } from "next";
import Link from "next/link";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://fabric.cool";

export const metadata: Metadata = {
  title: "Premium T-Shirts Online — Ship to Philippines | Fabric",
  description:
    "Shop premium quality t-shirts from Fabric — worldwide shipping to the Philippines. Pay with Visa, Mastercard or USDC crypto. 7-day returns guaranteed.",
  alternates: {
    canonical: `${APP_URL}/en/ph`,
    languages: { "en-PH": `${APP_URL}/en/ph`, "x-default": `${APP_URL}/products` },
  },
  openGraph: {
    title: "Premium T-Shirts Online — Ship to Philippines | Fabric",
    description:
      "Quality t-shirts shipped to the Philippines. Pay with international card or USDC.",
    url: `${APP_URL}/en/ph`,
    locale: "en_PH",
    type: "website",
  },
};

const FAQ_ITEMS = [
  {
    question: "Do you ship to the Philippines?",
    answer:
      "Yes, Fabric ships internationally to the Philippines via trusted international couriers with end-to-end tracking. Estimated delivery is 7–14 business days.",
  },
  {
    question: "Can I pay with GCash or PayMaya?",
    answer:
      "Currently we support international credit/debit cards (Visa, Mastercard) and USDC crypto on Base network. GCash support is on our roadmap.",
  },
  {
    question: "Are prices in PHP or THB?",
    answer:
      "Prices are listed in THB. Your card issuer will convert to PHP at their prevailing exchange rate at the time of payment.",
  },
  {
    question: "What's the return policy for Philippine customers?",
    answer:
      "We accept returns within 7 days for defective or wrong items shipped. Please contact us with your order number and photos of the issue.",
  },
];

const SCHEMA = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  url: `${APP_URL}/en/ph`,
  name: "Premium T-Shirts Online — Ship to Philippines | Fabric",
  description: metadata.description,
  inLanguage: "en-PH",
  publisher: { "@type": "Organization", name: "Fabric", url: APP_URL },
};

export default function PhilippinesPage() {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", href: "/" },
          { name: "Philippines", href: "/en/ph" },
        ]}
      />
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: controlled server-side JSON-LD
        dangerouslySetInnerHTML={{ __html: JSON.stringify(SCHEMA) }}
      />

      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <header className="mb-10">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">🇵🇭</span>
            <span className="text-sm font-medium text-gray-500 uppercase tracking-wide">
              Philippines
            </span>
          </div>
          <h1 className="text-4xl font-bold text-gray-900">
            Premium T-Shirts — Delivered to the Philippines
          </h1>
          <p className="mt-4 text-lg text-gray-600 max-w-2xl">
            Discover premium quality t-shirts from Fabric, shipped directly to the Philippines. Pay
            securely with your Visa or Mastercard — no local payment account required.
          </p>
          <div className="mt-6 flex gap-3">
            <Link
              href="/products"
              className="rounded-lg bg-gray-900 px-6 py-3 text-sm font-medium text-white hover:bg-gray-700"
            >
              Browse Products
            </Link>
            <Link
              href="/payment/compare"
              className="rounded-lg border border-gray-300 px-6 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Payment Options →
            </Link>
          </div>
        </header>

        <TrustBadges className="mb-10" />

        <section aria-labelledby="shipping-heading" className="mb-10">
          <h2 id="shipping-heading" className="text-xl font-semibold text-gray-900 mb-4">
            Shipping to the Philippines
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              { label: "Delivery time", value: "7–14 business days" },
              { label: "Tracking", value: "Full tracking included" },
              { label: "Returns", value: "7-day return policy" },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border border-gray-200 bg-white p-4">
                <p className="text-xs text-gray-500 uppercase tracking-wide">{item.label}</p>
                <p className="mt-1 font-semibold text-gray-900">{item.value}</p>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="payment-heading" className="mb-10">
          <h2 id="payment-heading" className="text-xl font-semibold text-gray-900 mb-4">
            Payment Options for the Philippines
          </h2>
          <ul className="space-y-3">
            <li className="flex items-start gap-3 rounded-lg border border-gray-200 p-4">
              <span className="text-green-600 font-bold mt-0.5">✓</span>
              <div>
                <p className="font-medium text-gray-900">Credit / Debit Card (Visa, Mastercard)</p>
                <p className="text-sm text-gray-500">
                  International cards accepted — BDO, BPI, Metrobank, or any global issuer.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3 rounded-lg border border-gray-200 p-4">
              <span className="text-green-600 font-bold mt-0.5">✓</span>
              <div>
                <p className="font-medium text-gray-900">USDC on Base Network</p>
                <p className="text-sm text-gray-500">
                  Crypto-native shoppers can pay with USDC — fast, borderless, no FX fees.
                </p>
              </div>
            </li>
          </ul>
        </section>

        <FaqSection items={FAQ_ITEMS} heading="Frequently Asked Questions — Philippines" />
      </div>
    </>
  );
}
