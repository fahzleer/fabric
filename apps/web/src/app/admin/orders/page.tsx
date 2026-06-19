import { auth } from "@/lib/auth";
import { formatPrice } from "@/lib/price";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";

export const metadata: Metadata = { title: "Orders — Admin" };

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3010";
const INTERNAL_SECRET = process.env.INTERNAL_SECRET ?? "";

type AdminOrder = {
  id: string;
  status: string;
  totalAmountInCents: number;
  currency: string;
  itemCount: number;
  placedAt: string;
  customerId: string;
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  confirmed: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  shipped: "bg-blue-500/20 text-blue-300 border-blue-500/40",
  delivered: "bg-green-500/20 text-green-300 border-green-500/40",
  cancelled: "bg-red-500/20 text-red-300 border-red-500/40",
};

async function getAdminOrders(token: string, page: number) {
  try {
    const url = new URL(`${API_BASE}/admin/orders`);
    url.searchParams.set("page", String(page));
    url.searchParams.set("perPage", "25");
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as {
      items: AdminOrder[];
      total: number;
      page: number;
      perPage: number;
    };
  } catch {
    return null;
  }
}

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

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await connection();
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam ?? "1"));

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/auth/login");
  const user = session.user as { id: string; email: string };
  const token = await issueAdminToken(user.id, user.email);
  if (!token) return <p className="text-gray-400">Failed to authenticate</p>;

  const data = await getAdminOrders(token, page);
  if (!data) return <p className="text-gray-400">Failed to load orders</p>;

  const totalPages = Math.ceil(data.total / data.perPage);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">All Orders</h1>
        <p className="mt-1 text-sm text-gray-400">{data.total} orders across all merchants</p>
      </div>

      <div className="rounded-xl border border-white/10 bg-gray-800/50 overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/10">
              {["Order ID", "Date", "Customer", "Items", "Total", "Status"].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.items.map((order) => (
              <tr
                key={order.id}
                className="border-t border-white/5 hover:bg-white/5 transition-colors"
              >
                <td className="px-4 py-3 font-mono text-xs text-gray-400">
                  {order.id.slice(0, 8)}…
                </td>
                <td className="px-4 py-3 text-sm text-gray-300">
                  {new Date(order.placedAt).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-gray-400">
                  {order.customerId.slice(0, 8)}…
                </td>
                <td className="px-4 py-3 text-sm text-gray-300 text-center">{order.itemCount}</td>
                <td className="px-4 py-3 text-sm font-medium text-white">
                  {formatPrice({
                    amount: order.totalAmountInCents / 100,
                    currency: order.currency,
                  })}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLES[order.status] ?? "bg-gray-700/50 text-gray-300"}`}
                  >
                    {order.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-400">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`/admin/orders?page=${page - 1}`}
                className="rounded-lg border border-white/10 px-3 py-1.5 hover:bg-white/5"
              >
                ← Prev
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={`/admin/orders?page=${page + 1}`}
                className="rounded-lg border border-white/10 px-3 py-1.5 hover:bg-white/5"
              >
                Next →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
