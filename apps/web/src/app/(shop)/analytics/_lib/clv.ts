import type { DemoOrder } from "./demo-data";

export interface CustomerCLV {
  userId: string;
  historicalCLV: number;
  predicted12mCLV: number;
  avgOrderValue: number;
  orderCount: number;
  frequencyPerMonth: number;
  segment: "high" | "medium" | "low";
}

export interface CLVSummary {
  customers: CustomerCLV[];
  avgCLV: number;
  totalPredictedLTV: number;
  highValueCount: number;
  mediumValueCount: number;
  lowValueCount: number;
}

export function computeCLV(orders: DemoOrder[], referenceDate = new Date()): CLVSummary {
  const byUser = new Map<string, DemoOrder[]>();
  for (const o of orders) {
    if (!byUser.has(o.userId)) byUser.set(o.userId, []);
    byUser.get(o.userId)?.push(o);
  }

  const customers: CustomerCLV[] = [];

  for (const [userId, userOrders] of byUser) {
    const sorted = [...userOrders].sort((a, b) => a.date.getTime() - b.date.getTime());
    const firstDate = sorted[0]?.date ?? referenceDate;
    const lastDate = sorted[sorted.length - 1]?.date ?? referenceDate;

    const totalRevenue = userOrders.reduce((s, o) => s + o.value, 0);
    const orderCount = userOrders.length;
    const avgOrderValue = totalRevenue / orderCount;

    const obsMonths = Math.max(
      (referenceDate.getTime() - firstDate.getTime()) / (30 * 24 * 60 * 60 * 1000),
      1
    );
    const frequencyPerMonth = orderCount / obsMonths;

    // Expected days between orders
    const avgDaysBetween =
      orderCount > 1
        ? (lastDate.getTime() - firstDate.getTime()) / (orderCount - 1) / 86400000
        : obsMonths * 30;

    // Recency: days since last order
    const daysSinceLast = (referenceDate.getTime() - lastDate.getTime()) / 86400000;

    // P(alive) — simplified BG/NBD: exponential with half-life = 2× avg interval
    const pAlive = Math.exp(-daysSinceLast / (avgDaysBetween * 2));

    // Predicted 12m CLV
    const predicted12mCLV = avgOrderValue * frequencyPerMonth * 12 * pAlive;

    const segment: CustomerCLV["segment"] =
      predicted12mCLV >= 4000 ? "high" : predicted12mCLV >= 1500 ? "medium" : "low";

    customers.push({
      userId,
      historicalCLV: totalRevenue,
      predicted12mCLV,
      avgOrderValue,
      orderCount,
      frequencyPerMonth,
      segment,
    });
  }

  customers.sort((a, b) => b.predicted12mCLV - a.predicted12mCLV);

  const avgCLV = customers.reduce((s, c) => s + c.predicted12mCLV, 0) / customers.length;
  const totalPredictedLTV = customers.reduce((s, c) => s + c.predicted12mCLV, 0);

  return {
    customers,
    avgCLV,
    totalPredictedLTV,
    highValueCount: customers.filter((c) => c.segment === "high").length,
    mediumValueCount: customers.filter((c) => c.segment === "medium").length,
    lowValueCount: customers.filter((c) => c.segment === "low").length,
  };
}
