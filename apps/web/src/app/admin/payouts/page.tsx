import { createMerchantApi } from "@/lib/merchant-api";
import type { PayoutRequest } from "@/lib/merchant-api";
import { isSome } from "@fabric/types";
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
    pending: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    approved: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    rejected: "bg-red-500/15 text-red-400 border-red-500/30",
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
        <p className="text-gray-400">Unable to load payouts. Please refresh.</p>
      </div>
    );
  }
  const api = maybeApi.value;

  const result = await api.listAllPendingPayouts();
  const payouts = result.ok ? result.value : [];

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Payout requests</h1>
          <p className="mt-1 text-sm text-gray-400">
            Pending withdrawal requests from merchants. Review and process manually.
          </p>
        </div>
        {payouts.length > 0 && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center">
            <p className="text-2xl font-bold text-amber-400">{payouts.length}</p>
            <p className="text-xs text-amber-400/70">pending</p>
          </div>
        )}
      </div>

      {/* Error */}
      {!result.ok && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          Failed to load payout requests: {result.error}
        </div>
      )}

      {/* Empty state */}
      {result.ok && payouts.length === 0 && (
        <div className="rounded-xl border border-white/10 bg-gray-800/30 px-5 py-12 text-center">
          <p className="text-2xl mb-2">💸</p>
          <p className="text-sm font-medium text-gray-300">No pending payout requests</p>
          <p className="mt-1 text-xs text-gray-500">
            All caught up! Merchant withdrawals will appear here.
          </p>
        </div>
      )}

      {/* Payout table */}
      {payouts.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead className="border-b border-white/10 bg-gray-800/60">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Submitted
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Merchant ID
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Amount
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Bank details
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 bg-gray-900/30">
              {payouts.map((p) => (
                <tr key={p.id} className="hover:bg-white/2 transition-colors">
                  <td className="px-4 py-4 text-gray-300 whitespace-nowrap text-xs">
                    {formatDate(p.requestedAt)}
                  </td>
                  <td className="px-4 py-4">
                    <code className="rounded bg-gray-800 px-1.5 py-0.5 text-xs text-gray-400">
                      {p.userId.slice(0, 12)}…
                    </code>
                  </td>
                  <td className="px-4 py-4 text-right font-semibold text-white whitespace-nowrap">
                    {formatBaht(p.amountCents)}
                  </td>
                  <td className="px-4 py-4 text-gray-400 text-xs max-w-xs">
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
          <div className="border-t border-white/10 bg-gray-800/40 px-4 py-3 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              {payouts.length} pending request{payouts.length !== 1 ? "s" : ""}
            </span>
            <span className="text-xs font-medium text-gray-300">
              Total: {formatBaht(payouts.reduce((sum, p) => sum + p.amountCents, 0))}
            </span>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="rounded-xl border border-white/10 bg-gray-800/20 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
          Process checklist
        </h3>
        <ol className="space-y-1 text-xs text-gray-500 list-decimal list-inside">
          <li>
            Verify merchant balance in Firebase console (
            <code className="text-gray-400">merchants/&#123;userId&#125;/totalRevenueCents</code>)
          </li>
          <li>Transfer the amount to the merchant's bank account manually</li>
          <li>
            Click <strong className="text-gray-400">Approve</strong> — this atomically increments{" "}
            <code className="text-gray-400">paidOutCents</code>
          </li>
          <li>
            If transfer fails or details are wrong, click{" "}
            <strong className="text-gray-400">Reject</strong> with a reason
          </li>
        </ol>
      </div>
    </div>
  );
}
