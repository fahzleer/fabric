const BADGES = [
  {
    label: "PCI-DSS",
    sub: "ความปลอดภัยบัตร",
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
  },
  {
    label: "จัดส่งทั่วไทย",
    sub: "2–3 วันทำการ",
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <rect x="1" y="3" width="15" height="13" />
        <path d="M16 8h4l3 3v5h-7V8z" />
        <circle cx="5.5" cy="18.5" r="2.5" />
        <circle cx="18.5" cy="18.5" r="2.5" />
      </svg>
    ),
  },
  {
    label: "คืนสินค้าได้",
    sub: "ภายใน 7 วัน",
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
        <path d="M3 3v5h5" />
      </svg>
    ),
  },
  {
    label: "3 ช่องทางชำระ",
    sub: "PromptPay · บัตร · Crypto",
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
        <line x1="1" y1="10" x2="23" y2="10" />
      </svg>
    ),
  },
];

interface TrustBadgesProps {
  className?: string;
}

export function TrustBadges({ className = "" }: TrustBadgesProps) {
  return (
    <div
      className={`grid grid-cols-2 gap-3 sm:grid-cols-4 ${className}`}
      aria-label="เหตุผลที่เลือก Fabric"
    >
      {BADGES.map((badge) => (
        <div
          key={badge.label}
          className="flex items-center gap-3 rounded-lg border border-border bg-white p-3"
        >
          <span className="text-muted-foreground">{badge.icon}</span>
          <div>
            <p className="text-xs font-semibold text-foreground">{badge.label}</p>
            <p className="text-xs text-muted-foreground">{badge.sub}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
