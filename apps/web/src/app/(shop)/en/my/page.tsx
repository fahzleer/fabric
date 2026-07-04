import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld";
import { FaqSection } from "@/components/seo/faq-section";
import { TrustBadges } from "@/components/seo/trust-badges";
import type { Metadata } from "next";
import Link from "next/link";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://fabric.cool";

export const metadata: Metadata = {
  title: "Premium T-Shirts Online — Ship to Malaysia | Fabric",
  description:
    "Shop premium quality t-shirts from Fabric — worldwide shipping to Malaysia, pay with Visa, Mastercard or USDC crypto. Free size guide, 7-day returns.",
  alternates: {
    canonical: `${APP_URL}/en/my`,
    languages: { "en-MY": `${APP_URL}/en/my`, "x-default": `${APP_URL}/products` },
  },
  openGraph: {
    title: "Premium T-Shirts Online — Ship to Malaysia | Fabric",
    description:
      "Quality t-shirts shipped to Malaysia. Pay with international card or USDC crypto.",
    url: `${APP_URL}/en/my`,
    locale: "en_MY",
    type: "website",
  },
};

const FAQ_ITEMS = [
  {
    question: "Do you ship to Malaysia?",
    answer:
      "Yes, Fabric ships internationally to Malaysia. Shipping is handled via trusted couriers with tracking available. Delivery typically takes 5–10 business days.",
  },
  {
    question: "Can I pay with a Malaysian credit card?",
    answer:
      "Yes, we accept Visa and Mastercard from any country including Malaysia. You can also pay with USDC on Base network.",
  },
  {
    question: "Are prices shown in THB or MYR?",
    answer:
      "Prices are shown in THB (Thai Baht). Your bank will convert to MYR at their current exchange rate when you pay by card.",
  },
  {
    question: "Can I return an item if I'm in Malaysia?",
    answer:
      "We accept returns within 7 days for defective or incorrect items. International return shipping costs are borne by the buyer unless the fault is ours.",
  },
];

const SCHEMA = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  url: `${APP_URL}/en/my`,
  name: "Premium T-Shirts Online — Ship to Malaysia | Fabric",
  description: metadata.description,
  inLanguage: "en-MY",
  publisher: { "@type": "Organization", name: "Fabric", url: APP_URL },
};

export default function MalaysiaPage() {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", href: "/" },
          { name: "Malaysia", href: "/en/my" },
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
            <span className="text-2xl">🇲🇾</span>
            <span className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Malaysia
            </span>
          </div>
          <h1 className="font-display text-4xl text-foreground">
            Premium T-Shirts — Delivered to Malaysia
          </h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl">
            Shop curated, premium quality t-shirts from Fabric and get them shipped directly to your
            door in Malaysia. Pay safely with your international Mastercard, Visa, or USDC crypto.
          </p>
          <div className="mt-6 flex gap-3">
            <Link
              href="/products"
              className="rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Browse Products
            </Link>
            <Link
              href="/payment/card"
              className="rounded-lg border border-border-strong px-6 py-3 text-sm font-medium text-muted-foreground hover:bg-muted"
            >
              Payment Options →
            </Link>
          </div>
        </header>

        <TrustBadges className="mb-10" />

        <section aria-labelledby="shipping-heading" className="mb-10">
          <h2 id="shipping-heading" className="text-xl font-semibold text-foreground mb-4">
            Shipping to Malaysia
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              { label: "Delivery time", value: "5–10 business days" },
              { label: "Tracking", value: "Available on all orders" },
              { label: "Returns", value: "7-day return policy" },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">
                  {item.label}
                </p>
                <p className="mt-1 font-semibold text-foreground">{item.value}</p>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="payment-heading" className="mb-10">
          <h2 id="payment-heading" className="text-xl font-semibold text-foreground mb-4">
            Payment Options for Malaysia
          </h2>
          <ul className="space-y-3">
            <li className="flex items-start gap-3 rounded-lg border border-border p-4">
              <span className="text-success font-bold mt-0.5">✓</span>
              <div>
                <p className="font-medium text-foreground">
                  Credit / Debit Card (Visa, Mastercard)
                </p>
                <p className="text-sm text-muted-foreground">
                  International cards accepted. Currency shown in THB, converted by your bank.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3 rounded-lg border border-border p-4">
              <span className="text-success font-bold mt-0.5">✓</span>
              <div>
                <p className="font-medium text-foreground">USDC on Base Network</p>
                <p className="text-sm text-muted-foreground">
                  Pay with crypto — MetaMask or Coinbase Wallet, no bank account needed.
                </p>
              </div>
            </li>
          </ul>
        </section>

        <FaqSection items={FAQ_ITEMS} heading="Frequently Asked Questions — Malaysia" />
      </div>
    </>
  );
}
