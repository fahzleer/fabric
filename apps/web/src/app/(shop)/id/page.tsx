import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld";
import { FaqSection } from "@/components/seo/faq-section";
import { TrustBadges } from "@/components/seo/trust-badges";
import type { Metadata } from "next";
import Link from "next/link";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://fabric.cool";

export const metadata: Metadata = {
  title: "Kaos Premium Online — Pengiriman ke Indonesia | Fabric",
  description:
    "Belanja kaos premium berkualitas dari Fabric — pengiriman internasional ke Indonesia, bayar dengan kartu Visa, Mastercard atau USDC crypto. Garansi 7 hari.",
  alternates: {
    canonical: `${APP_URL}/id`,
    languages: { id: `${APP_URL}/id`, "x-default": `${APP_URL}/products` },
  },
  openGraph: {
    title: "Kaos Premium Online — Pengiriman ke Indonesia | Fabric",
    description:
      "Kaos berkualitas tinggi dikirim ke Indonesia. Bayar dengan kartu internasional atau USDC crypto.",
    url: `${APP_URL}/id`,
    locale: "id_ID",
    type: "website",
  },
};

const FAQ_ITEMS = [
  {
    question: "Apakah Fabric mengirim ke Indonesia?",
    answer:
      "Ya, Fabric mengirim secara internasional ke seluruh Indonesia melalui kurir terpercaya dengan pelacakan penuh. Estimasi pengiriman 7–14 hari kerja.",
  },
  {
    question: "Bisakah saya membayar dengan kartu Indonesia?",
    answer:
      "Ya, kami menerima Visa dan Mastercard dari bank mana pun termasuk BCA, Mandiri, BRI, BNI, dan CIMB Niaga.",
  },
  {
    question: "Apakah bisa bayar dengan GoPay atau OVO?",
    answer:
      "Saat ini kami mendukung kartu kredit/debit Visa dan Mastercard serta USDC crypto di Base network. Dukungan e-wallet Indonesia sedang dalam rencana pengembangan.",
  },
  {
    question: "Harga ditampilkan dalam mata uang apa?",
    answer:
      "Harga ditampilkan dalam THB (Baht Thailand). Bank Anda akan mengkonversi ke IDR berdasarkan kurs yang berlaku saat pembayaran.",
  },
  {
    question: "Bagaimana kebijakan pengembalian barang?",
    answer:
      "Kami menerima pengembalian dalam 7 hari untuk barang cacat atau salah kirim. Hubungi tim kami dengan nomor pesanan dan foto barang.",
  },
];

const SCHEMA = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  url: `${APP_URL}/id`,
  name: "Kaos Premium Online — Pengiriman ke Indonesia | Fabric",
  description: metadata.description,
  inLanguage: "id",
  publisher: { "@type": "Organization", name: "Fabric", url: APP_URL },
};

export default function IndonesiaPage() {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Beranda", href: "/" },
          { name: "Indonesia", href: "/id" },
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
            <span className="text-2xl">🇮🇩</span>
            <span className="text-sm font-medium text-gray-500 uppercase tracking-wide">
              Indonesia
            </span>
          </div>
          <h1 className="text-4xl font-bold text-gray-900">Kaos Premium — Dikirim ke Indonesia</h1>
          <p className="mt-4 text-lg text-gray-600 max-w-2xl">
            Temukan koleksi kaos premium berkualitas tinggi dari Fabric, dikirim langsung ke seluruh
            Indonesia. Bayar aman dengan kartu Visa/Mastercard internasional atau USDC crypto.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/products"
              className="rounded-lg bg-gray-900 px-6 py-3 text-sm font-medium text-white hover:bg-gray-700"
            >
              Lihat Produk
            </Link>
            <Link
              href="/payment/card"
              className="rounded-lg border border-gray-300 px-6 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cara Pembayaran →
            </Link>
          </div>
        </header>

        <TrustBadges className="mb-10" />

        <section aria-labelledby="shipping-heading" className="mb-10">
          <h2 id="shipping-heading" className="text-xl font-semibold text-gray-900 mb-4">
            Pengiriman ke Indonesia
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              { label: "Estimasi tiba", value: "7–14 hari kerja" },
              { label: "Pelacakan", value: "Tersedia di semua pesanan" },
              { label: "Pengembalian", value: "Garansi 7 hari" },
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
            Metode Pembayaran untuk Indonesia
          </h2>
          <ul className="space-y-3">
            <li className="flex items-start gap-3 rounded-lg border border-gray-200 p-4">
              <span className="text-success font-bold mt-0.5">✓</span>
              <div>
                <p className="font-medium text-gray-900">Kartu Kredit / Debit (Visa, Mastercard)</p>
                <p className="text-sm text-gray-500">
                  Diterima dari semua bank Indonesia — BCA, Mandiri, BRI, BNI, dan lainnya.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3 rounded-lg border border-gray-200 p-4">
              <span className="text-success font-bold mt-0.5">✓</span>
              <div>
                <p className="font-medium text-gray-900">USDC di Base Network</p>
                <p className="text-sm text-gray-500">
                  Bayar dengan crypto — MetaMask atau Coinbase Wallet, tanpa rekening bank.
                </p>
              </div>
            </li>
          </ul>
        </section>

        <section aria-labelledby="why-heading" className="mb-10">
          <h2 id="why-heading" className="text-xl font-semibold text-gray-900 mb-4">
            Mengapa Memilih Fabric?
          </h2>
          <ul className="space-y-2">
            {[
              "Bahan premium berkualitas tinggi — dipilih langsung dari produsen terpercaya",
              "Foto produk nyata — tidak ada filter berlebihan",
              "Ukuran tersedia: XS, S, M, L, XL, XXL",
              "Pembayaran aman dengan enkripsi TLS 1.3 dan standar PCI-DSS",
              "Konfirmasi pesanan otomatis via email setelah pembayaran berhasil",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-success font-bold mt-0.5 flex-shrink-0">✓</span>
                {item}
              </li>
            ))}
          </ul>
        </section>

        <FaqSection items={FAQ_ITEMS} heading="Pertanyaan Umum — Indonesia" />
      </div>
    </>
  );
}
