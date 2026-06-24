"use client";

import { useMemo } from "react";
import { generateDemoOrders } from "../_lib/demo-data";
import { type RFMSegment, computeRFM } from "../_lib/rfm";

const SEGMENT_COLOR: Record<RFMSegment, { bg: string; text: string }> = {
  Champions: { bg: "bg-emerald-500", text: "text-white" },
  "Loyal Customers": { bg: "bg-blue-500", text: "text-white" },
  "Potential Loyalists": { bg: "bg-sky-400", text: "text-white" },
  "Recent Customers": { bg: "bg-teal-400", text: "text-white" },
  Promising: { bg: "bg-lime-400", text: "text-gray-900" },
  "Customers Needing Attention": { bg: "bg-yellow-400", text: "text-gray-900" },
  "At Risk": { bg: "bg-orange-400", text: "text-white" },
  "Cannot Lose Them": { bg: "bg-red-500", text: "text-white" },
  Hibernating: { bg: "bg-gray-400", text: "text-white" },
  Lost: { bg: "bg-gray-600", text: "text-white" },
};

function ScoreDots({ score }: { score: number }) {
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={`h-2 w-2 rounded-full ${i <= score ? "bg-blue-500" : "bg-gray-200"}`}
        />
      ))}
    </span>
  );
}

export function RFMSegmentation() {
  const { customers, segmentCounts } = useMemo(() => computeRFM(generateDemoOrders()), []);

  const total = customers.length;
  const segments = Object.entries(segmentCounts).sort((a, b) => b[1] - a[1]) as [
    RFMSegment,
    number,
  ][];

  return (
    <div className="space-y-6">
      {/* Segment overview */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Segment Breakdown
        </h3>
        <div className="space-y-2">
          {segments.map(([seg, count]) => {
            const pct = (count / total) * 100;
            const style = SEGMENT_COLOR[seg];
            return (
              <div key={seg} className="flex items-center gap-3">
                <div className="w-44 shrink-0 text-xs font-medium text-gray-700 truncate">
                  {seg}
                </div>
                <div className="flex-1 bg-gray-100 rounded-full h-5 relative">
                  <div
                    className={`absolute inset-y-0 left-0 rounded-full ${style.bg}`}
                    style={{ width: `${Math.max(pct, 2)}%` }}
                  />
                  <span
                    className={`absolute inset-0 flex items-center px-2 text-xs font-semibold ${pct > 15 ? style.text : "text-gray-700"}`}
                  >
                    {count} customers ({pct.toFixed(0)}%)
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Customer table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">Customer RFM Scores</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-400">
              <tr>
                <th className="px-4 py-2 text-left">Customer</th>
                <th className="px-4 py-2 text-center">R-Score</th>
                <th className="px-4 py-2 text-center">F-Score</th>
                <th className="px-4 py-2 text-center">M-Score</th>
                <th className="px-4 py-2 text-right">Recency</th>
                <th className="px-4 py-2 text-right">Orders</th>
                <th className="px-4 py-2 text-center">Segment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {customers.slice(0, 20).map((c) => {
                const style = SEGMENT_COLOR[c.segment];
                return (
                  <tr key={c.userId} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono text-xs text-gray-700">{c.userId}</td>
                    <td className="px-4 py-2">
                      <div className="flex justify-center">
                        <ScoreDots score={c.rScore} />
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex justify-center">
                        <ScoreDots score={c.fScore} />
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex justify-center">
                        <ScoreDots score={c.mScore} />
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right text-gray-600">
                      {Math.round(c.recencyDays)}d ago
                    </td>
                    <td className="px-4 py-2 text-right">{c.frequency}</td>
                    <td className="px-4 py-2 text-center">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${style.bg} ${style.text}`}
                      >
                        {c.segment}
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
