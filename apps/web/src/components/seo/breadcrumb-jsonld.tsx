interface BreadcrumbItem {
  name: string;
  href: string;
}

interface BreadcrumbJsonLdProps {
  items: BreadcrumbItem[];
}

export function BreadcrumbJsonLd({ items }: BreadcrumbJsonLdProps) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://fabric.cool";

  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.href.startsWith("http") ? item.href : `${baseUrl}${item.href}`,
    })),
  };

  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: controlled server-side JSON-LD, no user input
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
