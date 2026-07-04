interface FreshnessLabelProps {
  /** ISO-8601 date string, e.g. "2026-06-23" */
  updatedAt: string;
  /** Quarter label, e.g. "Q2 2026" */
  quarter: string;
}

export function FreshnessLabel({ updatedAt, quarter }: FreshnessLabelProps) {
  const displayDate = new Intl.DateTimeFormat("th-TH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(updatedAt));

  return (
    <p className="mt-2 text-xs text-faint">
      อัปเดตข้อมูล{" "}
      <time dateTime={updatedAt} className="font-medium text-muted-foreground">
        {quarter} · {displayDate}
      </time>
    </p>
  );
}
