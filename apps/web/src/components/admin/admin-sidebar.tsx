"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/payouts", label: "Payouts" },
  { href: "/admin/billing", label: "Billing" },
  { href: "/admin/invoices", label: "Invoices" },
  { href: "/admin/inventory", label: "Inventory" },
  { href: "/admin/affiliates", label: "Affiliates" },
] as const;

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-52 shrink-0 border-r border-white/10 bg-gray-900/50">
      <nav className="flex flex-col gap-1 px-3 py-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-amber-500/20 text-amber-300"
                  : "text-gray-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
