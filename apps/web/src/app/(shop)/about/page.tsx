import { AuthorBio } from "@/components/seo/author-bio";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld";
import { FaqSection } from "@/components/seo/faq-section";
import { FreshnessLabel } from "@/components/seo/freshness-label";
import { TrustBadges } from "@/components/seo/trust-badges";
import type { Metadata } from "next";
import Link from "next/link";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://fabric.cool";

export const metadata: Metadata = {
  title: "เกี่ยวกับ Fabric",
  description:
    "Fabric คือแพลตฟอร์มซื้อขายเสื้อผ้า premium quality ออนไลน์ — คัดสรรสินค้าคุณภาพ จัดส่งทั่วไทย ชำระได้หลายช่องทาง",
  alternates: { canonical: `${APP_URL}/about` },
  openGraph: {
    title: "เกี่ยวกับ Fabric",
    description: "แพลตฟอร์มซื้อขายเสื้อผ้า premium quality — ผ้าดี ทรงสวย ส่งทั่วไทย",
    url: `${APP_URL}/about`,
    type: "website",
  },
};

const VALUES = [
  {
    title: "คุณภาพที่จับต้องได้",
    body: "ทุกสินค้าใน Fabric ผ่านการคัดเลือกจากผู้ผลิตที่มีมาตรฐาน เน้นวัสดุธรรมชาติและเทคนิคการตัดเย็บที่ใส่ใจในทุกรายละเอียด",
  },
  {
    title: "ความโปร่งใส",
    body: "ราคาชัดเจน ไม่มีค่าใช้จ่ายซ่อนเร้น แสดงข้อมูลวัสดุ การดูแลรักษา และสต็อกจริงบนหน้าสินค้าทุกชิ้น",
  },
  {
    title: "ชำระเงินที่ยืดหยุ่น",
    body: "รองรับ PromptPay, บัตรเครดิต/เดบิต และ USDC Crypto — ไม่ว่าคุณจะอยู่ที่ไหนในโลก ก็ซื้อสินค้าได้",
  },
  {
    title: "บริการหลังการขาย",
    body: "ทีมงาน Fabric พร้อมดูแลคุณหลังการซื้อ คืนสินค้าได้ภายใน 7 วัน และติดตามพัสดุได้ตลอด 24 ชั่วโมง",
  },
];

const SCHEMA = {
  "@context": "https://schema.org",
  "@type": "AboutPage",
  url: `${APP_URL}/about`,
  name: "เกี่ยวกับ Fabric",
  description:
    "Fabric คือแพลตฟอร์มซื้อขายเสื้อผ้า premium quality ออนไลน์ ที่เน้นคุณภาพ ความโปร่งใส และประสบการณ์การช้อปปิ้งที่ดีที่สุด",
  mainEntity: {
    "@type": "Organization",
    "@id": `${APP_URL}/#organization`,
    name: "Fabric",
    url: APP_URL,
    foundingDate: "2024",
    description: "Fabric เป็นแพลตฟอร์ม marketplace เสื้อผ้า premium สำหรับตลาดไทยและเอเชียตะวันออกเฉียงใต้",
    areaServed: [
      { "@type": "Country", name: "Thailand" },
      { "@type": "Country", name: "Malaysia" },
      { "@type": "Country", name: "Indonesia" },
      { "@type": "Country", name: "Philippines" },
      { "@type": "Country", name: "Vietnam" },
      { "@type": "Country", name: "Singapore" },
    ],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "Customer Support",
      availableLanguage: ["Thai", "English"],
    },
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Premium T-Shirts",
      url: `${APP_URL}/products`,
    },
  },
};

export default function AboutPage() {
  return (
    <>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: controlled server-side JSON-LD
        dangerouslySetInnerHTML={{ __html: JSON.stringify(SCHEMA) }}
      />

      <BreadcrumbJsonLd
        items={[
          { name: "หน้าแรก", href: "/" },
          { name: "เกี่ยวกับ Fabric", href: "/about" },
        ]}
      />
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <nav aria-label="breadcrumb" className="mb-6 text-sm text-gray-500">
          <ol className="flex items-center gap-1">
            <li>
              <Link href="/" className="hover:text-gray-700">
                หน้าแรก
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="text-gray-900 font-medium">เกี่ยวกับ Fabric</li>
          </ol>
        </nav>

        <header className="mb-10">
          <h1 className="text-4xl font-bold text-gray-900">เกี่ยวกับ Fabric</h1>
          <p className="mt-4 text-lg text-gray-600 max-w-2xl">
            Fabric คือแพลตฟอร์มซื้อขายเสื้อผ้า premium quality สำหรับคนที่ใส่ใจในคุณภาพและรายละเอียด —
            ทั้งในไทยและทั่วเอเชียตะวันออกเฉียงใต้
          </p>
        </header>

        <TrustBadges className="mb-12" />

        <section aria-labelledby="mission-heading" className="mb-12">
          <h2 id="mission-heading" className="text-2xl font-semibold text-gray-900 mb-4">
            พันธกิจของเรา
          </h2>
          <p className="text-gray-600 leading-relaxed">
            เราเชื่อว่าเสื้อผ้าคุณภาพดีไม่ควรซับซ้อนหรือเข้าถึงยาก Fabric สร้างขึ้นเพื่อเชื่อมต่อ
            ผู้ผลิตที่ใส่ใจงานฝีมือกับผู้บริโภคที่รู้คุณค่า ผ่านประสบการณ์การช้อปปิ้งออนไลน์ ที่ราบรื่นและปลอดภัย
          </p>
        </section>

        <section aria-labelledby="values-heading" className="mb-12">
          <h2 id="values-heading" className="text-2xl font-semibold text-gray-900 mb-6">
            สิ่งที่เราให้ความสำคัญ
          </h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {VALUES.map((v) => (
              <div key={v.title} className="rounded-xl border border-gray-200 bg-white p-5">
                <h3 className="font-semibold text-gray-900 mb-2">{v.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{v.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="payment-heading" className="mb-12">
          <h2 id="payment-heading" className="text-2xl font-semibold text-gray-900 mb-4">
            วิธีชำระเงิน
          </h2>
          <p className="text-gray-600 mb-4">
            Fabric รองรับหลายช่องทาง เพื่อให้ลูกค้าทั้งในไทยและต่างประเทศชำระเงินได้สะดวก
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              { label: "PromptPay", href: "/payment/promptpay" },
              { label: "บัตรเครดิต / เดบิต", href: "/payment/card" },
              { label: "USDC Crypto", href: "/payment/crypto" },
            ].map((p) => (
              <Link
                key={p.href}
                href={p.href}
                className="rounded-full border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                {p.label}
              </Link>
            ))}
          </div>
        </section>

        <section aria-labelledby="coverage-heading" className="mb-12">
          <h2 id="coverage-heading" className="text-2xl font-semibold text-gray-900 mb-4">
            พื้นที่ให้บริการ
          </h2>
          <p className="text-gray-600 mb-3">จัดส่งทั่วไทย และรองรับลูกค้าจากประเทศในเอเชียตะวันออกเฉียงใต้</p>
          <div className="flex flex-wrap gap-2">
            {["ไทย 🇹🇭", "มาเลเซีย 🇲🇾", "อินโดนีเซีย 🇮🇩", "ฟิลิปปินส์ 🇵🇭", "เวียดนาม 🇻🇳", "สิงคโปร์ 🇸🇬"].map(
              (c) => (
                <span key={c} className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700">
                  {c}
                </span>
              )
            )}
          </div>
        </section>

        <FaqSection
          items={[
            {
              question: "Fabric ให้บริการในประเทศใดบ้าง?",
              answer: "Fabric ให้บริการในประเทศไทย มาเลเซีย อินโดนีเซีย ฟิลิปปินส์ เวียดนาม และสิงคโปร์",
            },
            {
              question: "สินค้าของ Fabric มีคุณภาพอย่างไร?",
              answer:
                "ทุกสินค้าผ่านการคัดเลือกจากผู้ผลิตที่มีมาตรฐาน เน้นวัสดุธรรมชาติและเทคนิคการตัดเย็บที่ใส่ใจในทุกรายละเอียด",
            },
            {
              question: "ชำระเงินด้วยวิธีใดได้บ้าง?",
              answer: "รองรับ PromptPay, บัตรเครดิต/เดบิต และ USDC Crypto บน Base network",
            },
            {
              question: "จัดส่งสินค้าภายในกี่วัน?",
              answer: "จัดส่งภายใน 2–3 วันทำการหลังจากยืนยันการชำระเงิน",
            },
          ]}
        />

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-t border-gray-200 pt-8">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">พร้อมเริ่มช้อปหรือยัง?</h2>
            <FreshnessLabel updatedAt="2026-06-23" quarter="Q2 2026" />
          </div>
          <Link
            href="/auth/register"
            className="rounded-lg bg-gray-900 px-6 py-3 text-sm font-medium text-white hover:bg-gray-700"
          >
            สร้างบัญชีและเริ่มช้อป
          </Link>
        </div>

        <AuthorBio name="Fabric Editorial" jobTitle="Content Team" updatedAt="2026-06-23" />
      </div>
    </>
  );
}
