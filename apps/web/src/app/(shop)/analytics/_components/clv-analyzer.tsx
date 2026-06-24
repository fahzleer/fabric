"use client";

import { useMemo } from "react";
import { computeCLV } from "../_lib/clv";
import { generateDemoOrders } from "../_lib/demo-data";

const SEGMENT_STYLE = {
  high: { bg: "bg-emerald-100", text: "text-emerald-800", label: "High Value" },
  medium: { bg: "bg-amber-100", text: "text-amber-800", label: "Medium" },
  low: { bg: "bg-gray-100", text: "text-gray-600", label: "Low Value" },
};

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm text-center">
      <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export function CLVAnalyzer() {
  const result = useMemo(() => computeCLV(generateDemoOrders()), []);

  const fmt = (n: number) =>
    n >= 1000 ? `฿${(n / 1000).toFixed(1)}k` : `฿${Math.round(n).toLocaleString()}`;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Avg Predicted CLV (12m)" value={fmt(result.avgCLV)} />
        <StatCard
          label="Total Predicted LTV"
          value={fmt(result.totalPredictedLTV)}
          sub={`${result.customers.length} customers`}
        />
        <StatCard label="High Value" value={String(result.highValueCount)} sub="≥฿4,000 CLV" />
        <StatCard
          label="At Risk (Low CLV)"
          value={String(result.lowValueCount)}
          sub="<฿1,500 CLV"
        />
      </div>

      {/* Distribution bar */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          CLV Segment Distribution
        </h3>
        <div className="flex h-8 rounded-full overflow-hidden">
          {(["high", "medium", "low"] as const).map((seg) => {
            const count =
              seg === "high"
                ? result.highValueCount
                : seg === "medium"
                  ? result.mediumValueCount
                  : result.lowValueCount;
            const pct = (count / result.customers.length) * 100;
            const bg =
              seg === "high" ? "bg-emerald-500" : seg === "medium" ? "bg-amber-400" : "bg-gray-300";
            return (
              <div
                key={seg}
                className={`${bg} flex items-center justify-center text-xs font-semibold text-white`}
                style={{ width: `${pct}%` }}
              >
                {pct > 8 ? `${Math.round(pct)}%` : ""}
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex gap-4 text-xs text-gray-500">
          <span>
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-500 mr-1" />
            High (≥฿4k)
          </span>
          <span>
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-amber-400 mr-1" />
            Medium (฿1.5k–4k)
          </span>
          <span>
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-gray-300 mr-1" />
            Low (&lt;฿1.5k)
          </span>
        </div>
      </div>

      {/* Customer table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">
            Top Customers by Predicted 12m CLV
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-400">
              <tr>
                <th className="px-4 py-2 text-left">Customer</th>
                <th className="px-4 py-2 text-right">Historical CLV</th>
                <th className="px-4 py-2 text-right">Predicted 12m CLV</th>
                <th className="px-4 py-2 text-right">AOV</th>
                <th className="px-4 py-2 text-right">Orders/mo</th>
                <th className="px-4 py-2 text-center">Segment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {result.customers.slice(0, 15).map((c) => {
                const style = SEGMENT_STYLE[c.segment];
                return (
                  <tr key={c.userId} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono text-xs text-gray-700">{c.userId}</td>
                    <td className="px-4 py-2 text-right">{fmt(c.historicalCLV)}</td>
                    <td className="px-4 py-2 text-right font-semibold">{fmt(c.predicted12mCLV)}</td>
                    <td className="px-4 py-2 text-right">{fmt(c.avgOrderValue)}</td>
                    <td className="px-4 py-2 text-right">{c.frequencyPerMonth.toFixed(2)}</td>
                    <td className="px-4 py-2 text-center">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${style.bg} ${style.text}`}
                      >
                        {style.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
