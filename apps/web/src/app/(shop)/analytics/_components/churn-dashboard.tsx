"use client";

import { useMemo } from "react";
import { computeChurn } from "../_lib/churn";
import { generateDemoOrders } from "../_lib/demo-data";

function RiskBadge({ level }: { level: "high" | "medium" | "low" }) {
  const styles = {
    high: "bg-red-100 text-red-700",
    medium: "bg-amber-100 text-amber-700",
    low: "bg-green-100 text-green-700",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${styles[level]}`}>
      {level.charAt(0).toUpperCase() + level.slice(1)} Risk
    </span>
  );
}

function ProbBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = value >= 0.65 ? "bg-red-500" : value >= 0.35 ? "bg-amber-400" : "bg-green-400";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-2">
        <div className={`${color} h-2 rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono w-8 text-right text-gray-600">{pct}%</span>
    </div>
  );
}

export function ChurnDashboard() {
  const result = useMemo(() => computeChurn(generateDemoOrders()), []);

  const fmt = (n: number) => `฿${Math.round(n).toLocaleString()}`;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5 text-center shadow-sm">
          <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">Avg Churn Risk</p>
          <p className="text-2xl font-bold text-gray-900">
            {(result.avgChurnRate * 100).toFixed(1)}%
          </p>
        </div>
        <div className="rounded-xl border border-red-100 bg-red-50 p-5 text-center shadow-sm">
          <p className="text-xs uppercase tracking-wide text-red-400 mb-1">High Risk</p>
          <p className="text-2xl font-bold text-red-700">{result.highRiskCount}</p>
          <p className="text-xs text-red-400">customers (≥65%)</p>
        </div>
        <div className="rounded-xl border border-amber-100 bg-amber-50 p-5 text-center shadow-sm">
          <p className="text-xs uppercase tracking-wide text-amber-500 mb-1">Medium Risk</p>
          <p className="text-2xl font-bold text-amber-700">{result.mediumRiskCount}</p>
          <p className="text-xs text-amber-400">customers (35–65%)</p>
        </div>
        <div className="rounded-xl border border-red-100 bg-white p-5 text-center shadow-sm">
          <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">Revenue at Risk</p>
          <p className="text-2xl font-bold text-red-600">{fmt(result.predictedRevenueAtRisk)}</p>
          <p className="text-xs text-gray-400">from high-risk customers</p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">Customers by Churn Risk</h3>
          <span className="text-xs text-gray-400">Sorted by risk (highest first)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-400">
              <tr>
                <th className="px-4 py-2 text-left">Customer</th>
                <th className="px-4 py-2 text-left w-48">Churn Probability</th>
                <th className="px-4 py-2 text-right">Days Inactive</th>
                <th className="px-4 py-2 text-right">Orders</th>
                <th className="px-4 py-2 text-left">Top Reason</th>
                <th className="px-4 py-2 text-center">Risk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {result.customers.slice(0, 20).map((c) => (
                <tr key={c.userId} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-mono text-xs text-gray-700">{c.userId}</td>
                  <td className="px-4 py-2 w-48">
                    <ProbBar value={c.churnProbability} />
                  </td>
                  <td className="px-4 py-2 text-right text-gray-600">
                    {Math.round(c.daysSinceLast)}d
                  </td>
                  <td className="px-4 py-2 text-right">{c.orderCount}</td>
                  <td className="px-4 py-2 text-xs text-gray-500 max-w-xs truncate">
                    {c.topReason}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <RiskBadge level={c.riskLevel} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
