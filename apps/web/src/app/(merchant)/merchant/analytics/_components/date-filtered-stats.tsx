"use client";

import { CountUpNumber } from "@/components/motion/count-up-number";
import { RevealGroup, RevealItem } from "@/components/motion/reveal";
import type { MerchantOrderSummary } from "@/lib/merchant-api";
import { type DateRange, DateRangePicker, rangeForLastNDays } from "@fabric/ui";
import { useMemo, useState } from "react";

const COMPLETED_STATUSES = new Set(["confirmed", "processing", "shipped", "delivered"]);

function formatRevenue(cents: number): string {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

type Props = {
  orders: MerchantOrderSummary[];
  /** How many of the merchant's most recent orders `orders` represents. */
  windowSize: number;
};

export function DateFilteredStats({ orders, windowSize }: Props) {
  const [range, setRange] = useState<DateRange>(rangeForLastNDays(30));

  const { revenueCents, completedCount } = useMemo(() => {
    const fromMs = new Date(range.from).setHours(0, 0, 0, 0);
    const toMs = new Date(range.to).setHours(23, 59, 59, 999);
    let revenueCents = 0;
    let completedCount = 0;
    for (const order of orders) {
      if (!COMPLETED_STATUSES.has(order.status)) continue;
      const placedMs = new Date(order.placedAt).getTime();
      if (placedMs < fromMs || placedMs > toMs) continue;
      revenueCents += order.totalAmountInCents;
      completedCount += 1;
    }
    return { revenueCents, completedCount };
  }, [orders, range]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">Revenue by date range</h2>
        <DateRangePicker value={range} onChange={setRange} />
      </div>
      <RevealGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <RevealItem className="rounded-xl border border-border bg-muted/50 p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Revenue in range
          </p>
          <p className="mt-2 text-3xl font-bold text-success">{formatRevenue(revenueCents)}</p>
        </RevealItem>
        <RevealItem className="rounded-xl border border-border bg-muted/50 p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Completed orders in range
          </p>
          <p className="mt-2 text-3xl font-bold text-info">
            <CountUpNumber value={completedCount} />
          </p>
        </RevealItem>
      </RevealGroup>
      <p className="text-xs text-muted-foreground">
        Based on your most recent {windowSize} orders — very old orders outside that window won't be
        reflected even if they fall inside the selected range.
      </p>
    </div>
  );
}
