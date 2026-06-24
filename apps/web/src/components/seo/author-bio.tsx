export interface AuthorBioProps {
  name: string;
  jobTitle: string;
  /** ISO-8601 date string, e.g. "2026-06-23" */
  updatedAt: string;
  appUrl?: string;
}

export function AuthorBio({ name, jobTitle, updatedAt, appUrl }: AuthorBioProps) {
  const baseUrl = appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://fabric.cool";

  const schema = {
    "@context": "https://schema.org",
    "@type": "Person",
    name,
    jobTitle,
    worksFor: { "@type": "Organization", name: "Fabric", url: baseUrl },
  };

  const displayDate = new Intl.DateTimeFormat("th-TH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(updatedAt));

  return (
    <>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: controlled server-side JSON-LD
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <div className="flex items-center gap-3 mt-8 pt-6 border-t border-gray-100">
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
          <span className="text-sm font-semibold text-gray-600" aria-hidden="true">
            {name.charAt(0).toUpperCase()}
          </span>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900">{name}</p>
          <p className="text-xs text-gray-500">
            {jobTitle} · อัปเดต <time dateTime={updatedAt}>{displayDate}</time>
          </p>
        </div>
      </div>
    </>
  );
}
