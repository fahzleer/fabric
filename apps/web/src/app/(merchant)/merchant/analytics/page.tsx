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
    emerald: "text-emerald-400",
    blue: "text-blue-400",
    purple: "text-purple-400",
    amber: "text-amber-400",
  };
  return (
    <div className="rounded-xl border border-white/10 bg-gray-800/50 p-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${colours[accent]}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-500">{sub}</p>}
    </div>
  );
}

const PLAN_BADGE: Record<string, string> = {
  free: "bg-gray-700/50 text-gray-300",
  starter: "bg-blue-500/20 text-blue-300",
  professional: "bg-purple-500/20 text-purple-300",
  enterprise: "bg-amber-500/20 text-amber-300",
};

const STATUS_COLOUR: Record<string, string> = {
  active: "text-emerald-400",
  trialing: "text-blue-400",
  cancelled: "text-red-400",
  inactive: "text-gray-400",
};

export default async function MerchantAnalyticsPage() {
  await connection();

  const maybeApi = await createMerchantApi();
  if (!isSome(maybeApi)) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-gray-400">Unable to load analytics. Please refresh.</p>
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
          <h1 className="text-2xl font-bold text-white">Analytics</h1>
          <p className="mt-1 text-sm text-gray-400">Store performance overview</p>
        </div>
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
          <p className="text-sm text-red-400">{result.error}</p>
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
        <h1 className="text-2xl font-bold text-white">Analytics</h1>
        <p className="mt-1 text-sm text-gray-400">Store performance overview</p>
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
        <div className="rounded-xl border border-white/10 bg-gray-800/50 p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Plan</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-0.5 text-sm font-semibold ${planBadge}`}>
              {plan.charAt(0).toUpperCase() + plan.slice(1)}
            </span>
            <span className={`text-xs font-medium ${statusColor}`}>{planStatus}</span>
          </div>
          <p className="mt-3 text-xs text-gray-500">
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
        <div className="rounded-xl border border-dashed border-white/10 px-6 py-10 text-center">
          <p className="text-2xl">📦</p>
          <p className="mt-3 text-sm font-medium text-gray-300">No completed orders yet</p>
          <p className="mt-1 text-xs text-gray-500">
            Revenue and order counts will appear here once customers complete their first purchase.
          </p>
        </div>
      )}

      {/* Note */}
      <p className="text-xs text-gray-600">
        Counters update in real-time as orders are confirmed. Revenue reflects net order value
        before platform fees.
      </p>
    </div>
  );
}
