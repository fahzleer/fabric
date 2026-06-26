import { AuthorBio } from "@/components/seo/author-bio";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld";
import { FaqSection } from "@/components/seo/faq-section";
import { FreshnessLabel } from "@/components/seo/freshness-label";
import { TrustBadges } from "@/components/seo/trust-badges";
import type { Metadata } from "next";
import Link from "next/link";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://fabric.cool";
const UPDATED_AT = "2026-06-23";

export const metadata: Metadata = {
  title: "เปรียบเทียบวิธีชำระเงิน — PromptPay vs บัตร vs Crypto",
  description:
    "เปรียบเทียบ PromptPay, บัตรเครดิต และ USDC Crypto — ค่าธรรมเนียม ความเร็ว ความปลอดภัย และข้อดีข้อเสียของแต่ละวิธี",
  alternates: { canonical: `${APP_URL}/payment/compare` },
  openGraph: {
    title: "เปรียบเทียบวิธีชำระเงิน Fabric — PromptPay vs บัตร vs Crypto",
    description: "ค้นหาวิธีชำระเงินที่เหมาะกับคุณ เปรียบเทียบค่าธรรมเนียม ความเร็ว และความปลอดภัย",
    url: `${APP_URL}/payment/compare`,
    type: "article",
  },
};

const METHODS = [
  {
    id: "promptpay",
    name: "PromptPay",
    href: "/payment/promptpay",
    badge: "แนะนำสำหรับคนไทย",
    badgeColor: "bg-info-subtle text-info",
    fee: "ฟรี",
    speed: "< 30 วินาที",
    security: "ยืนยัน OTP ผ่านแอปธนาคาร",
    availability: "ทุกธนาคารไทย",
    limit: "ไม่จำกัด (ขึ้นกับธนาคาร)",
    pros: ["ไม่มีค่าธรรมเนียม", "รวดเร็วที่สุด", "ไม่ต้องกรอกข้อมูลบัตร", "รองรับทุกแบงค์ไทย"],
    cons: ["ต้องมีบัญชีธนาคารไทย", "ต้องสแกน QR ด้วยมือถือ"],
  },
  {
    id: "card",
    name: "บัตรเครดิต / เดบิต",
    href: "/payment/card",
    badge: "รองรับต่างประเทศ",
    badgeColor: "bg-gray-100 text-gray-800",
    fee: "ฟรี",
    speed: "< 1 นาที",
    security: "3D Secure + PCI-DSS Level 1",
    availability: "Visa, Mastercard ทุกธนาคารทั่วโลก",
    limit: "ตามวงเงินบัตร",
    pros: ["ใช้ได้ทั้งบัตรไทยและต่างประเทศ", "ปลอดภัยด้วย 3D Secure", "เหมาะสำหรับนักท่องเที่ยว"],
    cons: ["ต้องกรอกข้อมูลบัตร", "อาจมีค่าธรรมเนียม FX จากธนาคาร"],
  },
  {
    id: "crypto",
    name: "USDC (Crypto)",
    href: "/payment/crypto",
    badge: "Web3",
    badgeColor: "bg-info-subtle text-info",
    fee: "< $0.01 Gas",
    speed: "~2 วินาที",
    security: "Blockchain — immutable, trustless",
    availability: "Base Network — MetaMask, Coinbase Wallet",
    limit: "ไม่จำกัด",
    pros: ["ไม่ต้องผ่านธนาคาร", "ยืนยันเร็วมาก", "ค่า Gas ต่ำ (Base network)", "ไม่ต้องสมัครบัญชี"],
    cons: ["ต้องมี Crypto Wallet", "ต้องมี USDC บน Base network", "ซับซ้อนกว่าสำหรับมือใหม่"],
  },
];

const COMPARE_ROWS: { label: string; key: keyof (typeof METHODS)[0] }[] = [
  { label: "ค่าธรรมเนียม", key: "fee" },
  { label: "ความเร็ว", key: "speed" },
  { label: "ความปลอดภัย", key: "security" },
  { label: "รองรับ", key: "availability" },
  { label: "วงเงินสูงสุด", key: "limit" },
];

const FAQ_ITEMS = [
  {
    question: "วิธีไหนเร็วที่สุด?",
    answer:
      "USDC บน Base network เร็วที่สุด (~2 วินาที) ตามด้วย PromptPay (< 30 วินาที) และบัตรเครดิต (< 1 นาที) ทุกวิธียืนยันอัตโนมัติ ไม่ต้องส่งสลิป",
  },
  {
    question: "วิธีไหนปลอดภัยที่สุด?",
    answer:
      "ทุกวิธีปลอดภัยสูงทั้งหมด PromptPay ยืนยันผ่านแอปธนาคารที่คุณไว้ใจ, บัตรผ่าน 3D Secure + PCI-DSS, Crypto ผ่าน Blockchain ซึ่งไม่มีใครแก้ไขได้",
  },
  {
    question: "ใช้บัตรต่างประเทศชำระได้ไหม?",
    answer:
      "ได้ บัตรเครดิต Visa/Mastercard จากต่างประเทศชำระได้ ราคาแสดงเป็น THB ธนาคารของคุณจะแปลงสกุลเงินตามอัตราแลกเปลี่ยนวันนั้น",
  },
  {
    question: "มีวิธีใดที่มีค่าธรรมเนียมไหม?",
    answer:
      "Fabric ไม่เก็บค่าธรรมเนียมเพิ่มเติมทุกวิธี แต่บัตรเครดิตต่างประเทศอาจมีค่า FX จากธนาคารผู้ออกบัตร และ Crypto มีค่า Gas เล็กน้อย (< $0.01)",
  },
];

export default function PaymentComparePage() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "เปรียบเทียบวิธีชำระเงิน Fabric — PromptPay vs บัตรเครดิต vs USDC Crypto",
    description: metadata.description,
    url: `${APP_URL}/payment/compare`,
    publisher: { "@type": "Organization", name: "Fabric", url: APP_URL },
    dateModified: UPDATED_AT,
  };

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "หน้าแรก", href: "/" },
          { name: "สินค้า", href: "/products" },
          { name: "เปรียบเทียบวิธีชำระเงิน", href: "/payment/compare" },
        ]}
      />
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: controlled server-side JSON-LD
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
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
          <li className="text-gray-900 font-medium">เปรียบเทียบวิธีชำระเงิน</li>
        </ol>
      </nav>

      <header className="mb-10">
        <h1 className="text-3xl font-bold text-gray-900">เปรียบเทียบวิธีชำระเงิน</h1>
        <p className="mt-2 text-gray-600 max-w-xl">Fabric รองรับ 3 วิธีชำระเงิน — เลือกแบบที่เหมาะกับคุณ</p>
      </header>

      <TrustBadges className="mb-10" />

      {/* Method cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-10">
        {METHODS.map((m) => (
          <div key={m.id} className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
            <div>
              <span
                className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${m.badgeColor}`}
              >
                {m.badge}
              </span>
              <h2 className="mt-2 text-lg font-semibold text-gray-900">{m.name}</h2>
            </div>
            <ul className="space-y-1">
              {m.pros.map((p) => (
                <li key={p} className="flex items-start gap-1.5 text-sm text-gray-700">
                  <span className="text-success font-bold mt-0.5">+</span> {p}
                </li>
              ))}
              {m.cons.map((c) => (
                <li key={c} className="flex items-start gap-1.5 text-sm text-gray-500">
                  <span className="text-gray-400 font-bold mt-0.5">−</span> {c}
                </li>
              ))}
            </ul>
            <Link
              href={m.href}
              className="block w-full rounded-lg border border-gray-200 py-2 text-center text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              ดูวิธีชำระ →
            </Link>
          </div>
        ))}
      </div>

      {/* Comparison table */}
      <section aria-labelledby="table-heading" className="overflow-x-auto">
        <h2 id="table-heading" className="text-xl font-semibold text-gray-900 mb-4">
          ตารางเปรียบเทียบ
        </h2>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="py-3 pr-4 text-left font-medium text-gray-500 w-1/4" />
              {METHODS.map((m) => (
                <th key={m.id} className="py-3 px-2 text-left font-semibold text-gray-900">
                  {m.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPARE_ROWS.map((row) => (
              <tr key={row.key} className="border-b border-gray-100">
                <td className="py-3 pr-4 font-medium text-gray-500">{row.label}</td>
                {METHODS.map((m) => (
                  <td key={m.id} className="py-3 px-2 text-gray-700">
                    {String(m[row.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <FaqSection items={FAQ_ITEMS} />

      <div className="mt-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-t border-gray-200 pt-8">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">เลือกวิธีชำระเงินและช้อปเลย</h2>
          <FreshnessLabel updatedAt="2026-06-23" quarter="Q2 2026" />
        </div>
        <Link
          href="/checkout"
          className="rounded-lg bg-gray-900 px-6 py-3 text-sm font-medium text-white hover:bg-gray-700"
        >
          ไปที่หน้าชำระเงิน
        </Link>
      </div>

      <AuthorBio name="Fabric Editorial" jobTitle="Payments Team" updatedAt="2026-06-23" />
    </>
  );
}
