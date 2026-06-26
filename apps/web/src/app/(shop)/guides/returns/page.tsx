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
  title: "นโยบายคืนและเปลี่ยนสินค้า",
  description:
    "เงื่อนไขและขั้นตอนการคืนหรือเปลี่ยนสินค้า Fabric ภายใน 7 วันหลังได้รับสินค้า — สินค้าชำรุดหรือไม่ตรงตามที่สั่ง",
  alternates: { canonical: `${APP_URL}/guides/returns` },
  openGraph: {
    title: "นโยบายคืนและเปลี่ยนสินค้า — Fabric",
    description: "คืน/เปลี่ยนสินค้าได้ภายใน 7 วัน กรณีสินค้าชำรุดหรือไม่ตรงตามที่สั่ง",
    url: `${APP_URL}/guides/returns`,
    type: "article",
  },
};

const CONDITIONS = [
  "สินค้ามีความชำรุดบกพร่องจากการผลิต",
  "สินค้าไม่ตรงกับที่สั่ง (ไซส์ผิด, สีผิด)",
  "สินค้าได้รับความเสียหายระหว่างการจัดส่ง",
  "สินค้ายังไม่ผ่านการใช้งาน อยู่ในสภาพเดิม มีแท็กครบ",
];

const STEPS = [
  {
    name: "แจ้งขอคืนสินค้า",
    text: "ติดต่อทีมงาน Fabric ภายใน 7 วันหลังได้รับสินค้า พร้อมแนบรูปภาพสินค้าและหมายเลข Order",
  },
  {
    name: "ทีมงานตรวจสอบและอนุมัติ",
    text: "ทีมงานจะตรวจสอบและตอบกลับภายใน 1 วันทำการ พร้อมแจ้งขั้นตอนถัดไป",
  },
  {
    name: "ส่งสินค้าคืน",
    text: "แพ็คสินค้าในบรรจุภัณฑ์เดิมหรือบรรจุภัณฑ์ที่ปลอดภัย ส่งไปยังที่อยู่ที่ทีมงานแจ้ง",
  },
  {
    name: "รับสินค้าใหม่หรือเงินคืน",
    text: "หลังได้รับสินค้าคืน ทีมงานจะจัดส่งสินค้าใหม่หรือคืนเงินภายใน 3–5 วันทำการ",
  },
];

const FAQ_ITEMS = [
  {
    question: "คืนสินค้าได้ภายในกี่วัน?",
    answer: "ภายใน 7 วันหลังจากวันที่ได้รับสินค้า กรุณาตรวจสอบสินค้าทันทีที่ได้รับและแจ้งหากพบปัญหา",
  },
  {
    question: "คืนสินค้าเพราะเปลี่ยนใจได้ไหม?",
    answer: "ขออภัย ขณะนี้รับคืนเฉพาะกรณีสินค้าชำรุดหรือไม่ตรงตามที่สั่งเท่านั้น ไม่รับคืนกรณีเปลี่ยนใจ",
  },
  {
    question: "ใครเป็นคนออกค่าจัดส่งคืน?",
    answer:
      "หากเป็นความผิดพลาดจาก Fabric หรือร้านค้า ทาง Fabric จะออกค่าจัดส่งให้ หากเป็นการคืนเพราะเหตุอื่น ลูกค้าออกค่าจัดส่งเอง",
  },
  {
    question: "เงินคืนใช้เวลากี่วัน?",
    answer: "หลังได้รับสินค้าคืนและตรวจสอบแล้ว เงินจะถูกคืนภายใน 3–5 วันทำการ ผ่านช่องทางเดิมที่ชำระ",
  },
];

export default function ReturnsPage() {
  const howToSchema = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    dateModified: UPDATED_AT,
    name: "ขั้นตอนการคืนและเปลี่ยนสินค้า Fabric",
    description: "วิธีการแจ้งคืนหรือเปลี่ยนสินค้า Fabric ภายใน 7 วัน",
    totalTime: "PT10M",
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
          { name: "คืน / เปลี่ยนสินค้า", href: "/guides/returns" },
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
            <Link href="/guides" className="hover:text-gray-700">
              คู่มือ
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-gray-900 font-medium">คืน / เปลี่ยนสินค้า</li>
        </ol>
      </nav>

      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">นโยบายคืนและเปลี่ยนสินค้า</h1>
        <FreshnessLabel updatedAt={UPDATED_AT} quarter={QUARTER} />
        <p className="mt-3 text-gray-600 max-w-xl">
          เราดูแลทุกการซื้อขาย — หากสินค้าไม่เป็นไปตามที่คาดหวัง แจ้งเราได้ภายใน 7 วัน
        </p>
      </header>

      <section aria-labelledby="conditions-heading" className="mb-8">
        <h2 id="conditions-heading" className="text-lg font-semibold text-gray-900 mb-4">
          เงื่อนไขการรับคืน
        </h2>
        <ul className="space-y-2">
          {CONDITIONS.map((c) => (
            <li key={c} className="flex items-start gap-2 text-sm text-gray-700">
              <span className="mt-0.5 flex-shrink-0 text-success font-bold">✓</span>
              {c}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="process-heading">
        <h2 id="process-heading" className="text-xl font-semibold text-gray-900 mb-6">
          ขั้นตอนการแจ้งคืนสินค้า
        </h2>
        <ol className="space-y-5">
          {STEPS.map((step, i) => (
            <li key={step.name} className="flex gap-4">
              <span className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-900 text-white flex items-center justify-center text-sm font-semibold">
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

      <FaqSection items={FAQ_ITEMS} />

      <AuthorBio name="ทีมงาน Fabric" jobTitle="ฝ่ายบริการลูกค้า" updatedAt={UPDATED_AT} />

      <div className="mt-10 flex gap-3">
        <Link
          href="/products"
          className="rounded-lg bg-gray-900 px-6 py-3 text-sm font-medium text-white hover:bg-gray-700"
        >
          กลับไปเลือกสินค้า
        </Link>
        <Link
          href="/guides"
          className="rounded-lg border border-gray-300 px-6 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          คู่มืออื่นๆ
        </Link>
      </div>
    </>
  );
}
