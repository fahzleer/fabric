import { auth } from "@/lib/auth";
import { formatPrice } from "@/lib/price";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";

export const metadata: Metadata = { title: "Analytics — Admin" };

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3010";
const INTERNAL_SECRET = process.env.INTERNAL_SECRET ?? "";

type AdminAnalytics = {
  totalOrders: number;
  totalRevenueCents: number;
  ordersByStatus: Record<string, number>;
  totalMerchants: number;
  totalMerchantRevenueCents: number;
  currency: string;
};

async function issueAdminToken(userId: string, email: string): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/internal/issue-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-secret": INTERNAL_SECRET },
      body: JSON.stringify({ userId, email, role: "admin" }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { accessToken?: string };
    return data.accessToken ?? null;
  } catch {
    return null;
  }
}

async function getAnalytics(token: string): Promise<AdminAnalytics | null> {
  try {
    const res = await fetch(`${API_BASE}/admin/analytics`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as AdminAnalytics;
  } catch {
    return null;
  }
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: {
    label: "Payment Pending",
    color: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  },
  confirmed: {
    label: "Confirmed",
    color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  },
  processing: { label: "Processing", color: "text-blue-400 bg-blue-500/10 border-blue-500/30" },
  shipped: { label: "Shipped", color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30" },
  delivered: { label: "Delivered", color: "text-green-400 bg-green-500/10 border-green-500/30" },
  cancelled: { label: "Cancelled", color: "text-red-400 bg-red-500/10 border-red-500/30" },
  refunded: { label: "Refunded", color: "text-gray-400 bg-gray-500/10 border-gray-500/30" },
};

export default async function AdminAnalyticsPage() {
  await connection();

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/auth/login");

  const user = session.user as { id: string; email: string };
  const token = await issueAdminToken(user.id, user.email);
  if (!token) return <p className="text-gray-400">Failed to authenticate</p>;

  const data = await getAnalytics(token);
  if (!data) return <p className="text-gray-400">Failed to load analytics</p>;

  const currency = data.currency ?? "THB";
  const totalOrders = Object.values(data.ordersByStatus).reduce((s, n) => s + n, 0);

  const summaryCards = [
    {
      label: "Total Orders",
      value: data.totalOrders.toLocaleString(),
      note: `${Object.values(data.ordersByStatus).reduce((s, n) => s + n, 0)} across all statuses`,
      accent: "border-violet-500/30 bg-violet-500/5",
    },
    {
      label: "Gross Revenue",
      value: formatPrice({ amount: data.totalRevenueCents / 100, currency }),
      note: "confirmed + shipped + delivered",
      accent: "border-emerald-500/30 bg-emerald-500/5",
    },
    {
      label: "Merchant Payouts",
      value: formatPrice({ amount: data.totalMerchantRevenueCents / 100, currency }),
      note: "cumulative merchant earnings",
      accent: "border-amber-500/30 bg-amber-500/5",
    },
    {
      label: "Active Merchants",
      value: data.totalMerchants.toLocaleString(),
      note: "registered store owners",
      accent: "border-blue-500/30 bg-blue-500/5",
    },
  ];

  const statusEntries = Object.entries(data.ordersByStatus).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Platform Analytics</h1>
        <p className="mt-1 text-sm text-gray-400">
          Real-time overview across all merchants and orders
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((card) => (
          <div key={card.label} className={`rounded-xl border px-6 py-5 ${card.accent}`}>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
              {card.label}
            </p>
            <p className="mt-2 text-2xl font-bold text-white">{card.value}</p>
            <p className="mt-1 text-xs text-gray-500">{card.note}</p>
          </div>
        ))}
      </div>

      {/* Orders by status */}
      <div className="rounded-xl border border-white/10 bg-gray-800/50 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4">
          Orders by Status
        </h2>
        <div className="space-y-3">
          {statusEntries.map(([status, count]) => {
            const meta = STATUS_LABELS[status] ?? {
              label: status,
              color: "text-gray-400 bg-gray-500/10 border-gray-500/30",
            };
            const pct = totalOrders > 0 ? Math.round((count / totalOrders) * 100) : 0;
            return (
              <div key={status} className="flex items-center gap-4">
                <span
                  className={`inline-flex w-28 shrink-0 items-center justify-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${meta.color}`}
                >
                  {meta.label}
                </span>
                <div className="flex-1 h-2 rounded-full bg-gray-700/50 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-white/20 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-8 text-right text-sm font-semibold text-white">{count}</span>
                <span className="w-10 text-right text-xs text-gray-500">{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Revenue breakdown */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-gray-800/50 p-6 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Revenue</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-400">Gross GMV (confirmed+)</dt>
              <dd className="font-semibold text-white">
                {formatPrice({ amount: data.totalRevenueCents / 100, currency })}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-400">Platform fee (5%)</dt>
              <dd className="font-semibold text-emerald-400">
                {formatPrice({ amount: Math.round(data.totalRevenueCents * 0.05) / 100, currency })}
              </dd>
            </div>
            <div className="flex justify-between border-t border-white/10 pt-3">
              <dt className="text-gray-400">Net to merchants (95%)</dt>
              <dd className="font-semibold text-white">
                {formatPrice({ amount: Math.round(data.totalRevenueCents * 0.95) / 100, currency })}
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-xl border border-white/10 bg-gray-800/50 p-6 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
            Order Funnel
          </h2>
          <dl className="space-y-3 text-sm">
            {[
              ["Total placed", data.totalOrders],
              [
                "Confirmed / Active",
                (data.ordersByStatus.confirmed ?? 0) +
                  (data.ordersByStatus.processing ?? 0) +
                  (data.ordersByStatus.shipped ?? 0),
              ],
              ["Delivered", data.ordersByStatus.delivered ?? 0],
              ["Cancelled", data.ordersByStatus.cancelled ?? 0],
            ].map(([label, val]) => (
              <div key={String(label)} className="flex justify-between">
                <dt className="text-gray-400">{label}</dt>
                <dd className="font-semibold text-white">{val}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}
