import { formatPrice } from "@/lib/price";
import { connection } from "next/server";
import { getDashboardStats } from "./_lib/queries";

export default async function DashboardPage() {
  await connection();

  const stats = await getDashboardStats();

  const cards = [
    {
      label: "Total Orders",
      value: stats.totalOrders.toLocaleString(),
      note: "excluding cancelled & refunded",
    },
    {
      label: "Total Revenue",
      value: formatPrice({ amount: stats.totalRevenueCents / 100, currency: stats.currency }),
      note: "from delivered orders",
    },
    {
      label: "Active Buyers (30d)",
      value: stats.activeUsers30d.toLocaleString(),
      note: "unique buyers in last 30 days",
    },
    {
      label: "Churn Rate",
      value: `${stats.churnRatePct}%`,
      note: "prev month buyers lost this month",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-400">Store performance overview</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-white/10 bg-gray-800/50 px-6 py-5"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
              {card.label}
            </p>
            <p className="mt-2 text-3xl font-bold text-white">{card.value}</p>
            <p className="mt-1 text-xs text-gray-500">{card.note}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
