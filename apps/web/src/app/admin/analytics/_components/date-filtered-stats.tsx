"use client";

import { CountUpNumber } from "@/components/motion/count-up-number";
import { RevealGroup, RevealItem } from "@/components/motion/reveal";
import { type DateRange, DateRangePicker, rangeForLastNDays } from "@fabric/ui";
import { useMemo, useState } from "react";

const REVENUE_STATUSES = new Set(["confirmed", "processing", "shipped", "delivered"]);

export type AdminOrderForFilter = {
  status: string;
  totalAmountInCents: number;
  placedAt: string;
};

function formatRevenue(cents: number, currency: string): string {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

type Props = {
  orders: AdminOrderForFilter[];
  currency: string;
  windowSize: number;
};

export function DateFilteredStats({ orders, currency, windowSize }: Props) {
  const [range, setRange] = useState<DateRange>(rangeForLastNDays(30));

  const { revenueCents, orderCount } = useMemo(() => {
    const fromMs = new Date(range.from).setHours(0, 0, 0, 0);
    const toMs = new Date(range.to).setHours(23, 59, 59, 999);
    let revenueCents = 0;
    let orderCount = 0;
    for (const order of orders) {
      const placedMs = new Date(order.placedAt).getTime();
      if (placedMs < fromMs || placedMs > toMs) continue;
      orderCount += 1;
      if (REVENUE_STATUSES.has(order.status)) revenueCents += order.totalAmountInCents;
    }
    return { revenueCents, orderCount };
  }, [orders, range]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Revenue by date range
        </h2>
        <DateRangePicker value={range} onChange={setRange} />
      </div>
      <RevealGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <RevealItem className="rounded-xl border border-border bg-muted/50 p-6">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Revenue in range
          </p>
          <p className="mt-2 text-2xl font-bold text-success">
            <CountUpNumber value={revenueCents} formatter={(n) => formatRevenue(n, currency)} />
          </p>
        </RevealItem>
        <RevealItem className="rounded-xl border border-border bg-muted/50 p-6">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Orders in range
          </p>
          <p className="mt-2 text-2xl font-bold text-foreground">
            <CountUpNumber value={orderCount} />
          </p>
        </RevealItem>
      </RevealGroup>
      <p className="text-xs text-muted-foreground">
        Based on the {windowSize} most recent orders across all merchants — older orders outside
        that window won't be reflected even if they fall inside the selected range.
      </p>
    </div>
  );
}
