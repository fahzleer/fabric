/**
 * Price Elasticity of Demand
 * Model: ln(Q) = α + β·ln(P)  →  β = price elasticity
 * Estimated via OLS on log-log transformed data.
 *
 * Interpretation:
 *   β < -1 → elastic (demand sensitive to price)
 *   β ≈ -1 → unit elastic
 *   -1 < β < 0 → inelastic
 */

export interface PricePoint {
  price: number;
  demand: number;
}

export interface ElasticityResult {
  elasticity: number; // β in log-log OLS
  rSquared: number;
  revenueMaxPrice: number; // price that maximises P × Q on fitted curve
  optimalRevenue: number;
  curve: { price: number; demand: number; revenue: number }[];
  interpretation: string;
}

function ols(x: number[], y: number[]): { slope: number; intercept: number; r2: number } {
  const n = x.length;
  const xMean = x.reduce((s, v) => s + v, 0) / n;
  const yMean = y.reduce((s, v) => s + v, 0) / n;
  const ssXY = x.reduce((s, v, i) => s + (v - xMean) * ((y[i] ?? 0) - yMean), 0);
  const ssXX = x.reduce((s, v) => s + (v - xMean) ** 2, 0);
  const slope = ssXX === 0 ? 0 : ssXY / ssXX;
  const intercept = yMean - slope * xMean;
  const yHat = x.map((v) => intercept + slope * v);
  const ssRes = y.reduce((s, v, i) => s + (v - (yHat[i] ?? 0)) ** 2, 0);
  const ssTot = y.reduce((s, v) => s + (v - yMean) ** 2, 0);
  const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot;
  return { slope, intercept, r2 };
}

export function computeElasticity(data: PricePoint[]): ElasticityResult {
  if (data.length < 2) throw new Error("Need at least 2 price points");

  const lnP = data.map((d) => Math.log(d.price));
  const lnQ = data.map((d) => Math.log(Math.max(d.demand, 1)));

  const { slope: elasticity, intercept: alpha, r2: rSquared } = ols(lnP, lnQ);

  // Fitted demand at any price: Q(P) = exp(alpha) × P^elasticity
  const fittedDemand = (price: number) => Math.exp(alpha) * price ** elasticity;

  // Revenue = P × Q; maximised analytically where d(Revenue)/dP = 0
  // Revenue = exp(α) × P^(1+β) → max at P → ∞ if β > -1, or analytically:
  // If β < -1, revenueMaxPrice exists at the boundary of our data range
  const minP = Math.min(...data.map((d) => d.price));
  const maxP = Math.max(...data.map((d) => d.price));
  const priceRange = Array.from({ length: 200 }, (_, i) => minP + (i / 199) * (maxP - minP));

  let revenueMaxPrice = minP;
  let optimalRevenue = 0;
  for (const p of priceRange) {
    const rev = p * fittedDemand(p);
    if (rev > optimalRevenue) {
      optimalRevenue = rev;
      revenueMaxPrice = p;
    }
  }

  const curve = priceRange
    .filter((_, i) => i % 10 === 0)
    .map((price) => ({
      price: Math.round(price),
      demand: Math.max(0, Math.round(fittedDemand(price))),
      revenue: Math.round(price * Math.max(0, fittedDemand(price))),
    }));

  const interpretation =
    elasticity < -1
      ? `Elastic demand (β = ${elasticity.toFixed(2)}): 1% price increase → ${Math.abs(elasticity).toFixed(1)}% demand drop. Price cuts can grow revenue.`
      : elasticity > -1 && elasticity < 0
        ? `Inelastic demand (β = ${elasticity.toFixed(2)}): customers are not very price-sensitive. Modest price increases preserve revenue.`
        : "Unit elastic (β ≈ -1): revenue stays roughly constant across price changes.";

  return {
    elasticity,
    rSquared,
    revenueMaxPrice: Math.round(revenueMaxPrice),
    optimalRevenue: Math.round(optimalRevenue),
    curve,
    interpretation,
  };
}
