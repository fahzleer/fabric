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
  title: "ชำระเงินด้วยบัตรเครดิต",
  description:
    "วิธีชำระเงินค่าสินค้า Fabric ด้วยบัตรเครดิต/เดบิต Visa, Mastercard — ปลอดภัย รองรับ 3D Secure ทุกธนาคาร",
  alternates: { canonical: `${APP_URL}/payment/card` },
  openGraph: {
    title: "ชำระเงินด้วยบัตรเครดิต — Fabric",
    description: "รองรับ Visa, Mastercard ทุกธนาคาร ปลอดภัยด้วย 3D Secure และมาตรฐาน PCI-DSS",
    url: `${APP_URL}/payment/card`,
    type: "article",
  },
};

const STEPS = [
  { name: "เพิ่มสินค้าลงตะกร้า", text: "เลือกสินค้าและไซส์ที่ต้องการ กดปุ่ม Add to Cart" },
  {
    name: "ไปที่หน้า Checkout",
    text: "กดปุ่ม Checkout กรอกที่อยู่จัดส่ง แล้วเลือก 'บัตรเครดิต / เดบิต'",
  },
  {
    name: "กรอกข้อมูลบัตร",
    text: "กรอกหมายเลขบัตร 16 หลัก, วันหมดอายุ (MM/YY) และ CVV 3 หลักหลังบัตร",
  },
  {
    name: "ยืนยันด้วย 3D Secure",
    text: "ธนาคารจะส่ง OTP มาที่มือถือของคุณ กรอก OTP เพื่อยืนยันการชำระเงิน",
  },
  {
    name: "รับการยืนยัน",
    text: "หลังผ่าน 3D Secure ระบบจะยืนยันคำสั่งซื้อทันทีและแสดงหมายเลข Order",
  },
];

const FAQ_ITEMS = [
  {
    question: "รองรับบัตรประเภทใดบ้าง?",
    answer: "รองรับบัตรเครดิตและบัตรเดบิต Visa, Mastercard จากทุกธนาคาร ทั้งบัตรไทยและต่างประเทศ",
  },
  {
    question: "ข้อมูลบัตรของฉันปลอดภัยไหม?",
    answer:
      "ปลอดภัยอย่างสูง Fabric ใช้ระบบ Omise ซึ่งได้รับการรับรองมาตรฐาน PCI-DSS Level 1 ข้อมูลบัตรไม่ถูกเก็บไว้บนเซิร์ฟเวอร์ของ Fabric เลย",
  },
  {
    question: "ถ้าชำระเงินไม่สำเร็จ ต้องทำอย่างไร?",
    answer:
      "ตรวจสอบว่าบัตรมีวงเงินเพียงพอ และข้อมูลบัตรถูกต้อง หากยังไม่สำเร็จลองใช้บัตรใบอื่น หรือเปลี่ยนมาชำระผ่าน PromptPay",
  },
  {
    question: "มีค่าธรรมเนียมบัตรไหม?",
    answer: "ไม่มีค่าธรรมเนียมเพิ่มเติม ชำระเต็มจำนวนตามราคาสินค้า",
  },
  {
    question: "ใช้บัตรต่างประเทศชำระได้ไหม?",
    answer:
      "ได้ รองรับบัตร Visa และ Mastercard ที่ออกในต่างประเทศ ราคาจะถูกแสดงเป็น THB และธนาคารของคุณจะทำการแปลงสกุลเงินเอง",
  },
];

export default function CardPaymentPage() {
  const howToSchema = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    dateModified: UPDATED_AT,
    name: "วิธีชำระเงินด้วยบัตรเครดิต/เดบิต บน Fabric",
    description: "ขั้นตอนการชำระเงินค่าสินค้า Fabric ด้วยบัตรเครดิตหรือเดบิต อย่างปลอดภัยผ่านระบบ Omise",
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
          { name: "ชำระด้วยบัตรเครดิต", href: "/payment/card" },
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
            <Link href="/products" className="hover:text-muted-foreground">
              สินค้า
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-foreground font-medium">ชำระด้วยบัตรเครดิต</li>
        </ol>
      </nav>

      <header className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-secondary text-muted-foreground font-bold text-lg">
            💳
          </span>
          <h1 className="font-display text-3xl text-foreground">ชำระด้วยบัตรเครดิต / เดบิต</h1>
        </div>
        <FreshnessLabel updatedAt={UPDATED_AT} quarter={QUARTER} />
        <p className="mt-3 text-muted-foreground max-w-xl">
          รองรับ Visa, Mastercard ทุกธนาคาร ปลอดภัยด้วย 3D Secure และมาตรฐาน PCI-DSS Level 1
        </p>
        <div className="mt-3 flex items-center gap-3">
          <img src="/icons/visa.svg" alt="Visa" className="h-6 opacity-70" />
          <img src="/icons/mastercard.svg" alt="Mastercard" className="h-6 opacity-70" />
        </div>
      </header>

      <TrustBadges className="mb-8" />

      <section aria-labelledby="steps-heading">
        <h2 id="steps-heading" className="text-xl font-semibold text-foreground mb-6">
          ขั้นตอนการชำระเงิน
        </h2>
        <ol className="space-y-5">
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

      <div className="mt-8 p-4 rounded-lg bg-success-subtle border border-success">
        <p className="text-sm text-success font-medium">
          ข้อมูลบัตรถูกเข้ารหัสด้วย TLS 1.3 — Fabric ไม่เก็บข้อมูลบัตรของคุณ
        </p>
      </div>

      <FaqSection items={FAQ_ITEMS} />

      <AuthorBio name="ทีมงาน Fabric" jobTitle="ฝ่ายบริการลูกค้า" updatedAt={UPDATED_AT} />

      <div className="mt-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-t border-border pt-8">
        <div>
          <h2 className="text-lg font-semibold text-foreground">พร้อมใช้บัตรเครดิตชำระเงิน?</h2>
          <p className="text-sm text-muted-foreground">สมัครบัญชีฟรี แล้วช้อปด้วย Visa / Mastercard</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/auth/register"
            className="rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            สมัครบัญชีและชำระเงิน
          </Link>
          <Link
            href="/checkout"
            className="rounded-lg border border-border-strong px-6 py-3 text-sm font-medium text-muted-foreground hover:bg-muted"
          >
            ไปหน้าชำระเงิน →
          </Link>
        </div>
      </div>
    </>
  );
}
