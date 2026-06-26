import { auth } from "@/lib/auth";
import { formatPrice } from "@/lib/price";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";

export const metadata: Metadata = { title: "Billing — Admin" };

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3010";
const INTERNAL_SECRET = process.env.INTERNAL_SECRET ?? "";

type AdminMerchant = {
  userId: string;
  storeName: string;
  storeSlug: string | null;
  plan: string;
  planStatus: string;
  productCount: number;
  totalRevenueCents: number;
  completedOrderCount: number;
  paidOutCents: number;
  availableBalanceCents: number;
  createdAt: string;
};

const PLAN_STYLES: Record<string, string> = {
  free: "bg-muted text-muted-foreground border-border",
  starter: "bg-info/15 text-info border-info/30",
  professional: "bg-info/15 text-info border-info/30",
  enterprise: "bg-warning/15 text-warning border-warning/30",
};

const PLAN_STATUS_STYLES: Record<string, string> = {
  active: "text-success",
  trialing: "text-info",
  past_due: "text-destructive",
  cancelled: "text-muted-foreground",
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

async function getMerchants(token: string): Promise<AdminMerchant[]> {
  try {
    const res = await fetch(`${API_BASE}/admin/merchants`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { merchants?: AdminMerchant[] };
    return data.merchants ?? [];
  } catch {
    return [];
  }
}

export default async function AdminBillingPage() {
  await connection();

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/auth/login");

  const user = session.user as { id: string; email: string };
  const token = await issueAdminToken(user.id, user.email);
  if (!token) return <p className="text-muted-foreground">Failed to authenticate</p>;

  const merchants = await getMerchants(token);
  const currency = "THB";

  const totalRevenue = merchants.reduce((s, m) => s + m.totalRevenueCents, 0);
  const totalPaidOut = merchants.reduce((s, m) => s + m.paidOutCents, 0);
  const totalAvailable = merchants.reduce((s, m) => s + m.availableBalanceCents, 0);
  const platformFee = Math.round(totalRevenue * 0.05);

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Merchant Billing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Subscription plans and revenue balances for all merchants
        </p>
      </div>

      {/* Platform summary */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          {
            label: "Platform Fees (5%)",
            value: formatPrice({ amount: platformFee / 100, currency }),
            accent: "border-success/30 bg-success/5",
          },
          {
            label: "Total GMV",
            value: formatPrice({ amount: totalRevenue / 100, currency }),
            accent: "border-info/30 bg-info/5",
          },
          {
            label: "Paid Out",
            value: formatPrice({ amount: totalPaidOut / 100, currency }),
            accent: "border-warning/30 bg-warning/5",
          },
          {
            label: "Pending Balance",
            value: formatPrice({ amount: totalAvailable / 100, currency }),
            accent: "border-info/30 bg-info/5",
          },
        ].map((card) => (
          <div key={card.label} className={`rounded-xl border px-5 py-4 ${card.accent}`}>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {card.label}
            </p>
            <p className="mt-1.5 text-xl font-bold text-foreground">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Merchant table */}
      {merchants.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-14 text-center">
          <p className="text-3xl mb-3">🏪</p>
          <p className="text-sm font-medium text-foreground">No merchants yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Merchants will appear here after onboarding
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/60">
              <tr>
                {["Store", "Plan", "Status", "Products", "GMV", "Available", "Joined"].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card/30">
              {merchants.map((m) => (
                <tr key={m.userId} className="hover:bg-muted/2 transition-colors">
                  <td className="px-4 py-4">
                    <div>
                      <p className="font-medium text-foreground">{m.storeName}</p>
                      {m.storeSlug && (
                        <Link
                          href={`/store/${m.storeSlug}`}
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          /{m.storeSlug}
                        </Link>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${PLAN_STYLES[m.plan] ?? PLAN_STYLES.free}`}
                    >
                      {m.plan}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`text-xs font-medium capitalize ${PLAN_STATUS_STYLES[m.planStatus] ?? "text-muted-foreground"}`}
                    >
                      {m.planStatus}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-foreground text-center">{m.productCount}</td>
                  <td className="px-4 py-4">
                    <div>
                      <p className="font-medium text-foreground">
                        {formatPrice({ amount: m.totalRevenueCents / 100, currency })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {m.completedOrderCount} orders
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div>
                      <p className="font-medium text-success">
                        {formatPrice({ amount: m.availableBalanceCents / 100, currency })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        paid: {formatPrice({ amount: m.paidOutCents / 100, currency })}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(m.createdAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="border-t border-border bg-muted/40 px-4 py-3 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {merchants.length} merchant{merchants.length !== 1 ? "s" : ""}
            </span>
            <span className="text-xs text-muted-foreground">
              Platform fee income:{" "}
              <span className="font-semibold text-success">
                {formatPrice({ amount: platformFee / 100, currency })}
              </span>
            </span>
          </div>
        </div>
      )}

      {/* Fee info */}
      <div className="rounded-xl border border-border bg-muted/20 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Fee Structure
        </h3>
        <ul className="space-y-1 text-xs text-muted-foreground list-disc list-inside">
          <li>
            Platform fee: <strong className="text-muted-foreground">5%</strong> of each completed
            order
          </li>
          <li>Available balance = (GMV × 95%) − paid out</li>
          <li>
            Payout requests are approved manually from{" "}
            <Link
              href="/admin/payouts"
              className="text-foreground hover:text-foreground underline underline-offset-2"
            >
              Payouts page
            </Link>
          </li>
        </ul>
      </div>
    </div>
  );
}
