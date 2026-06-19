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
  free: "bg-gray-500/15 text-gray-400 border-gray-500/30",
  starter: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  professional: "bg-violet-500/15 text-violet-400 border-violet-500/30",
  enterprise: "bg-amber-500/15 text-amber-400 border-amber-500/30",
};

const PLAN_STATUS_STYLES: Record<string, string> = {
  active: "text-emerald-400",
  trialing: "text-blue-400",
  past_due: "text-red-400",
  cancelled: "text-gray-500",
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
  if (!token) return <p className="text-gray-400">Failed to authenticate</p>;

  const merchants = await getMerchants(token);
  const currency = "THB";

  const totalRevenue = merchants.reduce((s, m) => s + m.totalRevenueCents, 0);
  const totalPaidOut = merchants.reduce((s, m) => s + m.paidOutCents, 0);
  const totalAvailable = merchants.reduce((s, m) => s + m.availableBalanceCents, 0);
  const platformFee = Math.round(totalRevenue * 0.05);

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Merchant Billing</h1>
        <p className="mt-1 text-sm text-gray-400">
          Subscription plans and revenue balances for all merchants
        </p>
      </div>

      {/* Platform summary */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          {
            label: "Platform Fees (5%)",
            value: formatPrice({ amount: platformFee / 100, currency }),
            accent: "border-emerald-500/30 bg-emerald-500/5",
          },
          {
            label: "Total GMV",
            value: formatPrice({ amount: totalRevenue / 100, currency }),
            accent: "border-violet-500/30 bg-violet-500/5",
          },
          {
            label: "Paid Out",
            value: formatPrice({ amount: totalPaidOut / 100, currency }),
            accent: "border-amber-500/30 bg-amber-500/5",
          },
          {
            label: "Pending Balance",
            value: formatPrice({ amount: totalAvailable / 100, currency }),
            accent: "border-blue-500/30 bg-blue-500/5",
          },
        ].map((card) => (
          <div key={card.label} className={`rounded-xl border px-5 py-4 ${card.accent}`}>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
              {card.label}
            </p>
            <p className="mt-1.5 text-xl font-bold text-white">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Merchant table */}
      {merchants.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 py-14 text-center">
          <p className="text-3xl mb-3">🏪</p>
          <p className="text-sm font-medium text-gray-300">No merchants yet</p>
          <p className="mt-1 text-xs text-gray-500">Merchants will appear here after onboarding</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead className="border-b border-white/10 bg-gray-800/60">
              <tr>
                {["Store", "Plan", "Status", "Products", "GMV", "Available", "Joined"].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 bg-gray-900/30">
              {merchants.map((m) => (
                <tr key={m.userId} className="hover:bg-white/2 transition-colors">
                  <td className="px-4 py-4">
                    <div>
                      <p className="font-medium text-white">{m.storeName}</p>
                      {m.storeSlug && (
                        <Link
                          href={`/store/${m.storeSlug}`}
                          className="text-xs text-gray-500 hover:text-gray-300"
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
                      className={`text-xs font-medium capitalize ${PLAN_STATUS_STYLES[m.planStatus] ?? "text-gray-400"}`}
                    >
                      {m.planStatus}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-gray-300 text-center">{m.productCount}</td>
                  <td className="px-4 py-4">
                    <div>
                      <p className="font-medium text-white">
                        {formatPrice({ amount: m.totalRevenueCents / 100, currency })}
                      </p>
                      <p className="text-xs text-gray-500">{m.completedOrderCount} orders</p>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div>
                      <p className="font-medium text-emerald-400">
                        {formatPrice({ amount: m.availableBalanceCents / 100, currency })}
                      </p>
                      <p className="text-xs text-gray-500">
                        paid: {formatPrice({ amount: m.paidOutCents / 100, currency })}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-xs text-gray-500 whitespace-nowrap">
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

          <div className="border-t border-white/10 bg-gray-800/40 px-4 py-3 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              {merchants.length} merchant{merchants.length !== 1 ? "s" : ""}
            </span>
            <span className="text-xs text-gray-400">
              Platform fee income:{" "}
              <span className="font-semibold text-emerald-400">
                {formatPrice({ amount: platformFee / 100, currency })}
              </span>
            </span>
          </div>
        </div>
      )}

      {/* Fee info */}
      <div className="rounded-xl border border-white/10 bg-gray-800/20 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
          Fee Structure
        </h3>
        <ul className="space-y-1 text-xs text-gray-500 list-disc list-inside">
          <li>
            Platform fee: <strong className="text-gray-400">5%</strong> of each completed order
          </li>
          <li>Available balance = (GMV × 95%) − paid out</li>
          <li>
            Payout requests are approved manually from{" "}
            <Link
              href="/admin/payouts"
              className="text-gray-300 hover:text-white underline underline-offset-2"
            >
              Payouts page
            </Link>
          </li>
        </ul>
      </div>
    </div>
  );
}
