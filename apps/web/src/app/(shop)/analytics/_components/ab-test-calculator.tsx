"use client";
import { Button } from "@fabric/ui";

import { useState } from "react";
import { type ABTestResult, runABTest } from "../_lib/ml-client";

function Field({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <p className="mb-1 text-xs text-gray-400">{hint}</p>
      <input
        id={id}
        type="number"
        min="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
    </div>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 text-center">
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function ABTestResultPanel({ result }: { result: ABTestResult }) {
  const verdictColor = result.is_significant
    ? result.uplift_percent > 0
      ? "border-green-200 bg-green-50"
      : "border-red-200 bg-red-50"
    : "border-amber-200 bg-amber-50";
  const verdictIcon = result.is_significant ? (result.uplift_percent > 0 ? "✅" : "❌") : "⏳";
  const verdictText = result.is_significant ? "Statistically significant" : "Not yet significant";
  const verdictTextColor = result.is_significant
    ? result.uplift_percent > 0
      ? "text-green-800"
      : "text-red-800"
    : "text-amber-800";
  return (
    <div className="space-y-4">
      <div className={`rounded-xl border p-5 ${verdictColor}`}>
        <div className="flex items-start gap-3">
          <span className="text-2xl">{verdictIcon}</span>
          <div>
            <p className={`font-semibold ${verdictTextColor}`}>{verdictText}</p>
            <p className="mt-1 text-sm text-gray-700">{result.recommendation}</p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric
          label="Uplift"
          value={`${result.uplift_percent > 0 ? "+" : ""}${result.uplift_percent.toFixed(2)}%`}
        />
        <Metric
          label="p-value"
          value={result.p_value < 0.001 ? "<0.001" : result.p_value.toFixed(4)}
        />
        <Metric label="Control CVR" value={`${result.control_rate.toFixed(2)}%`} />
        <Metric label="Variant CVR" value={`${result.variant_rate.toFixed(2)}%`} />
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm text-sm space-y-2">
        <div className="flex justify-between">
          <span className="text-gray-500">95% Confidence Interval on uplift</span>
          <span className="font-mono font-medium text-gray-900">
            [{result.confidence_interval[0] > 0 ? "+" : ""}
            {result.confidence_interval[0].toFixed(2)}%,{" "}
            {result.confidence_interval[1] > 0 ? "+" : ""}
            {result.confidence_interval[1].toFixed(2)}%]
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Required sample size (per variant)</span>
          <span className="font-mono font-medium text-gray-900">
            {result.required_sample_size.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}

export function ABTestCalculator() {
  const [form, setForm] = useState({
    control_visitors: "1000",
    control_conversions: "50",
    variant_visitors: "1000",
    variant_conversions: "63",
    confidence_level: "95",
  });
  const [result, setResult] = useState<ABTestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof typeof form) => (v: string) => setForm((prev) => ({ ...prev, [key]: v }));

  const handleRun = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await runABTest({
        control_visitors: Number.parseInt(form.control_visitors),
        control_conversions: Number.parseInt(form.control_conversions),
        variant_visitors: Number.parseInt(form.variant_visitors),
        variant_conversions: Number.parseInt(form.variant_conversions),
        confidence_level: Number.parseFloat(form.confidence_level) / 100,
      });
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to run A/B test");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-5 text-base font-semibold text-gray-900">Input</h2>

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-600 border-b border-gray-100 pb-1">
              Control (A)
            </h3>
            <Field
              label="Visitors"
              hint="Total visitors in control group"
              value={form.control_visitors}
              onChange={set("control_visitors")}
            />
            <Field
              label="Conversions"
              hint="Purchases / sign-ups / goals"
              value={form.control_conversions}
              onChange={set("control_conversions")}
            />
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-600 border-b border-gray-100 pb-1">
              Variant (B)
            </h3>
            <Field
              label="Visitors"
              hint="Total visitors in variant group"
              value={form.variant_visitors}
              onChange={set("variant_visitors")}
            />
            <Field
              label="Conversions"
              hint="Purchases / sign-ups / goals"
              value={form.variant_conversions}
              onChange={set("variant_conversions")}
            />
          </div>
        </div>

        <div className="mt-4 max-w-xs">
          <label htmlFor="ab-confidence-level" className="block text-sm font-medium text-gray-700">
            Confidence Level
          </label>
          <select
            id="ab-confidence-level"
            value={form.confidence_level}
            onChange={(e) => set("confidence_level")(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="90">90%</option>
            <option value="95">95% (standard)</option>
            <option value="99">99%</option>
          </select>
        </div>

        <Button type="button" onClick={handleRun} disabled={loading} className="mt-4">
          {loading ? "Calculating…" : "Run Statistical Test"}
        </Button>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>

      {result && <ABTestResultPanel result={result} />}
    </div>
  );
}
