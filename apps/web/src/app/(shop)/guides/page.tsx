import { AuthorBio } from "@/components/seo/author-bio";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld";
import { FaqSection } from "@/components/seo/faq-section";
import { FreshnessLabel } from "@/components/seo/freshness-label";
import { TrustBadges } from "@/components/seo/trust-badges";
import type { Metadata } from "next";
import Link from "next/link";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://fabric.cool";

export const metadata: Metadata = {
  title: "คู่มือและวิธีใช้งาน",
  description: "คู่มือการใช้งาน Fabric — วิธีสั่งซื้อ วิธีชำระเงิน วิธีติดตามพัสดุ และคำถามที่พบบ่อย",
  alternates: { canonical: `${APP_URL}/guides` },
};

const GUIDES = [
  {
    slug: "/guides/how-to-order",
    title: "วิธีสั่งซื้อสินค้าครั้งแรก",
    description: "ขั้นตอนการเลือกสินค้า เพิ่มลงตะกร้า และชำระเงิน ตั้งแต่ต้นจนจบ",
    time: "3 นาที",
  },
  {
    slug: "/payment/promptpay",
    title: "ชำระเงินผ่าน PromptPay",
    description: "วิธีสแกน QR Code ด้วยแอปธนาคาร ยืนยันได้ใน 30 วินาที",
    time: "2 นาที",
  },
  {
    slug: "/payment/card",
    title: "ชำระเงินด้วยบัตรเครดิต/เดบิต",
    description: "รองรับ Visa, Mastercard ทุกธนาคาร ปลอดภัยด้วย 3D Secure",
    time: "3 นาที",
  },
  {
    slug: "/payment/crypto",
    title: "ชำระเงินด้วย Crypto (USDC)",
    description: "ชำระด้วย USDC บน Base network ผ่าน MetaMask หรือ Coinbase Wallet",
    time: "3 นาที",
  },
  {
    slug: "/guides/returns",
    title: "การคืนและเปลี่ยนสินค้า",
    description: "เงื่อนไข และขั้นตอนการแจ้งคืนสินค้าภายใน 7 วัน",
    time: "2 นาที",
  },
];

export default function GuidesPage() {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "หน้าแรก", href: "/" },
          { name: "คู่มือและวิธีใช้งาน", href: "/guides" },
        ]}
      />
      <nav aria-label="breadcrumb" className="mb-6 text-sm text-muted-foreground">
        <ol className="flex items-center gap-1">
          <li>
            <Link href="/" className="hover:text-muted-foreground">
              หน้าแรก
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-foreground font-medium">คู่มือและวิธีใช้งาน</li>
        </ol>
      </nav>

      <header className="mb-10">
        <h1 className="font-display text-3xl text-foreground">คู่มือและวิธีใช้งาน</h1>
        <p className="mt-2 text-muted-foreground">ทุกอย่างที่คุณต้องรู้เกี่ยวกับการซื้อสินค้าที่ Fabric</p>
      </header>

      <TrustBadges className="mb-10" />

      <ul className="space-y-4">
        {GUIDES.map((guide) => (
          <li key={guide.slug}>
            <Link
              href={guide.slug}
              className="flex items-start justify-between rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <div>
                <p className="font-semibold text-foreground">{guide.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{guide.description}</p>
              </div>
              <span className="ml-4 flex-shrink-0 text-xs text-faint">{guide.time}</span>
            </Link>
          </li>
        ))}
      </ul>

      <FaqSection
        items={[
          {
            question: "คู่มือใน Fabric มีเรื่องอะไรบ้าง?",
            answer:
              "มีตั้งแต่วิธีสั่งซื้อสินค้าครั้งแรก วิธีชำระเงินผ่าน PromptPay บัตรเครดิต/เดบิต USDC Crypto รวมถึงนโยบายการคืนและเปลี่ยนสินค้า",
          },
          {
            question: "สามารถชำระเงินด้วย Crypto ได้หรือไม่?",
            answer: "ได้ Fabric รองรับ USDC บน Base network ผ่าน MetaMask หรือ Coinbase Wallet",
          },
          {
            question: "สินค้าจัดส่งภายในกี่วัน?",
            answer: "จัดส่งภายใน 2–3 วันทำการหลังจากยืนยันการชำระเงิน",
          },
          {
            question: "คืนสินค้าได้ภายในกี่วัน?",
            answer: "สามารถแจ้งคืนหรือเปลี่ยนสินค้าได้ภายใน 7 วันหลังได้รับสินค้า",
          },
        ]}
      />

      <div className="mt-12 rounded-xl bg-muted border border-border p-6">
        <h2 className="font-semibold text-foreground">ยังหาคำตอบไม่เจอ?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          ติดต่อทีมงาน Fabric ผ่านทาง LINE OA หรืออีเมล
        </p>
        <Link
          href="/auth/register"
          className="mt-4 inline-block rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          สร้างบัญชีและเริ่มช้อป
        </Link>
      </div>

      <div className="mt-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-t border-border pt-8">
        <div>
          <h2 className="text-lg font-semibold text-foreground">คู่มือที่อัปเดตล่าสุด</h2>
          <FreshnessLabel updatedAt="2026-06-23" quarter="Q2 2026" />
        </div>
      </div>

      <AuthorBio name="Fabric Editorial" jobTitle="Content Team" updatedAt="2026-06-23" />
    </>
  );
}
