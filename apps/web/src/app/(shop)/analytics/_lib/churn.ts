import type { DemoOrder } from "./demo-data";

export interface ChurnScore {
  userId: string;
  churnProbability: number; // 0-1
  riskLevel: "high" | "medium" | "low";
  daysSinceLast: number;
  orderCount: number;
  topReason: string;
}

export interface ChurnSummary {
  customers: ChurnScore[];
  avgChurnRate: number;
  highRiskCount: number;
  mediumRiskCount: number;
  lowRiskCount: number;
  predictedRevenueAtRisk: number;
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function churnTopReason(daysSinceLast: number, avgInterval: number, orderCount: number): string {
  if (daysSinceLast > avgInterval * 2)
    return `${Math.round(daysSinceLast)}d since last order (${Math.round(avgInterval * 2)}d expected)`;
  if (orderCount === 1) return "Single-purchase customer — never returned";
  if (daysSinceLast > 60) return `Inactive ${Math.round(daysSinceLast)} days`;
  return "Decreasing purchase pace";
}

function scoreUser(
  userId: string,
  userOrders: DemoOrder[],
  maxRecency: number,
  maxFreq: number,
  referenceDate: Date
): ChurnScore {
  const sortedDates = userOrders.map((o) => o.date.getTime()).sort((a, b) => a - b);
  const lastDate = new Date(sortedDates[sortedDates.length - 1] ?? Date.now());
  const firstDate = new Date(sortedDates[0] ?? Date.now());
  const orderCount = userOrders.length;
  const daysSinceLast = (referenceDate.getTime() - lastDate.getTime()) / 86400000;
  const avgInterval =
    orderCount > 1 ? (lastDate.getTime() - firstDate.getTime()) / (orderCount - 1) / 86400000 : 90;
  const recencyFeat = (daysSinceLast / maxRecency) * 2 - 1;
  const freqFeat = -(orderCount / maxFreq) * 2 + 1;
  const overdueFeat =
    daysSinceLast > avgInterval ? (daysSinceLast - avgInterval) / avgInterval : -0.5;
  const logit = 0.6 * recencyFeat + 0.3 * freqFeat + 0.5 * overdueFeat - 0.2;
  const churnProbability = Math.min(sigmoid(logit * 2), 0.97);
  const riskLevel: ChurnScore["riskLevel"] =
    churnProbability >= 0.65 ? "high" : churnProbability >= 0.35 ? "medium" : "low";
  return {
    userId,
    churnProbability,
    riskLevel,
    daysSinceLast,
    orderCount,
    topReason: churnTopReason(daysSinceLast, avgInterval, orderCount),
  };
}

export function computeChurn(orders: DemoOrder[], referenceDate = new Date()): ChurnSummary {
  const byUser = new Map<string, DemoOrder[]>();
  for (const o of orders) {
    if (!byUser.has(o.userId)) byUser.set(o.userId, []);
    byUser.get(o.userId)?.push(o);
  }

  const allRecencies: number[] = [];
  const allFreqs: number[] = [];
  for (const userOrders of byUser.values()) {
    const lastDate = new Date(Math.max(...userOrders.map((o) => o.date.getTime())));
    allRecencies.push((referenceDate.getTime() - lastDate.getTime()) / 86400000);
    allFreqs.push(userOrders.length);
  }
  const maxRecency = Math.max(...allRecencies, 1);
  const maxFreq = Math.max(...allFreqs, 1);

  const customers = Array.from(byUser.entries()).map(([userId, userOrders]) =>
    scoreUser(userId, userOrders, maxRecency, maxFreq, referenceDate)
  );
  customers.sort((a, b) => b.churnProbability - a.churnProbability);

  const avgChurnRate = customers.reduce((s, c) => s + c.churnProbability, 0) / customers.length;
  const avgUserRevenue = orders.reduce((s, o) => s + o.value, 0) / byUser.size;
  const predictedRevenueAtRisk = customers
    .filter((c) => c.riskLevel === "high")
    .reduce((s, c) => s + avgUserRevenue * c.churnProbability, 0);

  return {
    customers,
    avgChurnRate,
    highRiskCount: customers.filter((c) => c.riskLevel === "high").length,
    mediumRiskCount: customers.filter((c) => c.riskLevel === "medium").length,
    lowRiskCount: customers.filter((c) => c.riskLevel === "low").length,
    predictedRevenueAtRisk,
  };
}
