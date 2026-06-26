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
    color: "text-warning bg-warning/10 border-warning/30",
  },
  confirmed: {
    label: "Confirmed",
    color: "text-success bg-success/10 border-success/30",
  },
  processing: { label: "Processing", color: "text-info bg-info/10 border-info/30" },
  shipped: { label: "Shipped", color: "text-info bg-info/10 border-info/30" },
  delivered: { label: "Delivered", color: "text-success bg-success/10 border-success/30" },
  cancelled: {
    label: "Cancelled",
    color: "text-destructive bg-destructive/10 border-destructive/30",
  },
  refunded: { label: "Refunded", color: "text-muted-foreground bg-muted border-border" },
};

export default async function AdminAnalyticsPage() {
  await connection();

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/auth/login");

  const user = session.user as { id: string; email: string };
  const token = await issueAdminToken(user.id, user.email);
  if (!token) return <p className="text-muted-foreground">Failed to authenticate</p>;

  const data = await getAnalytics(token);
  if (!data) return <p className="text-muted-foreground">Failed to load analytics</p>;

  const currency = data.currency ?? "THB";
  const totalOrders = Object.values(data.ordersByStatus).reduce((s, n) => s + n, 0);

  const summaryCards = [
    {
      label: "Total Orders",
      value: data.totalOrders.toLocaleString(),
      note: `${Object.values(data.ordersByStatus).reduce((s, n) => s + n, 0)} across all statuses`,
      accent: "border-info/30 bg-info/5",
    },
    {
      label: "Gross Revenue",
      value: formatPrice({ amount: data.totalRevenueCents / 100, currency }),
      note: "confirmed + shipped + delivered",
      accent: "border-success/30 bg-success/5",
    },
    {
      label: "Merchant Payouts",
      value: formatPrice({ amount: data.totalMerchantRevenueCents / 100, currency }),
      note: "cumulative merchant earnings",
      accent: "border-warning/30 bg-warning/5",
    },
    {
      label: "Active Merchants",
      value: data.totalMerchants.toLocaleString(),
      note: "registered store owners",
      accent: "border-info/30 bg-info/5",
    },
  ];

  const statusEntries = Object.entries(data.ordersByStatus).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Platform Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Real-time overview across all merchants and orders
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((card) => (
          <div key={card.label} className={`rounded-xl border px-6 py-5 ${card.accent}`}>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {card.label}
            </p>
            <p className="mt-2 text-2xl font-bold text-foreground">{card.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{card.note}</p>
          </div>
        ))}
      </div>

      {/* Orders by status */}
      <div className="rounded-xl border border-border bg-muted/50 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
          Orders by Status
        </h2>
        <div className="space-y-3">
          {statusEntries.map(([status, count]) => {
            const meta = STATUS_LABELS[status] ?? {
              label: status,
              color: "text-muted-foreground bg-muted border-border",
            };
            const pct = totalOrders > 0 ? Math.round((count / totalOrders) * 100) : 0;
            return (
              <div key={status} className="flex items-center gap-4">
                <span
                  className={`inline-flex w-28 shrink-0 items-center justify-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${meta.color}`}
                >
                  {meta.label}
                </span>
                <div className="flex-1 h-2 rounded-full bg-muted/50 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-muted/20 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-8 text-right text-sm font-semibold text-foreground">
                  {count}
                </span>
                <span className="w-10 text-right text-xs text-muted-foreground">{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Revenue breakdown */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-muted/50 p-6 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Revenue
          </h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Gross GMV (confirmed+)</dt>
              <dd className="font-semibold text-foreground">
                {formatPrice({ amount: data.totalRevenueCents / 100, currency })}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Platform fee (5%)</dt>
              <dd className="font-semibold text-success">
                {formatPrice({ amount: Math.round(data.totalRevenueCents * 0.05) / 100, currency })}
              </dd>
            </div>
            <div className="flex justify-between border-t border-border pt-3">
              <dt className="text-muted-foreground">Net to merchants (95%)</dt>
              <dd className="font-semibold text-foreground">
                {formatPrice({ amount: Math.round(data.totalRevenueCents * 0.95) / 100, currency })}
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-xl border border-border bg-muted/50 p-6 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
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
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="font-semibold text-foreground">{val}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}
