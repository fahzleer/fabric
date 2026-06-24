"use client";

import { useMemo, useState } from "react";
import { DEMO_FUNNEL } from "../_lib/demo-data";
import { type FunnelStage, computeFunnel } from "../_lib/funnel";

const STAGE_COLORS = [
  "bg-blue-600",
  "bg-blue-500",
  "bg-blue-400",
  "bg-blue-300",
  "bg-blue-200",
  "bg-indigo-500",
  "bg-indigo-400",
  "bg-indigo-300",
];

export function FunnelAnalyzer() {
  const [stages, setStages] = useState<FunnelStage[]>(DEMO_FUNNEL);
  const [editMode, setEditMode] = useState(false);
  const [rawText, setRawText] = useState(
    DEMO_FUNNEL.map((s) => `${s.stage}\t${s.users}`).join("\n")
  );

  const result = useMemo(() => {
    try {
      return computeFunnel(stages);
    } catch {
      return null;
    }
  }, [stages]);

  const applyEdit = () => {
    const parsed = rawText
      .trim()
      .split("\n")
      .map((line) => {
        const parts = line.split(/\t|,/).map((p) => p.trim());
        const users = Number.parseInt(parts[parts.length - 1] ?? "");
        const stage = parts.slice(0, -1).join(" ") || `Stage ${line}`;
        return Number.isNaN(users) ? null : { stage, users };
      })
      .filter((s): s is FunnelStage => s !== null);
    if (parsed.length >= 2) setStages(parsed);
    setEditMode(false);
  };

  const topUsers = stages[0]?.users ?? 1;

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        {editMode ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setEditMode(false)}
              className="rounded-lg border border-gray-300 px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={applyEdit}
              className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700"
            >
              Apply
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditMode(true)}
            className="rounded-lg border border-gray-300 px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
          >
            Edit Stages
          </button>
        )}
      </div>

      {editMode && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="mb-2 text-xs text-gray-400">
            Stage name, then tab or comma, then user count. One stage per line.
          </p>
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            rows={7}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      )}

      {result && (
        <>
          {/* Funnel visual */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="space-y-2">
              {result.steps.map((step, i) => {
                const widthPct = (step.users / topUsers) * 100;
                const color = STAGE_COLORS[i % STAGE_COLORS.length];
                return (
                  <div key={step.stage}>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="w-44 shrink-0 text-sm font-medium text-gray-700 truncate">
                        {step.stage}
                      </span>
                      <div className="flex-1">
                        <div
                          className={`h-10 rounded ${color} flex items-center px-3 transition-all`}
                          style={{ width: `${Math.max(widthPct, 5)}%` }}
                        >
                          <span className="text-white text-sm font-semibold whitespace-nowrap">
                            {step.users.toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <span className="w-16 text-right text-sm font-mono text-gray-500">
                        {step.conversionFromTop}%
                      </span>
                    </div>
                    {step.dropOffPct !== null && (
                      <div className="ml-44 flex items-center gap-2 mb-1">
                        <span className="text-xs text-red-500">
                          ↓ {step.dropOff.toLocaleString()} dropped ({step.dropOffPct}%)
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-gray-200 bg-white p-5 text-center shadow-sm">
              <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">
                Overall Conversion
              </p>
              <p className="text-3xl font-bold text-gray-900">{result.overallConversion}%</p>
            </div>
            <div className="rounded-xl border border-red-100 bg-red-50 p-5 text-center shadow-sm">
              <p className="text-xs uppercase tracking-wide text-red-400 mb-1">Biggest Drop-off</p>
              <p className="text-lg font-bold text-red-700">{result.biggestDropStage}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-5 text-center shadow-sm">
              <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">Total Stages</p>
              <p className="text-3xl font-bold text-gray-900">{result.steps.length}</p>
            </div>
          </div>

          {/* Step-by-step table */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-400">
                  <tr>
                    <th className="px-4 py-2 text-left">Stage</th>
                    <th className="px-4 py-2 text-right">Users</th>
                    <th className="px-4 py-2 text-right">Conv. from prev</th>
                    <th className="px-4 py-2 text-right">Conv. from top</th>
                    <th className="px-4 py-2 text-right">Drop-off</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {result.steps.map((step) => (
                    <tr key={step.stage} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium">{step.stage}</td>
                      <td className="px-4 py-2 text-right">{step.users.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right">
                        {step.conversionFromPrev !== null ? `${step.conversionFromPrev}%` : "—"}
                      </td>
                      <td className="px-4 py-2 text-right">{step.conversionFromTop}%</td>
                      <td className="px-4 py-2 text-right text-red-500">
                        {step.dropOffPct !== null ? `-${step.dropOffPct}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
