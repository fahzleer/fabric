import { formatPrice } from "@/lib/price";
import { connection } from "next/server";
import { InvoiceActions } from "./_lib/invoice-actions";
import { getInvoices } from "./_lib/queries";
import type { InvoiceStatus } from "./_lib/types";

const statusStyles: Record<InvoiceStatus, string> = {
  paid: "bg-success/20 text-success",
  pending: "bg-warning/20 text-warning",
  overdue: "bg-destructive/20 text-destructive",
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
        <h1 className="text-2xl font-bold text-foreground">Invoices</h1>
        <p className="mt-1 text-sm text-muted-foreground">
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
        <div className="rounded-xl border border-border bg-card/30 px-6 py-12 text-center text-sm text-muted-foreground">
          No confirmed orders yet. Invoices appear here once orders are confirmed.
        </div>
      ) : (
        /* Invoice table */
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Invoice ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Customer
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Amount
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Due Date
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {invoices.map((inv) => (
                <tr key={inv.id} className="bg-card/30 transition-colors hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono text-xs text-foreground">{inv.id}</td>
                  <td className="px-4 py-3 text-foreground">{inv.customerEmail}</td>
                  <td className="px-4 py-3 text-right font-medium text-foreground">
                    {formatPrice({ amount: inv.amountCents / 100, currency: inv.currency })}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusStyles[inv.status]}`}
                    >
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(inv.dueAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <InvoiceActions invoice={inv} />
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
