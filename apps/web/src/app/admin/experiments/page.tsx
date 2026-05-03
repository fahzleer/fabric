import { getExperimentStats, listExperiments } from "@/lib/ab-testing";
import type { Metadata } from "next";
import { connection } from "next/server";
import { ExperimentActions } from "./_components/experiment-actions";

export const metadata: Metadata = { title: "A/B Experiments — Admin" };

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-gray-700/50 text-gray-400 border-gray-600",
  running: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  paused: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  completed: "bg-blue-500/20 text-blue-300 border-blue-500/40",
};

export default async function ExperimentsPage() {
  await connection();

  const experiments = await listExperiments();
  const stats = await Promise.all(experiments.map((e) => getExperimentStats(e.id)));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">A/B Experiments</h1>
        <p className="mt-1 text-sm text-gray-400">
          Monitor running experiments and conversion rates
        </p>
      </div>

      {experiments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 bg-gray-800/30 p-12 text-center">
          <p className="text-gray-400">No experiments yet</p>
        </div>
      ) : (
        <div className="space-y-6">
          {stats.map((s) => {
            if (!s) return null;
            const { experiment: exp, variants, totalImpressions, winner } = s;
            const badgeCls = STATUS_BADGE[exp.status] ?? STATUS_BADGE.draft;

            return (
              <div
                key={exp.id}
                className="rounded-xl border border-white/10 bg-gray-800/50 p-6 space-y-5"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-lg font-semibold text-white">{exp.name}</h2>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${badgeCls}`}
                      >
                        {exp.status}
                      </span>
                      {winner && exp.status === "running" && (
                        <span className="rounded-full border border-emerald-500/40 bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-300">
                          Leading: {variants.find((v) => v.variant.id === winner)?.variant.name}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-gray-400">{exp.description}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      Goal: <span className="text-gray-400">{exp.goal}</span> ·{" "}
                      {totalImpressions.toLocaleString()} total impressions
                    </p>
                  </div>
                  <ExperimentActions experimentId={exp.id} currentStatus={exp.status} />
                </div>

                {/* Variant bars */}
                <div className="grid gap-3 sm:grid-cols-2">
                  {variants.map(({ variant, impressions, conversions, conversionRate }) => {
                    const pct = Math.round(conversionRate * 1000) / 10;
                    const isWinner = variant.id === winner;
                    return (
                      <div
                        key={variant.id}
                        className={`rounded-lg border p-4 ${
                          isWinner
                            ? "border-emerald-500/40 bg-emerald-500/10"
                            : "border-white/10 bg-gray-900/40"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-white">{variant.name}</span>
                          <span className="text-xs text-gray-400 capitalize">{variant.id}</span>
                        </div>
                        <div className="mt-2 flex items-end gap-4">
                          <div>
                            <p className="text-2xl font-bold text-white">{pct}%</p>
                            <p className="text-xs text-gray-500">conversion rate</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-300">
                              {conversions} / {impressions}
                            </p>
                            <p className="text-xs text-gray-500">conversions / impressions</p>
                          </div>
                        </div>
                        {impressions > 0 && (
                          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-gray-700">
                            <div
                              className={`h-full rounded-full ${isWinner ? "bg-emerald-500" : "bg-blue-500"}`}
                              style={{ width: `${Math.min(100, pct)}%` }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
