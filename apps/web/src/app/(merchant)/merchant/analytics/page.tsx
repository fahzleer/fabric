import { createMerchantApi } from "@/lib/merchant-api";
import { isErr, isSome } from "@fabric/types";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { SalesInsightCard } from "./_components/sales-insight-card";

export const metadata: Metadata = {
  title: "Analytics — Merchant Portal",
};

function formatRevenue(cents: number): string {
  const baht = cents / 100;
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0,
  }).format(baht);
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat("th-TH").format(n);
}

function StatCard({
  label,
  value,
  sub,
  accent = "emerald",
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "emerald" | "blue" | "purple" | "amber";
}) {
  const colours: Record<typeof accent, string> = {
    emerald: "text-success",
    blue: "text-info",
    purple: "text-info",
    amber: "text-warning",
  };
  return (
    <div className="rounded-xl border border-border bg-muted/50 p-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className={`mt-2 text-3xl font-bold ${colours[accent]}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

const PLAN_BADGE: Record<string, string> = {
  free: "bg-muted/50 text-foreground",
  starter: "bg-info/20 text-info",
  professional: "bg-info/20 text-info",
  enterprise: "bg-warning/20 text-warning",
};

const STATUS_COLOUR: Record<string, string> = {
  active: "text-success",
  trialing: "text-info",
  cancelled: "text-destructive",
  inactive: "text-muted-foreground",
};

export default async function MerchantAnalyticsPage() {
  await connection();

  const maybeApi = await createMerchantApi();
  if (!isSome(maybeApi)) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Unable to load analytics. Please refresh.</p>
      </div>
    );
  }
  const api = maybeApi.value;

  const result = await api.getAnalytics();

  if (isErr(result)) {
    if (result.error.startsWith("[MerchantNotFoundError]")) redirect("/merchant/onboarding");
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">Store performance overview</p>
        </div>
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3">
          <p className="text-sm text-destructive">{result.error}</p>
        </div>
      </div>
    );
  }

  const { completedOrderCount, totalRevenueCents, productCount, plan, planStatus } = result.value;

  const planBadge = PLAN_BADGE[plan] ?? PLAN_BADGE.free;
  const statusColor = STATUS_COLOUR[planStatus] ?? STATUS_COLOUR.inactive;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">Store performance overview</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Revenue"
          value={formatRevenue(totalRevenueCents)}
          sub="All-time completed orders"
          accent="emerald"
        />
        <StatCard
          label="Completed Orders"
          value={formatNumber(completedOrderCount)}
          sub="Orders successfully confirmed"
          accent="blue"
        />
        <StatCard
          label="Active Products"
          value={formatNumber(productCount)}
          sub="Listed in your store"
          accent="purple"
        />
        <div className="rounded-xl border border-border bg-muted/50 p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Plan
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-0.5 text-sm font-semibold ${planBadge}`}>
              {plan.charAt(0).toUpperCase() + plan.slice(1)}
            </span>
            <span className={`text-xs font-medium ${statusColor}`}>{planStatus}</span>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Avg. order value:{" "}
            {completedOrderCount > 0
              ? formatRevenue(Math.round(totalRevenueCents / completedOrderCount))
              : "—"}
          </p>
        </div>
      </div>

      {/* AI sales insight (Typhoon) */}
      <SalesInsightCard hasData={completedOrderCount > 0} />

      {/* Empty state hint */}
      {completedOrderCount === 0 && (
        <div className="rounded-xl border border-dashed border-border px-6 py-10 text-center">
          <p className="text-2xl">📦</p>
          <p className="mt-3 text-sm font-medium text-foreground">No completed orders yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Revenue and order counts will appear here once customers complete their first purchase.
          </p>
        </div>
      )}

      {/* Note */}
      <p className="text-xs text-muted-foreground">
        Counters update in real-time as orders are confirmed. Revenue reflects net order value
        before platform fees.
      </p>
    </div>
  );
}
