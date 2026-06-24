"use client";

import { useMemo } from "react";
import { computeCohort } from "../_lib/cohort";
import { generateDemoOrders } from "../_lib/demo-data";

function cellColor(pct: number | null): string {
  if (pct === null) return "bg-gray-50 text-gray-300";
  if (pct === 100) return "bg-blue-600 text-white";
  if (pct >= 60) return "bg-blue-400 text-white";
  if (pct >= 40) return "bg-blue-200 text-blue-900";
  if (pct >= 20) return "bg-blue-100 text-blue-800";
  return "bg-gray-100 text-gray-500";
}

export function CohortGrid() {
  const { rows, periods, avgRetention } = useMemo(() => computeCohort(generateDemoOrders()), []);

  const visiblePeriods = Math.min(periods, 8);
  const periodData = Array.from({ length: visiblePeriods }, (_, i) => ({
    label: `M${i}`,
    idx: i,
    avgValue: avgRetention[i] ?? 0,
  }));

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="mb-1 text-sm font-semibold text-gray-700">Avg Retention by Month</h3>
        <p className="mb-4 text-xs text-gray-400">
          Average across all cohorts. Month 0 = acquisition month.
        </p>
        <div className="flex gap-2 items-end h-24">
          {periodData.map(({ label, avgValue }) => (
            <div key={label} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-xs font-semibold text-gray-600">{avgValue}%</span>
              <div
                className="w-full rounded-t bg-blue-500"
                style={{ height: `${(avgValue / 100) * 80}px` }}
              />
              <span className="text-xs text-gray-400">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">Cohort Retention Matrix</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            % of cohort still purchasing in each month after first purchase
          </p>
        </div>
        <div className="overflow-x-auto p-4">
          <table className="text-xs border-collapse">
            <thead>
              <tr>
                <th className="px-3 py-2 text-left text-gray-500 font-medium whitespace-nowrap">
                  Cohort
                </th>
                <th className="px-3 py-2 text-right text-gray-500 font-medium">Size</th>
                {periodData.map(({ label }) => (
                  <th key={label} className="px-2 py-2 text-center text-gray-400 font-medium w-16">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.cohortLabel}>
                  <td className="px-3 py-1.5 font-medium text-gray-700 whitespace-nowrap">
                    {row.cohortLabel}
                  </td>
                  <td className="px-3 py-1.5 text-right text-gray-500">{row.cohortSize}</td>
                  {periodData.map(({ label, idx }) => {
                    const v = row.retention[idx] ?? null;
                    return (
                      <td
                        key={label}
                        className={`px-2 py-1.5 text-center rounded font-semibold ${cellColor(v)}`}
                      >
                        {v !== null ? `${v}%` : "·"}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className="border-t-2 border-gray-200 bg-gray-50">
                <td className="px-3 py-2 font-semibold text-gray-700">Average</td>
                <td className="px-3 py-2" />
                {periodData.map(({ label, avgValue }) => (
                  <td
                    key={label}
                    className={`px-2 py-2 text-center font-bold ${cellColor(avgValue)}`}
                  >
                    {avgValue}%
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
