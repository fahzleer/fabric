import { createMerchantApi } from "@/lib/merchant-api";
import { isErr, isSome } from "@fabric/types";
import type { Metadata } from "next";
import { connection } from "next/server";

export const metadata: Metadata = { title: "Invoices — Merchant Portal" };

type InvoiceStatus = "paid" | "pending" | "overdue";

const STATUS_STYLES: Record<InvoiceStatus, string> = {
  paid: "bg-emerald-500/20 text-emerald-300",
  pending: "bg-amber-500/20 text-amber-300",
  overdue: "bg-red-500/20 text-red-300",
};

function orderStatusToInvoice(status: string): InvoiceStatus {
  if (status === "delivered") return "paid";
  if (status === "cancelled") return "overdue";
  return "pending";
}

function formatThb(cents: number, currency: string) {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function dueDate(placedAt: string) {
  const d = new Date(placedAt);
  d.setDate(d.getDate() + 30);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default async function MerchantInvoicesPage() {
  await connection();

  const maybeApi = await createMerchantApi();
  if (!isSome(maybeApi)) {
    return <p className="text-gray-400">Unable to load data. Please refresh.</p>;
  }

  const result = await maybeApi.value.getMerchantOrders(1, 100);
  if (isErr(result)) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-white">Invoices</h1>
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300 text-sm">
          {result.error}
        </div>
      </div>
    );
  }

  const orders = result.value.items.filter((o) => o.status !== "pending");
  const byStatus = orders.reduce<Record<InvoiceStatus, number>>(
    (acc, o) => {
      acc[orderStatusToInvoice(o.status)]++;
      return acc;
    },
    { paid: 0, pending: 0, overdue: 0 }
  );

  const totalRevenue = orders
    .filter((o) => o.status === "delivered")
    .reduce((s, o) => s + o.totalAmountInCents, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Invoices</h1>
        <p className="mt-1 text-sm text-gray-400">{orders.length} invoices from confirmed orders</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          {
            label: "Paid Revenue",
            value: formatThb(totalRevenue, "THB"),
            accent: "border-emerald-500/30 bg-emerald-500/5 text-emerald-400",
          },
          {
            label: "Paid",
            value: byStatus.paid.toString(),
            accent: "border-emerald-500/20 bg-gray-800/50 text-white",
          },
          {
            label: "Pending",
            value: byStatus.pending.toString(),
            accent: "border-amber-500/20 bg-gray-800/50 text-white",
          },
          {
            label: "Overdue",
            value: byStatus.overdue.toString(),
            accent: "border-red-500/20 bg-gray-800/50 text-white",
          },
        ].map((c) => (
          <div key={c.label} className={`rounded-xl border px-5 py-4 ${c.accent}`}>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-400">{c.label}</p>
            <p className="mt-1.5 text-xl font-bold">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Status pills */}
      <div className="flex gap-3">
        {(Object.entries(byStatus) as [InvoiceStatus, number][]).map(([status, count]) => (
          <span
            key={status}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLES[status]}`}
          >
            {count} {status}
          </span>
        ))}
      </div>

      {orders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 py-14 text-center">
          <p className="text-3xl mb-3">🧾</p>
          <p className="text-sm font-medium text-gray-300">No invoices yet</p>
          <p className="mt-1 text-xs text-gray-500">
            Invoices appear here once orders are confirmed
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-gray-800/60">
                {["Invoice ID", "Customer", "Amount", "Status", "Due Date"].map((h) => (
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
              {orders.map((o) => {
                const status = orderStatusToInvoice(o.status);
                return (
                  <tr key={o.id} className="hover:bg-white/2 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-400">
                      {o.id.slice(0, 8)}…
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {`${o.customerId.slice(0, 8)}…`}
                    </td>
                    <td className="px-4 py-3 font-medium text-white">
                      {formatThb(o.totalAmountInCents, o.currency)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[status]}`}
                      >
                        {status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{dueDate(o.placedAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="border-t border-white/10 bg-gray-800/40 px-4 py-3 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              {orders.length} invoice{orders.length !== 1 ? "s" : ""}
            </span>
            <span className="text-xs text-gray-400">
              Paid revenue:{" "}
              <span className="font-semibold text-emerald-400">
                {formatThb(totalRevenue, "THB")}
              </span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
