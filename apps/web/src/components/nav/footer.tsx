import { GENRE_LABELS } from "@/app/(shop)/products/_lib/product-helpers";
import Link from "next/link";

const GENRE_ORDER = ["punk", "metal", "emo", "hardcore", "deathcore"] as const;

const HELP_LINKS = [
  { href: "/guides/how-to-order", label: "วิธีสั่งซื้อครั้งแรก" },
  { href: "/guides/returns", label: "นโยบายคืนสินค้า" },
  { href: "/payment/compare", label: "เปรียบเทียบวิธีชำระเงิน" },
] as const;

const PAYMENT_LINKS = [
  { href: "/payment/card", label: "บัตรเครดิต / เดบิต" },
  { href: "/payment/promptpay", label: "PromptPay" },
  { href: "/payment/crypto", label: "USDC Crypto" },
] as const;

const SHIP_TO_LINKS = [
  { href: "/en/my", label: "Malaysia" },
  { href: "/en/ph", label: "Philippines" },
  { href: "/id", label: "Indonesia" },
  { href: "/vi", label: "Việt Nam" },
] as const;

/**
 * Site-wide footer — the fix for the previously-orphaned content pages
 * (about/guides/payment/locale landings had zero navbar links and were only
 * reachable via a link cluster at the bottom of /products or a direct URL).
 * Mounted once in (shop)/layout.tsx. The per-page `internalLinks` block in
 * products/page.tsx is intentionally left in place — it's wired to a live
 * A/B experiment (ANCHOR_TEXT_EXPERIMENT in lib/server-experiment.ts) testing
 * anchor-text copy, which is a distinct concern from this global nav fix.
 */
export function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-4 py-10 sm:px-6 md:grid-cols-4 lg:px-8">
        <div>
          <h2 className="font-display text-sm font-bold uppercase tracking-wordmark text-foreground">
            Shop
          </h2>
          <ul className="mt-3 space-y-2">
            {GENRE_ORDER.map((genre) => (
              <li key={genre}>
                <Link
                  href={`/products?genre=${genre}`}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  {GENRE_LABELS[genre]}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="font-display text-sm font-bold uppercase tracking-wordmark text-foreground">
            Help
          </h2>
          <ul className="mt-3 space-y-2">
            {HELP_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="font-display text-sm font-bold uppercase tracking-wordmark text-foreground">
            ชำระเงิน
          </h2>
          <ul className="mt-3 space-y-2">
            {PAYMENT_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  {link.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/about" className="text-sm text-muted-foreground hover:text-foreground">
                เกี่ยวกับ Fabric
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="font-display text-sm font-bold uppercase tracking-wordmark text-foreground">
            Shipping to
          </h2>
          <ul className="mt-3 space-y-2">
            {SHIP_TO_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <p className="font-display tracking-wordmark text-xs font-black text-muted-foreground">
            FABRIC
          </p>
        </div>
      </div>
    </footer>
  );
}
