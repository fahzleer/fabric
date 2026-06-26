import { createMerchantApi } from "@/lib/merchant-api";
import type { PayoutRequest } from "@/lib/merchant-api";
import { isErr, isOk, isSome } from "@fabric/types";
import type { Metadata } from "next";
import { connection } from "next/server";
import { PayoutActionButtons } from "./_lib/payout-action-buttons";

export const metadata: Metadata = {
  title: "Payout Requests — Admin",
};

function formatBaht(cents: number): string {
  return `฿${(cents / 100).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: PayoutRequest["status"] }) {
  const styles: Record<PayoutRequest["status"], string> = {
    pending: "bg-warning/15 text-warning border-warning/30",
    approved: "bg-success/15 text-success border-success/30",
    rejected: "bg-destructive/15 text-destructive border-destructive/30",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export default async function AdminPayoutsPage() {
  await connection();

  const maybeApi = await createMerchantApi();
  if (!isSome(maybeApi)) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Unable to load payouts. Please refresh.</p>
      </div>
    );
  }
  const api = maybeApi.value;

  const result = await api.listAllPendingPayouts();
  const payouts = isOk(result) ? result.value : [];

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Payout requests</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pending withdrawal requests from merchants. Review and process manually.
          </p>
        </div>
        {payouts.length > 0 && (
          <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-2 text-center">
            <p className="text-2xl font-bold text-warning">{payouts.length}</p>
            <p className="text-xs text-warning/70">pending</p>
          </div>
        )}
      </div>

      {/* Error */}
      {isErr(result) && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Failed to load payout requests: {result.error}
        </div>
      )}

      {/* Empty state */}
      {isOk(result) && payouts.length === 0 && (
        <div className="rounded-xl border border-border bg-muted/30 px-5 py-12 text-center">
          <p className="text-2xl mb-2">💸</p>
          <p className="text-sm font-medium text-foreground">No pending payout requests</p>
          <p className="mt-1 text-xs text-muted-foreground">
            All caught up! Merchant withdrawals will appear here.
          </p>
        </div>
      )}

      {/* Payout table */}
      {payouts.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/60">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Submitted
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Merchant ID
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Amount
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Bank details
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card/30">
              {payouts.map((p) => (
                <tr key={p.id} className="hover:bg-muted/2 transition-colors">
                  <td className="px-4 py-4 text-foreground whitespace-nowrap text-xs">
                    {formatDate(p.requestedAt)}
                  </td>
                  <td className="px-4 py-4">
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                      {p.userId.slice(0, 12)}…
                    </code>
                  </td>
                  <td className="px-4 py-4 text-right font-semibold text-foreground whitespace-nowrap">
                    {formatBaht(p.amountCents)}
                  </td>
                  <td className="px-4 py-4 text-muted-foreground text-xs max-w-xs">
                    <span className="block truncate" title={p.bankInfo}>
                      {p.bankInfo}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="px-4 py-4">
                    <PayoutActionButtons requestId={p.id} ownerUserId={p.userId} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Summary footer */}
          <div className="border-t border-border bg-muted/40 px-4 py-3 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {payouts.length} pending request{payouts.length !== 1 ? "s" : ""}
            </span>
            <span className="text-xs font-medium text-foreground">
              Total: {formatBaht(payouts.reduce((sum, p) => sum + p.amountCents, 0))}
            </span>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="rounded-xl border border-border bg-muted/20 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Process checklist
        </h3>
        <ol className="space-y-1 text-xs text-muted-foreground list-decimal list-inside">
          <li>
            Verify merchant balance in Firebase console (
            <code className="text-muted-foreground">
              merchants/&#123;userId&#125;/totalRevenueCents
            </code>
            )
          </li>
          <li>Transfer the amount to the merchant's bank account manually</li>
          <li>
            Click <strong className="text-muted-foreground">Approve</strong> — this atomically
            increments <code className="text-muted-foreground">paidOutCents</code>
          </li>
          <li>
            If transfer fails or details are wrong, click{" "}
            <strong className="text-muted-foreground">Reject</strong> with a reason
          </li>
        </ol>
      </div>
    </div>
  );
}
