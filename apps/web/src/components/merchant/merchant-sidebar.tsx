"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string; icon: string; aliases: string[] };

const navItems: NavItem[] = [
  { href: "/merchant/dashboard", label: "Dashboard", icon: "▤", aliases: ["/merchant/onboarding"] },
  { href: "/merchant/products", label: "Products", icon: "🏷", aliases: [] },
  { href: "/merchant/orders", label: "Orders", icon: "📦", aliases: [] },
  { href: "/merchant/analytics", label: "Analytics", icon: "📊", aliases: [] },
  { href: "/merchant/payouts", label: "Payouts", icon: "💸", aliases: [] },
  { href: "/merchant/billing", label: "Billing", icon: "💳", aliases: [] },
  { href: "/merchant/invoices", label: "Invoices", icon: "🧾", aliases: [] },
  { href: "/merchant/inventory", label: "Inventory", icon: "📦", aliases: [] },
  { href: "/merchant/affiliates", label: "Affiliates", icon: "🔗", aliases: [] },
];

function matchesPath(pathname: string, item: NavItem): boolean {
  return (
    pathname === item.href ||
    pathname.startsWith(`${item.href}/`) ||
    item.aliases.some((a) => pathname === a || pathname.startsWith(`${a}/`))
  );
}

export function MerchantSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 border-r border-border bg-card/50">
      {/* Store badge */}
      <div className="border-b border-border px-4 py-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-success">
          Merchant Portal
        </p>
      </div>

      <nav className="flex flex-col gap-1 px-3 py-4">
        {navItems.map((item) => {
          const isActive = matchesPath(pathname, item);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-success/20 text-success"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <span aria-hidden className="text-base leading-none">
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
