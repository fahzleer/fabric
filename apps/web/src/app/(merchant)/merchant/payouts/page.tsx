import { createMerchantApi } from "@/lib/merchant-api";
import type { PayoutRequest } from "@/lib/merchant-api";
import { isErr, isOk, isSome } from "@fabric/types";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { RequestPayoutForm } from "./_lib/request-payout-form";

export const metadata: Metadata = {
  title: "Payouts — Merchant Portal",
};

function formatBaht(cents: number): string {
  return `฿${(cents / 100).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function StatusBadge({ status }: { status: PayoutRequest["status"] }) {
  const styles: Record<PayoutRequest["status"], string> = {
    pending: "bg-amber-500/15 text-amber-400  border border-amber-500/30",
    approved: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
    rejected: "bg-red-500/15 text-red-400  border border-red-500/30",
  };
  const labels: Record<PayoutRequest["status"], string> = {
    pending: "Pending",
    approved: "Approved",
    rejected: "Rejected",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function MerchantPayoutsPage() {
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

  const [balanceResult, payoutsResult] = await Promise.all([
    api.getPayoutBalance(),
    api.listPayouts(),
  ]);

  if (isErr(balanceResult) && balanceResult.error.startsWith("[MerchantNotFoundError]"))
    redirect("/merchant/onboarding");

  const balance = isOk(balanceResult) ? balanceResult.value : undefined;
  const payouts = isOk(payoutsResult) ? payoutsResult.value : [];

  const availableCents = balance?.availableBalanceCents ?? 0;
  const totalRevenueCents = balance?.totalRevenueCents ?? 0;
  const paidOutCents = balance?.paidOutCents ?? 0;
  const feePct = balance?.platformFeePct ?? 0.05;

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Payouts</h1>
        <p className="mt-1 text-sm text-gray-400">
          Withdraw your earnings. We review requests within 2 business days.
        </p>
      </div>

      {/* Balance card */}
      <div className="rounded-xl border border-white/10 bg-gray-800/50 p-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          Available to withdraw
        </p>
        <p className="mt-1 text-4xl font-bold text-emerald-400">
          {formatBaht(Math.max(0, availableCents))}
        </p>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-400">
          <span>
            Total revenue:{" "}
            <strong className="text-gray-300">{formatBaht(totalRevenueCents)}</strong>
          </span>
          <span>
            Platform fee: <strong className="text-gray-300">{(feePct * 100).toFixed(0)}%</strong>
          </span>
          <span>
            Already paid out: <strong className="text-gray-300">{formatBaht(paidOutCents)}</strong>
          </span>
        </div>
        {isErr(balanceResult) && (
          <p className="mt-2 text-xs text-red-400">Could not load balance: {balanceResult.error}</p>
        )}
      </div>

      {/* Request withdrawal */}
      <div className="rounded-xl border border-white/10 bg-gray-800/50 p-6">
        <h2 className="text-base font-semibold text-white mb-4">Request withdrawal</h2>
        <RequestPayoutForm availableBalanceCents={Math.max(0, availableCents)} />
      </div>

      {/* Payout history */}
      <div>
        <h2 className="text-base font-semibold text-white mb-3">Withdrawal history</h2>

        {payouts.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-gray-800/30 px-5 py-8 text-center text-sm text-gray-500">
            No withdrawal requests yet.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-white/10">
            <table className="w-full text-sm">
              <thead className="border-b border-white/10 bg-gray-800/60">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Date
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Bank
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Note
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 bg-gray-900/30">
                {payouts.map((p) => (
                  <tr key={p.id} className="hover:bg-white/2 transition-colors">
                    <td className="px-4 py-3 text-gray-300 whitespace-nowrap">
                      {formatDate(p.requestedAt)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-white whitespace-nowrap">
                      {formatBaht(p.amountCents)}
                    </td>
                    <td className="px-4 py-3 text-gray-400 max-w-xs truncate" title={p.bankInfo}>
                      {p.bankInfo}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{p.adminNote ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
