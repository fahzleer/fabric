"use client";

import { useMemo, useState } from "react";
import { type AttributionModel, MODEL_LABELS, computeAttribution } from "../_lib/attribution";
import { DEMO_JOURNEYS } from "../_lib/demo-data";

const CHANNEL_COLOR: Record<string, string> = {
  meta: "#1877F2",
  google: "#34A853",
  tiktok: "#000000",
  line_oa: "#06C755",
  shopee: "#EE4D2D",
};

const MODELS: AttributionModel[] = ["last_click", "first_click", "linear", "time_decay", "shapley"];

function pct(v: number) {
  return `${(v * 100).toFixed(1)}%`;
}

export function AttributionModeler() {
  const [journeysText, setJourneysText] = useState(
    DEMO_JOURNEYS.map((j) => j.join(" → ")).join("\n")
  );

  const result = useMemo(() => {
    const journeys = journeysText
      .split("\n")
      .map((line) =>
        line
          .split(/\s*→\s*|\s*>\s*|,\s*/)
          .map((c) => c.trim().toLowerCase())
          .filter(Boolean)
      )
      .filter((j) => j.length > 0);
    return journeys.length ? computeAttribution(journeys) : null;
  }, [journeysText]);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-2 text-sm font-semibold text-gray-700">Customer Journeys</h3>
        <p className="mb-3 text-xs text-gray-400">
          One journey per line. Channels separated by → or comma. Supported: meta, google, tiktok,
          line_oa, shopee
        </p>
        <textarea
          value={journeysText}
          onChange={(e) => setJourneysText(e.target.value)}
          rows={8}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {result && (
        <div className="space-y-4">
          {/* Model comparison table */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700">Attribution by Model</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-400">
                  <tr>
                    <th className="px-4 py-2 text-left">Channel</th>
                    {MODELS.map((m) => (
                      <th key={m} className="px-4 py-2 text-right">
                        {MODEL_LABELS[m]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {result.channels.map((ch) => (
                    <tr key={ch} className="hover:bg-gray-50">
                      <td className="px-4 py-2 flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: CHANNEL_COLOR[ch] ?? "#6B7280" }}
                        />
                        <span className="font-medium">{ch.replace("_", " ")}</span>
                      </td>
                      {MODELS.map((m) => (
                        <td key={m} className="px-4 py-2 text-right font-mono">
                          {pct(result.models[m][ch] ?? 0)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Visual comparison bars */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {MODELS.map((model) => {
              const vals = result.channels.map((ch) => ({
                ch,
                v: result.models[model][ch] ?? 0,
              }));
              const max = Math.max(...vals.map((v) => v.v), 0.01);
              return (
                <div
                  key={model}
                  className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                >
                  <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {MODEL_LABELS[model]}
                  </h4>
                  <div className="space-y-2">
                    {vals.map(({ ch, v }) => (
                      <div key={ch} className="flex items-center gap-2">
                        <span className="w-14 text-xs text-gray-500 truncate">{ch}</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-4 relative">
                          <div
                            className="absolute inset-y-0 left-0 rounded-full"
                            style={{
                              width: `${(v / max) * 100}%`,
                              backgroundColor: CHANNEL_COLOR[ch] ?? "#6B7280",
                            }}
                          />
                          {v > 0.05 && (
                            <span className="absolute inset-0 flex items-center px-1.5 text-xs text-white font-semibold">
                              {pct(v)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
            <p className="text-sm text-blue-900">
              <strong>Shapley Value</strong> is the game-theory–optimal fair attribution — it
              considers every possible channel combination. Compare it against Last-click to see how
              much credit shifts when you stop over-rewarding the final touchpoint.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
