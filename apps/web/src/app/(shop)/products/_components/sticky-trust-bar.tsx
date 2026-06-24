"use client";

const ITEMS = [
  {
    label: "ชำระเงินปลอดภัย",
    description: "PCI-DSS",
    icon: (
      <svg
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
        />
      </svg>
    ),
  },
  {
    label: "จัดส่งทั่วไทย",
    description: "2–3 วันทำการ",
    icon: (
      <svg
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"
        />
      </svg>
    ),
  },
  {
    label: "คืนสินค้าได้",
    description: "ภายใน 7 วัน",
    icon: (
      <svg
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
        />
      </svg>
    ),
  },
  {
    label: "3 ช่องทางชำระ",
    description: "PromptPay · บัตร · Crypto",
    icon: (
      <svg
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
        />
      </svg>
    ),
  },
];

export function StickyTrustBar() {
  return (
    <div className="sticky top-0 z-30 border-b border-gray-200 bg-white/95 py-2 shadow-sm backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 overflow-x-auto px-4 text-xs sm:text-sm">
        {ITEMS.map((item) => (
          <div key={item.label} className="flex shrink-0 items-center gap-2 text-gray-600">
            {item.icon}
            <div className="leading-tight">
              <span className="block font-medium text-gray-900">{item.label}</span>
              <span className="hidden text-gray-500 sm:inline">{item.description}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
