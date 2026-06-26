import { AuthorBio } from "@/components/seo/author-bio";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld";
import { FaqSection } from "@/components/seo/faq-section";
import { FreshnessLabel } from "@/components/seo/freshness-label";
import { TrustBadges } from "@/components/seo/trust-badges";
import type { Metadata } from "next";
import Link from "next/link";

const UPDATED_AT = "2026-06-23";
const QUARTER = "Q2 2026";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://fabric.cool";

export const metadata: Metadata = {
  title: "ชำระเงินด้วย Crypto (USDC)",
  description:
    "ชำระค่าสินค้า Fabric ด้วย USDC บน Base network — ไม่ต้องมีบัญชีธนาคาร รองรับ MetaMask, Coinbase Wallet และ WalletConnect",
  alternates: { canonical: `${APP_URL}/payment/crypto` },
  openGraph: {
    title: "ชำระเงินด้วย Crypto (USDC) — Fabric",
    description: "ซื้อเสื้อด้วย USDC บน Base network — รวดเร็ว ปลอดภัย ไม่มีค่าธรรมเนียมสูง",
    url: `${APP_URL}/payment/crypto`,
    type: "article",
  },
};

const STEPS = [
  {
    name: "เชื่อมต่อ Wallet",
    text: "กดปุ่ม Connect Wallet บนหน้า Checkout รองรับ MetaMask, Coinbase Wallet และ WalletConnect",
  },
  {
    name: "สลับไปที่ Base Network",
    text: "ระบบจะขอให้สลับ network ไปที่ Base (หรือ Base Sepolia สำหรับ testnet) อนุมัติการสลับใน Wallet",
  },
  {
    name: "ตรวจสอบยอดและลงนาม",
    text: "ระบบจะแสดงยอด USDC ที่ต้องชำระ (แปลงจาก THB) กด Sign เพื่อลงนาม EIP-3009 Transfer Authorization",
  },
  {
    name: "รอยืนยัน Transaction",
    text: "Transaction จะถูก submit บน Base network ซึ่งยืนยันภายใน 2 วินาที",
  },
  {
    name: "รับการยืนยันคำสั่งซื้อ",
    text: "เมื่อ Transaction ยืนยันแล้ว ระบบจะสร้าง Order อัตโนมัติและแสดงหมายเลข Order",
  },
];

const FAQ_ITEMS = [
  {
    question: "ต้องใช้ Wallet อะไร?",
    answer:
      "รองรับ MetaMask, Coinbase Wallet และ Wallet อื่นๆ ที่รองรับ WalletConnect โดยต้องมี USDC บน Base network",
  },
  {
    question: "ค่าธรรมเนียม Gas Fee เป็นเท่าไหร่?",
    answer:
      "Base network มีค่า Gas Fee ต่ำมาก โดยเฉลี่ยไม่ถึง $0.01 ต่อ transaction และ Fabric ใช้ EIP-3009 ซึ่งช่วยลด Gas อีก",
  },
  {
    question: "อัตราแลกเปลี่ยน THB/USDC คำนวณอย่างไร?",
    answer: "ระบบดึงอัตราแลกเปลี่ยน THB/USDC realtime จาก oracle และแสดงยอดที่ต้องชำระก่อนลงนาม",
  },
  {
    question: "ถ้า Transaction ล้มเหลวจะเกิดอะไร?",
    answer: "หาก Transaction ล้มเหลว USDC จะไม่ถูกหัก และ Order จะไม่ถูกสร้าง สามารถลองชำระใหม่ได้",
  },
  {
    question: "ใช้ Crypto network ไหนได้บ้าง?",
    answer:
      "รองรับเฉพาะ Base network (Mainnet) เท่านั้น ห้ามส่ง USDC จาก Ethereum Mainnet, Polygon หรือ chain อื่นโดยตรง",
  },
];

export default function CryptoPaymentPage() {
  const howToSchema = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    dateModified: UPDATED_AT,
    name: "วิธีชำระเงินด้วย USDC (Crypto) บน Fabric",
    description: "ขั้นตอนการชำระเงินค่าสินค้า Fabric ด้วย USDC บน Base network ผ่าน Web3 Wallet",
    totalTime: "PT3M",
    step: STEPS.map((s, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: s.name,
      text: s.text,
    })),
  };

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "หน้าแรก", href: "/" },
          { name: "สินค้า", href: "/products" },
          { name: "ชำระด้วย Crypto", href: "/payment/crypto" },
        ]}
      />
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: controlled server-side JSON-LD
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToSchema) }}
      />

      <nav aria-label="breadcrumb" className="mb-6 text-sm text-gray-500">
        <ol className="flex items-center gap-1">
          <li>
            <Link href="/" className="hover:text-gray-700">
              หน้าแรก
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href="/products" className="hover:text-gray-700">
              สินค้า
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-gray-900 font-medium">ชำระด้วย Crypto</li>
        </ol>
      </nav>

      <header className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-info-subtle text-info font-bold text-sm">
            USDC
          </span>
          <h1 className="text-3xl font-bold text-gray-900">ชำระด้วย Crypto (USDC)</h1>
        </div>
        <FreshnessLabel updatedAt={UPDATED_AT} quarter={QUARTER} />
        <p className="mt-3 text-gray-600 max-w-xl">
          ชำระด้วย USDC บน Base network — ยืนยันใน 2 วินาที ค่า Gas ต่ำ ไม่ต้องผ่านธนาคาร
        </p>
        <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-info-subtle px-3 py-1">
          <span className="text-xs font-medium text-info">Base Network</span>
          <span className="text-xs text-info">EIP-3009 x402</span>
        </div>
      </header>

      <TrustBadges className="mb-8" />

      <section aria-labelledby="steps-heading">
        <h2 id="steps-heading" className="text-xl font-semibold text-gray-900 mb-6">
          ขั้นตอนการชำระเงิน
        </h2>
        <ol className="space-y-5">
          {STEPS.map((step, i) => (
            <li key={step.name} className="flex gap-4">
              <span className="flex-shrink-0 w-8 h-8 rounded-full bg-info text-white flex items-center justify-center text-sm font-semibold">
                {i + 1}
              </span>
              <div>
                <p className="font-medium text-gray-900">{step.name}</p>
                <p className="mt-0.5 text-sm text-gray-600">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <div className="mt-8 p-4 rounded-lg bg-info-subtle border border-info">
        <p className="text-sm text-info font-medium">
          ใช้ EIP-3009 Transfer Authorization — ไม่ต้อง approve แยก ลงนามครั้งเดียวจบ
        </p>
      </div>

      <FaqSection items={FAQ_ITEMS} />

      <AuthorBio name="ทีมงาน Fabric" jobTitle="ฝ่ายเทคนิค" updatedAt={UPDATED_AT} />

      <div className="mt-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-t border-gray-200 pt-8">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">พร้อมใช้ USDC ชำระเงิน?</h2>
          <p className="text-sm text-gray-500">สมัครบัญชีฟรี แล้วช้อปด้วย Crypto Wallet</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/auth/register"
            className="rounded-lg bg-info px-6 py-3 text-sm font-medium text-white hover:bg-info/90"
          >
            สมัครบัญชีและชำระเงิน
          </Link>
          <Link
            href="/checkout"
            className="rounded-lg border border-gray-300 px-6 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            ไปหน้าชำระเงิน →
          </Link>
        </div>
      </div>
    </>
  );
}
