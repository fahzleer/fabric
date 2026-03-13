import { formatPrice } from "@/lib/price";
import { connection } from "next/server";
import { getInvoices } from "./_lib/queries";
import type { InvoiceStatus } from "./_lib/types";

const statusStyles: Record<InvoiceStatus, string> = {
  paid: "bg-emerald-500/20 text-emerald-300",
  pending: "bg-amber-500/20 text-amber-300",
  overdue: "bg-red-500/20 text-red-300",
};

export default async function InvoicesPage() {
  await connection();
  const invoices = await getInvoices();

  const totalByStatus = invoices.reduce(
    (acc, inv) => {
      acc[inv.status] = (acc[inv.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<InvoiceStatus, number>
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Invoices</h1>
        <p className="mt-1 text-sm text-gray-400">
          {invoices.length} invoice{invoices.length !== 1 ? "s" : ""} from confirmed orders
        </p>
      </div>

      {/* Summary pills */}
      <div className="flex gap-3">
        {(Object.entries(totalByStatus) as [InvoiceStatus, number][]).map(([status, count]) => (
          <span
            key={status}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[status]}`}
          >
            {count} {status}
          </span>
        ))}
      </div>

      {invoices.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-gray-900/30 px-6 py-12 text-center text-sm text-gray-400">
          No confirmed orders yet. Invoices appear here once orders are confirmed.
        </div>
      ) : (
        /* Invoice table */
        <div className="overflow-hidden rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-gray-800/50">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400">
                  Invoice ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400">
                  Customer
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-400">
                  Amount
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-400">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400">
                  Due Date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {invoices.map((inv) => (
                <tr key={inv.id} className="bg-gray-900/30 transition-colors hover:bg-gray-800/30">
                  <td className="px-4 py-3 font-mono text-xs text-gray-300">{inv.id}</td>
                  <td className="px-4 py-3 text-gray-200">{inv.customerEmail}</td>
                  <td className="px-4 py-3 text-right font-medium text-white">
                    {formatPrice({ amount: inv.amountCents / 100, currency: inv.currency })}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusStyles[inv.status]}`}
                    >
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {new Date(inv.dueAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
