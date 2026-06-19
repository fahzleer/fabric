import { createMerchantApi } from "@/lib/merchant-api";
import type { MerchantOrderSummary } from "@/lib/merchant-api";
import { isErr, isSome } from "@fabric/types";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

export const metadata: Metadata = { title: "Orders — Merchant Portal" };

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  confirmed: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  shipped: "bg-blue-500/20 text-blue-300 border-blue-500/40",
  delivered: "bg-green-500/20 text-green-300 border-green-500/40",
  cancelled: "bg-red-500/20 text-red-300 border-red-500/40",
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
  const statusStyle = STATUS_STYLES[order.status] ?? "bg-gray-700/50 text-gray-300 border-gray-600";
  return (
    <tr className="border-t border-white/5 hover:bg-white/5 transition-colors">
      <td className="px-4 py-3 font-mono text-xs text-gray-400">{order.id.slice(0, 8)}…</td>
      <td className="px-4 py-3 text-sm text-gray-200">{formatDate(order.placedAt)}</td>
      <td className="px-4 py-3 text-sm text-gray-400 font-mono text-xs">
        {order.customerId.slice(0, 8)}…
      </td>
      <td className="px-4 py-3 text-sm text-gray-200 text-center">{order.itemCount}</td>
      <td className="px-4 py-3 text-sm font-medium text-white text-right">
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
          className="text-xs text-emerald-400 hover:text-emerald-300 font-medium"
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
        <p className="text-gray-400">Unable to load data. Please refresh.</p>
      </div>
    );
  }

  const result = await maybeApi.value.getMerchantOrders(page, 20);

  if (isErr(result)) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-white">Orders</h1>
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300 text-sm">
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
          <h1 className="text-2xl font-bold text-white">Orders</h1>
          <p className="mt-1 text-sm text-gray-400">
            Orders containing your products ({total} total)
          </p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-gray-800/50 p-12 text-center">
          <p className="text-gray-400">No orders yet. Share your store to start selling!</p>
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 bg-gray-800/50 overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/10">
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Order ID
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Date
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Customer
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400 text-center">
                  Items
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400 text-right">
                  Total
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
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
        <div className="flex items-center justify-between text-sm text-gray-400">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`/merchant/orders?page=${page - 1}`}
                className="rounded-lg border border-white/10 px-3 py-1.5 hover:bg-white/5"
              >
                ← Prev
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={`/merchant/orders?page=${page + 1}`}
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
