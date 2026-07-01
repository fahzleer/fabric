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
  title: "ชำระเงินผ่าน PromptPay",
  description:
    "วิธีชำระเงินค่าสินค้า Fabric ผ่าน PromptPay — สแกน QR ได้ทันที รองรับทุกธนาคาร และแอปพลิเคชันที่รองรับ PromptPay",
  alternates: { canonical: `${APP_URL}/payment/promptpay` },
  openGraph: {
    title: "ชำระเงินผ่าน PromptPay — Fabric",
    description: "สแกน QR จ่ายเงินได้ทันที ไม่ต้องใส่เลขบัตร ปลอดภัย สะดวก รวดเร็ว",
    url: `${APP_URL}/payment/promptpay`,
    type: "article",
  },
};

const STEPS = [
  { name: "เพิ่มสินค้าลงตะกร้า", text: "เลือกสินค้าที่ต้องการ เลือกไซส์ แล้วกดปุ่ม Add to Cart" },
  { name: "ไปที่หน้า Checkout", text: "กดปุ่ม Checkout และกรอกที่อยู่จัดส่ง" },
  { name: "เลือก PromptPay", text: "เลือกวิธีชำระเงิน PromptPay จากตัวเลือกการชำระเงิน" },
  {
    name: "สแกน QR Code",
    text: "เปิดแอปธนาคารของคุณ สแกน QR Code ที่แสดงบนหน้าจอ ยืนยันจำนวนเงิน และกดชำระ",
  },
  {
    name: "รอยืนยันการชำระเงิน",
    text: "ระบบจะยืนยันการชำระเงินอัตโนมัติภายใน 30 วินาที และแสดงหน้ายืนยันคำสั่งซื้อ",
  },
];

const FAQ_ITEMS = [
  {
    question: "PromptPay รองรับธนาคารอะไรบ้าง?",
    answer:
      "รองรับทุกธนาคารในไทยที่รองรับ PromptPay ได้แก่ กสิกรไทย, กรุงไทย, กรุงเทพ, ไทยพาณิชย์, ทหารไทยธนชาต, กรุงศรี และอื่นๆ",
  },
  {
    question: "QR Code หมดอายุเมื่อไหร่?",
    answer:
      "QR Code มีอายุ 15 นาที หากไม่ชำระภายในเวลาดังกล่าว ระบบจะยกเลิก QR อัตโนมัติ สามารถสร้าง QR ใหม่ได้โดยกลับมาที่หน้า Checkout",
  },
  {
    question: "ชำระแล้วแต่ระบบยังไม่ยืนยัน ทำอย่างไร?",
    answer:
      "รอสักครู่ประมาณ 1–2 นาที ระบบจะยืนยันอัตโนมัติ หากเกิน 5 นาทีแล้วยังไม่ยืนยัน กรุณาติดต่อทีมงานพร้อมแสดงสลิปการชำระเงิน",
  },
  {
    question: "มีค่าธรรมเนียมการชำระผ่าน PromptPay ไหม?",
    answer: "ไม่มีค่าธรรมเนียมเพิ่มเติม ชำระเต็มจำนวนตามราคาสินค้า",
  },
  {
    question: "ปลอดภัยไหมที่จะสแกน QR จากเว็บไซต์?",
    answer:
      "ปลอดภัยอย่างสูง QR Code ของ Fabric ผ่านระบบ Omise ซึ่งได้รับการรับรองมาตรฐาน PCI-DSS ข้อมูลการชำระเงินถูกเข้ารหัสทุกขั้นตอน",
  },
];

export default function PromptPayPage() {
  const howToSchema = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "วิธีชำระเงินผ่าน PromptPay บน Fabric",
    dateModified: UPDATED_AT,
    description: "ขั้นตอนการชำระเงินค่าสินค้า Fabric ผ่าน PromptPay QR Code อย่างง่ายดายและปลอดภัย",
    totalTime: "PT2M",
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
          { name: "ชำระผ่าน PromptPay", href: "/payment/promptpay" },
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
          <li className="text-foreground font-medium">ชำระผ่าน PromptPay</li>
        </ol>
      </nav>

      <header className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-info-subtle text-info font-bold text-lg">
            QR
          </span>
          <h1 className="text-3xl font-bold text-foreground">ชำระเงินผ่าน PromptPay</h1>
        </div>
        <FreshnessLabel updatedAt={UPDATED_AT} quarter={QUARTER} />
        <p className="mt-3 text-muted-foreground max-w-xl">
          สะดวก รวดเร็ว ปลอดภัย — สแกน QR ด้วยแอปธนาคารที่คุณใช้อยู่ ไม่ต้องใส่เลขบัตรหรือรหัสใดๆ
        </p>
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

      <div className="mt-8 p-4 rounded-lg bg-info-subtle border border-info">
        <p className="text-sm text-info font-medium">
          ระบบยืนยันการชำระเงินอัตโนมัติ — ไม่ต้องส่งสลิปให้ร้านค้า
        </p>
      </div>

      <FaqSection items={FAQ_ITEMS} />

      <AuthorBio name="ทีมงาน Fabric" jobTitle="ฝ่ายบริการลูกค้า" updatedAt={UPDATED_AT} />

      <div className="mt-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-t border-border pt-8">
        <div>
          <h2 className="text-lg font-semibold text-foreground">พร้อมใช้ PromptPay ชำระเงิน?</h2>
          <p className="text-sm text-muted-foreground">สมัครบัญชีฟรี แล้วเริ่มช้อปด้วย QR Code</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/auth/register"
            className="rounded-lg bg-info px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-info/90"
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
