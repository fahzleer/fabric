import { CopyIdButton } from "@/components/admin/copy-id-button";
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
  pending: "bg-warning/20 text-warning border-warning/40",
  confirmed: "bg-success/20 text-success border-success/40",
  shipped: "bg-info/20 text-info border-info/40",
  delivered: "bg-success/20 text-success border-success/40",
  cancelled: "bg-destructive/20 text-destructive border-destructive/40",
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
  if (!token) return <p className="text-muted-foreground">Failed to authenticate</p>;

  const data = await getAdminOrders(token, page);
  if (!data) return <p className="text-muted-foreground">Failed to load orders</p>;

  const totalPages = Math.ceil(data.total / data.perPage);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">All Orders</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {data.total} orders across all merchants
        </p>
      </div>

      <div className="rounded-xl border border-border bg-muted/50 overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border">
              {["Order ID", "Date", "Customer", "Items", "Total", "Status"].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
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
                className="border-t border-border hover:bg-muted transition-colors"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <code className="font-mono text-xs text-muted-foreground">
                      {order.id.slice(0, 8)}…
                    </code>
                    <CopyIdButton value={order.id} />
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-foreground">
                  {new Date(order.placedAt).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <code className="font-mono text-xs text-muted-foreground">
                      {order.customerId.slice(0, 8)}…
                    </code>
                    <CopyIdButton value={order.customerId} />
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-foreground text-center">{order.itemCount}</td>
                <td className="px-4 py-3 text-sm font-medium text-foreground">
                  {formatPrice({
                    amount: order.totalAmountInCents / 100,
                    currency: order.currency,
                  })}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLES[order.status] ?? "bg-muted/50 text-foreground"}`}
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
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`/admin/orders?page=${page - 1}`}
                className="rounded-lg border border-border px-3 py-1.5 hover:bg-muted"
              >
                ← Prev
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={`/admin/orders?page=${page + 1}`}
                className="rounded-lg border border-border px-3 py-1.5 hover:bg-muted"
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
