"use client";

import { useState } from "react";
import { type MMMResult, type MMMSpend, runMMM } from "../_lib/ml-client";

const CHANNELS = [
  { key: "meta", label: "Meta (Facebook/IG)", color: "#1877F2" },
  { key: "google", label: "Google Ads", color: "#34A853" },
  { key: "tiktok", label: "TikTok Ads", color: "#000000" },
  { key: "line_oa", label: "LINE OA", color: "#06C755" },
  { key: "shopee", label: "Shopee Ads", color: "#EE4D2D" },
  { key: "email", label: "Email (SendGrid)", color: "#1A82E2" },
  { key: "sms", label: "SMS (Twilio)", color: "#F22F46" },
] as const;

type ChannelKey = (typeof CHANNELS)[number]["key"];

const DEMO_DATA = {
  sales: [
    142000, 158000, 167000, 145000, 172000, 189000, 201000, 178000, 195000, 210000, 225000, 198000,
  ],
  spend: {
    meta: [15000, 18000, 20000, 14000, 22000, 25000, 28000, 20000, 24000, 27000, 30000, 22000],
    google: [8000, 9000, 9500, 8500, 10000, 11000, 12000, 10500, 11000, 12500, 13000, 11000],
    tiktok: [3000, 4000, 5000, 3500, 5500, 6000, 7000, 5000, 6000, 7000, 8000, 6000],
    line_oa: [2000, 2000, 2500, 2000, 2500, 3000, 3000, 2500, 3000, 3000, 3500, 3000],
    shopee: [5000, 5500, 6000, 5000, 6500, 7000, 7500, 6500, 7000, 8000, 8500, 7000],
    email: [500, 500, 600, 500, 600, 700, 700, 600, 700, 700, 800, 700],
    sms: [300, 350, 400, 300, 450, 500, 500, 400, 450, 500, 550, 450],
  },
};

function BarChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="space-y-2">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-3">
          <div className="w-28 shrink-0 text-right text-xs text-gray-600">{d.label}</div>
          <div className="flex-1 rounded-full bg-gray-100 h-6 relative">
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
              style={{ width: `${(d.value / max) * 100}%`, backgroundColor: d.color }}
            />
            <span className="absolute inset-0 flex items-center px-2 text-xs font-semibold text-white mix-blend-difference">
              {d.value.toFixed(1)}%
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function InsightCard({ text, index }: { text: string; index: number }) {
  const icons = ["📊", "💡", "🚀", "⚠️"];
  return (
    <div className="flex gap-3 rounded-lg border border-blue-100 bg-blue-50 p-3">
      <span className="text-lg">{icons[index % icons.length]}</span>
      <p className="text-sm text-blue-900">{text}</p>
    </div>
  );
}

export function MMMAnalyzer() {
  const [salesInput, setSalesInput] = useState(DEMO_DATA.sales.join(", "));
  const [spendInputs, setSpendInputs] = useState<Record<ChannelKey, string>>(() => {
    const out: Record<string, string> = {};
    for (const { key } of CHANNELS) {
      out[key] = (DEMO_DATA.spend as Record<string, number[]>)[key]?.join(", ") ?? "";
    }
    return out as Record<ChannelKey, string>;
  });
  const [result, setResult] = useState<MMMResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parse = (s: string) =>
    s
      .split(",")
      .map((v) => Number.parseFloat(v.trim()))
      .filter((v) => !Number.isNaN(v));

  const handleRun = async () => {
    setError(null);
    setLoading(true);
    try {
      const sales = parse(salesInput);
      const spend: MMMSpend = {};
      for (const { key } of CHANNELS) {
        const vals = parse(spendInputs[key]);
        if (vals.length > 0) (spend as Record<string, number[]>)[key] = vals;
      }
      const res = await runMMM(spend, sales);
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const channelMeta = Object.fromEntries(CHANNELS.map((c) => [c.key, c]));

  return (
    <div className="space-y-6">
      {/* Input */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-gray-900">Input Data</h2>

        <div className="mb-4">
          <label htmlFor="mmm-sales" className="mb-1 block text-sm font-medium text-gray-700">
            Monthly Sales (THB) — comma-separated, 12 periods
          </label>
          <input
            id="mmm-sales"
            type="text"
            value={salesInput}
            onChange={(e) => setSalesInput(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="142000, 158000, 167000, ..."
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {CHANNELS.map(({ key, label, color }) => (
            <div key={key}>
              <label
                htmlFor={`mmm-${key}`}
                className="mb-1 flex items-center gap-2 text-sm font-medium text-gray-700"
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                {label}
              </label>
              <input
                id={`mmm-${key}`}
                type="text"
                value={spendInputs[key]}
                onChange={(e) => setSpendInputs((prev) => ({ ...prev, [key]: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="spend per month, ..."
              />
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={handleRun}
          disabled={loading}
          className="mt-4 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
        >
          {loading ? "Running model via Celery…" : "Run Marketing Mix Model"}
        </button>

        {error && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold text-gray-900">Model Results</h2>
            <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
              R² = {(result.model_r2 * 100).toFixed(1)}%
            </span>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Attribution */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Revenue Attribution
              </h3>
              <BarChart
                data={result.active_channels.map((ch) => ({
                  label: channelMeta[ch]?.label ?? ch,
                  value: result.attribution[ch] ?? 0,
                  color: channelMeta[ch]?.color ?? "#6B7280",
                }))}
              />
            </div>

            {/* ROI */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Channel ROI (x return per ฿1 spent)
              </h3>
              <BarChart
                data={result.active_channels.map((ch) => ({
                  label: channelMeta[ch]?.label ?? ch,
                  value: result.roi[ch] ?? 0,
                  color: channelMeta[ch]?.color ?? "#6B7280",
                }))}
              />
            </div>
          </div>

          {/* Budget recommendation */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-gray-700 uppercase tracking-wide">
              Optimised Budget Allocation
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {result.active_channels.map((ch) => {
                const meta = channelMeta[ch];
                const budget = result.budget_recommendation[ch] ?? 0;
                return (
                  <div key={ch} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: meta?.color ?? "#6B7280" }}
                      />
                      <span className="text-xs font-medium text-gray-600">{meta?.label ?? ch}</span>
                    </div>
                    <p className="text-lg font-bold text-gray-900">฿{budget.toLocaleString()}</p>
                    <p className="text-xs text-gray-500">ROI {result.roi[ch]?.toFixed(2)}x</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Insights */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              AI Insights
            </h3>
            {result.insights.map((text, index) => (
              <InsightCard key={text} text={text} index={index} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
