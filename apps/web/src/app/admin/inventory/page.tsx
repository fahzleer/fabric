import { formatPrice } from "@/lib/price";
import { connection } from "next/server";
import { getAuditSummary, getInventoryBalances } from "./_lib/queries";

const auditTypeLabels: Record<string, string> = {
  spot_10pct: "Spot 10%",
  full_50pct: "Full 50%",
  full_100pct: "Full 100%",
};

const auditTypeBg: Record<string, string> = {
  spot_10pct: "bg-sky-500/20 text-sky-300",
  full_50pct: "bg-violet-500/20 text-violet-300",
  full_100pct: "bg-amber-500/20 text-amber-300",
};

type BalanceRow = Awaited<ReturnType<typeof getInventoryBalances>>[number];

function VarianceCell({ units }: { units: number | string }) {
  const variance = Number(units);
  const colour =
    variance < 0 ? "text-red-400" : variance > 0 ? "text-emerald-400" : "text-gray-400";
  return (
    <span className={`font-semibold ${colour}`}>
      {variance > 0 ? "+" : ""}
      {variance}
    </span>
  );
}

function AuditDateCell({
  auditedAt,
  auditType,
}: {
  auditedAt: string | Date;
  auditType: string | undefined;
}) {
  return (
    <div>
      <p className="text-xs">
        {new Date(auditedAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}
      </p>
      {auditType && (
        <span
          className={`mt-0.5 inline-flex rounded-full px-1.5 py-0.5 text-xs font-medium ${
            auditTypeBg[auditType] ?? "bg-gray-700 text-gray-300"
          }`}
        >
          {auditTypeLabels[auditType] ?? auditType}
        </span>
      )}
    </div>
  );
}

function InventoryRow({ row }: { row: BalanceRow }) {
  const variance = Number(row.last_variance_units ?? 0);
  const varianceBaht = Number(row.last_variance_baht ?? 0);
  const hasShrinkage = variance < 0;

  return (
    <tr
      className={`transition-colors ${
        hasShrinkage ? "bg-red-950/30 hover:bg-red-900/20" : "bg-gray-900/30 hover:bg-gray-800/30"
      }`}
    >
      <td className="px-4 py-3">
        <p className="font-medium text-white">{row.product_name}</p>
        <p className="text-xs text-gray-500 font-mono">{row.product_id.slice(0, 8)}…</p>
      </td>
      <td className="px-4 py-3 text-gray-300">{Number(row.total_received).toLocaleString()}</td>
      <td className="px-4 py-3 text-gray-300">{Number(row.total_sold).toLocaleString()}</td>
      <td className="px-4 py-3 font-semibold text-white">
        {Number(row.expected_on_hand).toLocaleString()}
      </td>
      <td className="px-4 py-3 text-gray-300">
        {row.last_counted_quantity !== null ? (
          Number(row.last_counted_quantity).toLocaleString()
        ) : (
          <span className="text-gray-600 text-xs">not audited</span>
        )}
      </td>
      <td className="px-4 py-3">
        {row.last_variance_units !== null ? (
          <VarianceCell units={row.last_variance_units} />
        ) : (
          <span className="text-gray-600 text-xs">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        {hasShrinkage ? (
          <span className="font-semibold text-red-400">
            {formatPrice({ amount: varianceBaht, currency: row.currency })}
          </span>
        ) : (
          <span className="text-gray-600 text-xs">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-gray-400">
        {row.last_audited_at ? (
          <AuditDateCell
            auditedAt={row.last_audited_at}
            auditType={row.last_audit_type ?? undefined}
          />
        ) : (
          <span className="text-xs text-gray-600">never</span>
        )}
      </td>
    </tr>
  );
}

export default async function InventoryPage() {
  await connection();

  const [balances, auditSummary] = await Promise.all([getInventoryBalances(), getAuditSummary()]);

  const totalExpected = balances.reduce((sum, r) => sum + Number(r.expected_on_hand), 0);
  const totalVarianceBaht = balances.reduce(
    (sum, r) => sum + Math.abs(Number(r.last_variance_baht ?? 0)),
    0
  );
  const shrinkageItems = balances.filter((r) => Number(r.last_variance_units ?? 0) < 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Inventory Control</h1>
        <p className="mt-1 text-sm text-gray-400">
          Running balance · Shrinkage detection · Audit variance report
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          {
            label: "Products tracked",
            value: balances.length.toLocaleString(),
            note: "with at least one receipt",
          },
          {
            label: "Total on hand (expected)",
            value: `${totalExpected.toLocaleString()} units`,
            note: "received − sold",
          },
          {
            label: "Shrinkage (90d)",
            value:
              shrinkageItems.length > 0
                ? formatPrice({ amount: totalVarianceBaht, currency: "THB" })
                : "฿0",
            note: `${shrinkageItems.length} product${shrinkageItems.length !== 1 ? "s" : ""} with variance`,
            danger: shrinkageItems.length > 0,
          },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-white/10 bg-gray-800/50 px-6 py-5"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
              {card.label}
            </p>
            <p
              className={`mt-2 text-3xl font-bold ${
                "danger" in card && card.danger ? "text-red-400" : "text-white"
              }`}
            >
              {card.value}
            </p>
            <p className="mt-1 text-xs text-gray-500">{card.note}</p>
          </div>
        ))}
      </div>

      {/* Audit summary pills */}
      {auditSummary.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {auditSummary.map((a) => (
            <div
              key={a.audit_type}
              className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold ${auditTypeBg[a.audit_type] ?? "bg-gray-700 text-gray-300"}`}
            >
              <span>{auditTypeLabels[a.audit_type] ?? a.audit_type}</span>
              <span className="opacity-70">·</span>
              <span>{Number(a.total_audits).toLocaleString()} audits</span>
              {Number(a.total_variance_units) < 0 && (
                <>
                  <span className="opacity-70">·</span>
                  <span className="text-red-300">{Number(a.total_variance_units)} units lost</span>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Inventory balance table */}
      {balances.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-gray-900/30 px-6 py-16 text-center text-sm text-gray-500">
          No inventory receipts yet. Use{" "}
          <code className="rounded bg-gray-800 px-1.5 py-0.5 text-xs text-gray-300">
            POST /inventory/receipts
          </code>{" "}
          to record your first delivery.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-gray-800/50">
                {[
                  "Product",
                  "Received",
                  "Sold",
                  "Expected",
                  "Last Count",
                  "Variance",
                  "฿ Shrinkage",
                  "Last Audit",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {balances.map((row) => (
                <InventoryRow key={`${row.product_id}-${row.store_id}`} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* How it works */}
      <div className="rounded-xl border border-white/5 bg-gray-900/20 p-6">
        <h2 className="mb-4 text-sm font-semibold text-gray-300">How inventory control works</h2>
        <ol className="space-y-2 text-sm text-gray-400">
          <li>
            <span className="font-medium text-white">1. Receive stock</span> — Staff counts delivery
            blind (no pre-disclosed quantity) and submits via{" "}
            <code className="text-xs text-gray-300">POST /inventory/receipts</code>. Running balance
            = Σ received − Σ sold.
          </li>
          <li>
            <span className="font-medium text-white">2. Spot check (10%)</span> — Random unannounced
            count of 10% of SKUs monthly.
          </li>
          <li>
            <span className="font-medium text-white">3. Periodic audit (50%)</span> — Half the SKU
            list counted every cycle.
          </li>
          <li>
            <span className="font-medium text-white">4. Full count (100%)</span> — Store closed, all
            items counted every 2–3 months.
          </li>
          <li>
            <span className="font-medium text-white">5. Variance ← shrinkage</span> — Negative
            variance = shrinkage. Charge charged_amount ÷ employee split, no compromise via{" "}
            <code className="text-xs text-gray-300">POST /inventory/shrinkage-charges</code>.
          </li>
        </ol>
      </div>
    </div>
  );
}
