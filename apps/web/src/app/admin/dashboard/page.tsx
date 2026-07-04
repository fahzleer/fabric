import { DashboardRealtimeRefresh } from "@/components/dashboard-realtime-refresh";
import { CountUpNumber } from "@/components/motion/count-up-number";
import { RevealGroup, RevealItem } from "@/components/motion/reveal";
import { formatPrice } from "@/lib/price";
import { connection } from "next/server";
import { getDashboardStats } from "./_lib/queries";

export default async function DashboardPage() {
  await connection();

  const stats = await getDashboardStats();

  const cards = [
    {
      label: "Total Orders",
      rawValue: stats.totalOrders,
      note: "excluding cancelled & refunded",
    },
    {
      label: "Total Revenue",
      rawValue: stats.totalRevenueCents,
      formatter: (n: number) => formatPrice({ amount: n / 100, currency: stats.currency }),
      note: "from delivered orders",
    },
    {
      label: "Confirmed Orders",
      rawValue: stats.confirmedOrders,
      note: "all-time, confirmed/shipped/delivered",
    },
    {
      label: "Pending Orders",
      rawValue: stats.pendingOrders,
      note: "awaiting payment confirmation",
    },
  ];

  return (
    <div className="space-y-8">
      <DashboardRealtimeRefresh />
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Store performance overview</p>
      </div>

      <RevealGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <RevealItem
            key={card.label}
            className="rounded-xl border border-border bg-muted/50 px-6 py-5"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {card.label}
            </p>
            <p className="mt-2 text-3xl font-bold text-foreground">
              <CountUpNumber value={card.rawValue} formatter={card.formatter} />
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{card.note}</p>
          </RevealItem>
        ))}
      </RevealGroup>
    </div>
  );
}
