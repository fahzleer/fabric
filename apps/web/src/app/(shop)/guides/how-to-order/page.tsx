import { AuthorBio } from "@/components/seo/author-bio";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld";
import { FaqSection } from "@/components/seo/faq-section";
import { FreshnessLabel } from "@/components/seo/freshness-label";
import type { Metadata } from "next";
import Link from "next/link";

const UPDATED_AT = "2026-06-23";
const QUARTER = "Q2 2026";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://fabric.cool";

export const metadata: Metadata = {
  title: "วิธีสั่งซื้อสินค้าจาก Fabric",
  description:
    "คู่มือการสั่งซื้อสินค้า Fabric ครั้งแรก — เลือกสินค้า เพิ่มลงตะกร้า ชำระเงิน ไปจนถึงรับสินค้า อธิบายทุกขั้นตอน",
  alternates: { canonical: `${APP_URL}/guides/how-to-order` },
  openGraph: {
    title: "วิธีสั่งซื้อสินค้าจาก Fabric — คู่มือฉบับสมบูรณ์",
    description: "ขั้นตอนการซื้อสินค้าออนไลน์ที่ Fabric ตั้งแต่เลือกสินค้าจนถึงรับพัสดุ",
    url: `${APP_URL}/guides/how-to-order`,
    type: "article",
  },
};

const STEPS = [
  {
    name: "เลือกสินค้าที่ต้องการ",
    text: "เข้าไปที่หน้า 'สินค้า' เลือกรายการที่สนใจ คลิกเพื่อดูรายละเอียด ขนาด วัสดุ และรูปภาพสินค้า",
  },
  {
    name: "เลือกไซส์และเพิ่มลงตะกร้า",
    text: "เลือกไซส์ที่ต้องการจากตัวเลือกที่มีในสต็อก กดปุ่ม 'Add to Cart' — สินค้าจะถูกบันทึกไว้แม้ปิดเบราว์เซอร์",
  },
  {
    name: "ตรวจสอบตะกร้าสินค้า",
    text: "คลิกไอคอนตะกร้าเพื่อตรวจสอบสินค้า ปรับจำนวน หรือลบรายการที่ไม่ต้องการ",
  },
  {
    name: "กรอกที่อยู่จัดส่ง",
    text: "กรอกชื่อผู้รับ ที่อยู่ เบอร์โทร และรหัสไปรษณีย์ ระบบจะจำที่อยู่สำหรับครั้งถัดไป",
  },
  {
    name: "เลือกวิธีชำระเงิน",
    text: "เลือกจาก PromptPay (สแกน QR), บัตรเครดิต/เดบิต หรือ USDC Crypto กดยืนยันและชำระ",
  },
  {
    name: "รับการยืนยันและรอสินค้า",
    text: "หลังชำระสำเร็จ ระบบจะส่งการยืนยันคำสั่งซื้อ สินค้าจะจัดส่งภายใน 2–3 วันทำการ",
  },
];

const FAQ_ITEMS = [
  {
    question: "ต้องสร้างบัญชีก่อนสั่งซื้อไหม?",
    answer: "ต้องสร้างบัญชีเพื่อติดตามคำสั่งซื้อและประวัติการสั่ง สมัครได้ง่ายๆ ด้วย Google, Facebook หรืออีเมล",
  },
  {
    question: "สามารถซื้อหลายชิ้นในคำสั่งซื้อเดียวได้ไหม?",
    answer: "ได้ เพิ่มสินค้าหลายรายการลงตะกร้าได้เลย ระบบจะรวมค่าจัดส่งให้อัตโนมัติ",
  },
  {
    question: "ของหมดแล้วทำอย่างไร?",
    answer: "หากไซส์หรือสินค้าที่ต้องการหมด ปุ่มจะแสดงว่า Out of Stock สามารถติดต่อร้านค้าเพื่อสอบถามสต็อกเพิ่มเติม",
  },
  {
    question: "มีบริการ Gift Wrapping ไหม?",
    answer:
      "ขณะนี้ยังไม่มีบริการ Gift Wrapping โดยตรง แต่สามารถระบุในหมายเหตุคำสั่งซื้อ ทีมงานจะพยายามจัดให้ตามที่ขอ",
  },
];

export default function HowToOrderPage() {
  const howToSchema = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    dateModified: UPDATED_AT,
    name: "วิธีสั่งซื้อสินค้าจาก Fabric",
    description: "คู่มือการสั่งซื้อสินค้า Fabric ออนไลน์ ตั้งแต่เลือกสินค้าจนถึงรับพัสดุ",
    totalTime: "PT5M",
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
          { name: "คู่มือ", href: "/guides" },
          { name: "วิธีสั่งซื้อ", href: "/guides/how-to-order" },
        ]}
      />
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: controlled server-side JSON-LD
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToSchema) }}
      />

      <nav aria-label="breadcrumb" className="mb-6 text-sm text-muted-foreground">
        <ol className="flex items-center gap-1">
          <li>
            <Link href="/" className="hover:text-muted-foreground">
              หน้าแรก
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href="/guides" className="hover:text-muted-foreground">
              คู่มือ
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-foreground font-medium">วิธีสั่งซื้อ</li>
        </ol>
      </nav>

      <header className="mb-8">
        <h1 className="font-display text-3xl text-foreground">วิธีสั่งซื้อสินค้าจาก Fabric</h1>
        <FreshnessLabel updatedAt={UPDATED_AT} quarter={QUARTER} />
        <p className="mt-3 text-muted-foreground max-w-xl">
          ครั้งแรกก็ง่าย — ทำตาม 6 ขั้นตอนนี้ สั่งสินค้าได้ใน 5 นาที
        </p>
      </header>

      <section aria-labelledby="steps-heading">
        <h2 id="steps-heading" className="text-xl font-semibold text-foreground mb-6">
          ขั้นตอนการสั่งซื้อ
        </h2>
        <ol className="space-y-6">
          {STEPS.map((step, i) => (
            <li key={step.name} className="flex gap-4">
              <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                {i + 1}
              </span>
              <div>
                <p className="font-medium text-foreground">{step.name}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <div className="mt-8 rounded-xl bg-muted border border-border p-5 space-y-2">
        <p className="text-sm font-semibold text-foreground">ชำระเงินได้ 3 วิธี</p>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/payment/promptpay"
            className="rounded-full bg-info-subtle px-3 py-1 text-xs font-medium text-info hover:bg-info/90"
          >
            PromptPay QR
          </Link>
          <Link
            href="/payment/card"
            className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-foreground hover:bg-secondary"
          >
            บัตรเครดิต / เดบิต
          </Link>
          <Link
            href="/payment/crypto"
            className="rounded-full bg-info-subtle px-3 py-1 text-xs font-medium text-info hover:bg-info/90"
          >
            USDC Crypto
          </Link>
        </div>
      </div>

      <FaqSection items={FAQ_ITEMS} />

      <AuthorBio name="ทีมงาน Fabric" jobTitle="ฝ่ายบริการลูกค้า" updatedAt={UPDATED_AT} />

      <div className="mt-10">
        <Link
          href="/products"
          className="rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          เริ่มเลือกสินค้า
        </Link>
      </div>
    </>
  );
}
