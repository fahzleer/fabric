import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld";
import { FaqSection } from "@/components/seo/faq-section";
import { TrustBadges } from "@/components/seo/trust-badges";
import type { Metadata } from "next";
import Link from "next/link";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://fabric.cool";

export const metadata: Metadata = {
  title: "Áo Thun Premium Chất Lượng Cao — Giao Hàng Việt Nam | Fabric",
  description:
    "Mua áo thun premium từ Fabric — giao hàng quốc tế đến Việt Nam, thanh toán bằng thẻ Visa, Mastercard hoặc USDC crypto. Đổi trả trong 7 ngày.",
  alternates: {
    canonical: `${APP_URL}/vi`,
    languages: { vi: `${APP_URL}/vi`, "x-default": `${APP_URL}/products` },
  },
  openGraph: {
    title: "Áo Thun Premium — Giao Hàng Việt Nam | Fabric",
    description: "Áo thun chất lượng cao giao đến Việt Nam. Thanh toán bằng thẻ quốc tế hoặc USDC.",
    url: `${APP_URL}/vi`,
    locale: "vi_VN",
    type: "website",
  },
};

const FAQ_ITEMS = [
  {
    question: "Fabric có giao hàng đến Việt Nam không?",
    answer:
      "Có, Fabric giao hàng quốc tế đến toàn Việt Nam qua các đơn vị vận chuyển uy tín với theo dõi đơn hàng đầy đủ. Thời gian giao hàng ước tính 7–14 ngày làm việc.",
  },
  {
    question: "Tôi có thể thanh toán bằng thẻ Việt Nam không?",
    answer:
      "Có, chúng tôi chấp nhận thẻ Visa và Mastercard từ mọi ngân hàng Việt Nam như Vietcombank, Techcombank, BIDV, VPBank và các ngân hàng khác.",
  },
  {
    question: "Có thể thanh toán bằng MoMo hoặc ZaloPay không?",
    answer:
      "Hiện tại chúng tôi hỗ trợ thẻ tín dụng/ghi nợ Visa, Mastercard và USDC crypto trên Base network. Hỗ trợ ví điện tử Việt Nam đang trong kế hoạch phát triển.",
  },
  {
    question: "Giá hiển thị bằng đồng tiền nào?",
    answer:
      "Giá được hiển thị bằng THB (Baht Thái). Ngân hàng của bạn sẽ quy đổi sang VND theo tỷ giá hiện hành tại thời điểm thanh toán.",
  },
  {
    question: "Chính sách đổi trả hàng như thế nào?",
    answer:
      "Chúng tôi chấp nhận đổi trả trong 7 ngày đối với hàng hóa bị lỗi hoặc giao sai. Vui lòng liên hệ với chúng tôi kèm theo mã đơn hàng và ảnh sản phẩm.",
  },
];

const SCHEMA = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  url: `${APP_URL}/vi`,
  name: "Áo Thun Premium Chất Lượng Cao — Giao Hàng Việt Nam | Fabric",
  description: metadata.description,
  inLanguage: "vi",
  publisher: { "@type": "Organization", name: "Fabric", url: APP_URL },
};

export default function VietnamPage() {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Trang chủ", href: "/" },
          { name: "Việt Nam", href: "/vi" },
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
            <span className="text-2xl">🇻🇳</span>
            <span className="text-sm font-medium text-gray-500 uppercase tracking-wide">
              Việt Nam
            </span>
          </div>
          <h1 className="text-4xl font-bold text-gray-900">
            Áo Thun Premium — Giao Hàng Đến Việt Nam
          </h1>
          <p className="mt-4 text-lg text-gray-600 max-w-2xl">
            Khám phá bộ sưu tập áo thun premium chất lượng cao từ Fabric, giao hàng trực tiếp đến
            Việt Nam. Thanh toán an toàn bằng thẻ Visa/Mastercard hoặc USDC crypto.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/products"
              className="rounded-lg bg-gray-900 px-6 py-3 text-sm font-medium text-white hover:bg-gray-700"
            >
              Xem Sản Phẩm
            </Link>
            <Link
              href="/payment/card"
              className="rounded-lg border border-gray-300 px-6 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Phương Thức Thanh Toán →
            </Link>
          </div>
        </header>

        <TrustBadges className="mb-10" />

        <section aria-labelledby="shipping-heading" className="mb-10">
          <h2 id="shipping-heading" className="text-xl font-semibold text-gray-900 mb-4">
            Giao Hàng Đến Việt Nam
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              { label: "Thời gian giao hàng", value: "7–14 ngày làm việc" },
              { label: "Theo dõi đơn hàng", value: "Có cho tất cả đơn hàng" },
              { label: "Đổi trả", value: "Chính sách 7 ngày" },
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
            Phương Thức Thanh Toán Cho Việt Nam
          </h2>
          <ul className="space-y-3">
            <li className="flex items-start gap-3 rounded-lg border border-gray-200 p-4">
              <span className="text-success font-bold mt-0.5">✓</span>
              <div>
                <p className="font-medium text-gray-900">
                  Thẻ Tín Dụng / Ghi Nợ (Visa, Mastercard)
                </p>
                <p className="text-sm text-gray-500">
                  Chấp nhận từ tất cả ngân hàng Việt Nam — Vietcombank, Techcombank, BIDV, VPBank.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3 rounded-lg border border-gray-200 p-4">
              <span className="text-success font-bold mt-0.5">✓</span>
              <div>
                <p className="font-medium text-gray-900">USDC trên Base Network</p>
                <p className="text-sm text-gray-500">
                  Thanh toán bằng crypto — MetaMask hoặc Coinbase Wallet, không cần tài khoản ngân
                  hàng.
                </p>
              </div>
            </li>
          </ul>
        </section>

        <section aria-labelledby="why-heading" className="mb-10">
          <h2 id="why-heading" className="text-xl font-semibold text-gray-900 mb-4">
            Tại Sao Chọn Fabric?
          </h2>
          <ul className="space-y-2">
            {[
              "Chất liệu premium cao cấp — được tuyển chọn từ nhà sản xuất uy tín",
              "Ảnh sản phẩm thực tế — không chỉnh sửa quá mức",
              "Các size có sẵn: XS, S, M, L, XL, XXL",
              "Thanh toán bảo mật với mã hóa TLS 1.3 và tiêu chuẩn PCI-DSS",
              "Xác nhận đơn hàng tự động qua email sau khi thanh toán thành công",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-success font-bold mt-0.5 flex-shrink-0">✓</span>
                {item}
              </li>
            ))}
          </ul>
        </section>

        <FaqSection items={FAQ_ITEMS} heading="Câu Hỏi Thường Gặp — Việt Nam" />
      </div>
    </>
  );
}
