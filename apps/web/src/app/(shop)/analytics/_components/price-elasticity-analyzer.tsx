"use client";

import { useMemo, useState } from "react";
import { DEMO_PRICE_POINTS } from "../_lib/demo-data";
import { computeElasticity } from "../_lib/price-elasticity";

function parseTable(text: string) {
  return text
    .trim()
    .split("\n")
    .map((line) => {
      const parts = line.split(/[\t,;|\s]+/).map(Number);
      const p0 = parts[0];
      const p1 = parts[1];
      return parts.length >= 2 &&
        p0 !== undefined &&
        p1 !== undefined &&
        !Number.isNaN(p0) &&
        !Number.isNaN(p1)
        ? { price: p0, demand: p1 }
        : null;
    })
    .filter((d): d is { price: number; demand: number } => d !== null);
}

export function PriceElasticityAnalyzer() {
  const [inputText, setInputText] = useState(
    DEMO_PRICE_POINTS.map((d) => `${d.price}\t${d.demand}`).join("\n")
  );

  const result = useMemo(() => {
    const data = parseTable(inputText);
    if (data.length < 2) return null;
    try {
      return computeElasticity(data);
    } catch {
      return null;
    }
  }, [inputText]);

  const data = parseTable(inputText);

  // Determine curve scale for SVG
  const maxRevenue = result ? Math.max(...result.curve.map((c) => c.revenue)) : 1;
  const maxDemand = result ? Math.max(...result.curve.map((c) => c.demand)) : 1;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-2 text-sm font-semibold text-gray-700">Price & Demand Data</h3>
          <p className="mb-3 text-xs text-gray-400">
            Two columns: Price (฿) then Demand (units). Tab, comma, or space separated.
          </p>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            rows={9}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus-visible:border-ring focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>

        <div className="space-y-3">
          {result && (
            <>
              <div
                className={`rounded-xl border p-5 shadow-sm ${Math.abs(result.elasticity) > 1 ? "border-amber-200 bg-amber-50" : "border-blue-100 bg-blue-50"}`}
              >
                <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                  Price Elasticity (β)
                </p>
                <p className="text-4xl font-bold text-gray-900">{result.elasticity.toFixed(3)}</p>
                <p className="mt-2 text-sm text-gray-700">{result.interpretation}</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Model fit (R²)</span>
                  <span className="font-semibold">{(result.rSquared * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Revenue-maximising price</span>
                  <span className="font-semibold text-emerald-700">
                    ฿{result.revenueMaxPrice.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Optimal revenue</span>
                  <span className="font-semibold text-emerald-700">
                    ฿{result.optimalRevenue.toLocaleString()}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {result && (
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Demand curve */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h4 className="mb-3 text-sm font-semibold text-gray-600 uppercase tracking-wide">
              Demand Curve
            </h4>
            <svg
              viewBox="0 0 300 160"
              className="w-full"
              aria-label="Demand curve chart"
              role="img"
            >
              <polyline
                points={result.curve
                  .map(
                    (c, i) =>
                      `${(i / (result.curve.length - 1)) * 280 + 10},${160 - (c.demand / maxDemand) * 140}`
                  )
                  .join(" ")}
                fill="none"
                stroke="#3B82F6"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {data.map((d) => {
                const x =
                  ((d.price - Math.min(...data.map((p) => p.price))) /
                    (Math.max(...data.map((p) => p.price)) -
                      Math.min(...data.map((p) => p.price)))) *
                    280 +
                  10;
                const y = 160 - (d.demand / maxDemand) * 140;
                return <circle key={d.price} cx={x} cy={y} r="4" fill="#1D4ED8" />;
              })}
            </svg>
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>฿{Math.min(...data.map((d) => d.price))}</span>
              <span>Price (฿) →</span>
              <span>฿{Math.max(...data.map((d) => d.price))}</span>
            </div>
          </div>

          {/* Revenue curve */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h4 className="mb-3 text-sm font-semibold text-gray-600 uppercase tracking-wide">
              Revenue Curve
            </h4>
            <svg
              viewBox="0 0 300 160"
              className="w-full"
              aria-label="Revenue curve chart"
              role="img"
            >
              <polyline
                points={result.curve
                  .map(
                    (c, i) =>
                      `${(i / (result.curve.length - 1)) * 280 + 10},${160 - (c.revenue / maxRevenue) * 140}`
                  )
                  .join(" ")}
                fill="none"
                stroke="#10B981"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Optimal price marker */}
              {(() => {
                const optIdx = result.curve.findIndex((c) => c.price === result.revenueMaxPrice);
                if (optIdx < 0) return null;
                const optPoint = result.curve[optIdx];
                if (!optPoint) return null;
                const x = (optIdx / (result.curve.length - 1)) * 280 + 10;
                const y = 160 - (optPoint.revenue / maxRevenue) * 140;
                return (
                  <>
                    <line
                      x1={x}
                      y1={0}
                      x2={x}
                      y2={160}
                      stroke="#F59E0B"
                      strokeWidth="1.5"
                      strokeDasharray="4 3"
                    />
                    <circle cx={x} cy={y} r="5" fill="#F59E0B" />
                  </>
                );
              })()}
            </svg>
            <p className="mt-1 text-xs text-amber-600">— Optimal price ฿{result.revenueMaxPrice}</p>
          </div>
        </div>
      )}
    </div>
  );
}
