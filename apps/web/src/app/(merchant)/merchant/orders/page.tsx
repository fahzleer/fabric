import { createMerchantApi } from "@/lib/merchant-api";
import type { MerchantOrderSummary } from "@/lib/merchant-api";
import { isErr, isSome } from "@fabric/types";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

export const metadata: Metadata = { title: "Orders — Merchant Portal" };

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-warning/20 text-warning border-warning/40",
  confirmed: "bg-success/20 text-success border-success/40",
  shipped: "bg-info/20 text-info border-info/40",
  delivered: "bg-success/20 text-success border-success/40",
  cancelled: "bg-destructive/20 text-destructive border-destructive/40",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatAmount(cents: number, currency: string) {
  return new Intl.NumberFormat("th-TH", { style: "currency", currency }).format(cents / 100);
}

function OrderRow({ order }: { order: MerchantOrderSummary }) {
  const statusStyle = STATUS_STYLES[order.status] ?? "bg-muted/50 text-foreground border-border";
  return (
    <tr className="border-t border-border hover:bg-muted transition-colors">
      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{order.id.slice(0, 8)}…</td>
      <td className="px-4 py-3 text-sm text-foreground">{formatDate(order.placedAt)}</td>
      <td className="px-4 py-3 text-sm text-muted-foreground font-mono text-xs">
        {order.customerId.slice(0, 8)}…
      </td>
      <td className="px-4 py-3 text-sm text-foreground text-center">{order.itemCount}</td>
      <td className="px-4 py-3 text-sm font-medium text-foreground text-right">
        {formatAmount(order.totalAmountInCents, order.currency)}
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${statusStyle}`}
        >
          {order.status}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <Link
          href={`/merchant/orders/${order.id}`}
          className="text-xs text-success hover:text-success font-medium"
        >
          View →
        </Link>
      </td>
    </tr>
  );
}

export default async function MerchantOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await connection();
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam ?? "1"));

  const maybeApi = await createMerchantApi();
  if (!isSome(maybeApi)) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Unable to load data. Please refresh.</p>
      </div>
    );
  }

  const result = await maybeApi.value.getMerchantOrders(page, 20);

  if (isErr(result)) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-foreground">Orders</h1>
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-destructive text-sm">
          {result.error}
        </div>
      </div>
    );
  }

  const { items, total, perPage } = result.value;
  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Orders</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Orders containing your products ({total} total)
          </p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-border bg-muted/50 p-12 text-center">
          <p className="text-muted-foreground">No orders yet. Share your store to start selling!</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-muted/50 overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Order ID
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Date
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Customer
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center">
                  Items
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">
                  Total
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Status
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {items.map((order) => (
                <OrderRow key={order.id} order={order} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`/merchant/orders?page=${page - 1}`}
                className="rounded-lg border border-border px-3 py-1.5 hover:bg-muted"
              >
                ← Prev
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={`/merchant/orders?page=${page + 1}`}
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
