export interface FaqItem {
  question: string;
  answer: string;
}

interface FaqSectionProps {
  items: FaqItem[];
  heading?: string;
}

export function FaqSection({ items, heading = "คำถามที่พบบ่อย" }: FaqSectionProps) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };

  return (
    <section aria-labelledby="faq-heading" className="mt-12 border-t border-gray-200 pt-10">
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: controlled server-side JSON-LD
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <h2 id="faq-heading" className="text-xl font-semibold text-gray-900">
        {heading}
      </h2>
      <dl className="mt-6 space-y-6">
        {items.map((item) => (
          <div key={item.question}>
            <dt className="text-sm font-medium text-gray-900">{item.question}</dt>
            <dd className="mt-1 text-sm text-gray-600">{item.answer}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
