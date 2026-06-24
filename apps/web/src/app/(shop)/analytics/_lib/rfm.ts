import type { DemoOrder } from "./demo-data";

export interface RFMCustomer {
  userId: string;
  recencyDays: number;
  frequency: number;
  monetary: number; // avg order value
  rScore: number; // 1-5
  fScore: number;
  mScore: number;
  rfmScore: string; // e.g. "544"
  segment: RFMSegment;
}

export type RFMSegment =
  | "Champions"
  | "Loyal Customers"
  | "Potential Loyalists"
  | "Recent Customers"
  | "Promising"
  | "Customers Needing Attention"
  | "At Risk"
  | "Cannot Lose Them"
  | "Hibernating"
  | "Lost";

function quintile(value: number, sorted: number[], invert = false): number {
  const rank = sorted.filter((v) => v <= value).length / sorted.length;
  const score = Math.ceil(rank * 5);
  return invert ? 6 - score : score;
}

function highRecencySegment(r: number, f: number, m: number): RFMSegment | undefined {
  if (r >= 4 && f >= 4 && m >= 4) return "Champions";
  if (r >= 3 && f >= 3) return "Loyal Customers";
  if (r >= 4 && f <= 2) return "Potential Loyalists";
  if (r >= 4 && f === 1) return "Recent Customers";
  return undefined;
}

function midRecencySegment(r: number, f: number, m: number): RFMSegment | undefined {
  if (r >= 3 && f <= 2 && m >= 3) return "Promising";
  if (r === 3 && f <= 2) return "Customers Needing Attention";
  return undefined;
}

function lowRecencySegment(r: number, f: number, m: number): RFMSegment | undefined {
  if (r <= 2 && f >= 4 && m >= 4) return "Cannot Lose Them";
  if (r <= 2 && f >= 3) return "At Risk";
  if (r <= 2 && f <= 2) return "Hibernating";
  return undefined;
}

function segmentFromScores(r: number, f: number, m: number): RFMSegment {
  return (
    highRecencySegment(r, f, m) ??
    midRecencySegment(r, f, m) ??
    lowRecencySegment(r, f, m) ??
    "Lost"
  );
}

export interface RFMSummary {
  customers: RFMCustomer[];
  segmentCounts: Record<RFMSegment, number>;
}

export function computeRFM(orders: DemoOrder[], referenceDate = new Date()): RFMSummary {
  const byUser = new Map<string, DemoOrder[]>();
  for (const o of orders) {
    if (!byUser.has(o.userId)) byUser.set(o.userId, []);
    byUser.get(o.userId)?.push(o);
  }

  const rawData = Array.from(byUser.entries()).map(([userId, userOrders]) => {
    const dates = userOrders.map((o) => o.date.getTime());
    const lastDate = new Date(Math.max(...dates));
    const recencyDays = (referenceDate.getTime() - lastDate.getTime()) / 86400000;
    const frequency = userOrders.length;
    const monetary = userOrders.reduce((s, o) => s + o.value, 0) / frequency;
    return { userId, recencyDays, frequency, monetary };
  });

  const recencies = rawData.map((d) => d.recencyDays).sort((a, b) => a - b);
  const frequencies = rawData.map((d) => d.frequency).sort((a, b) => a - b);
  const monetaries = rawData.map((d) => d.monetary).sort((a, b) => a - b);

  const customers: RFMCustomer[] = rawData.map((d) => {
    // Lower recency = more recent = higher score (inverted)
    const rScore = quintile(d.recencyDays, recencies, true);
    const fScore = quintile(d.frequency, frequencies);
    const mScore = quintile(d.monetary, monetaries);
    return {
      ...d,
      rScore,
      fScore,
      mScore,
      rfmScore: `${rScore}${fScore}${mScore}`,
      segment: segmentFromScores(rScore, fScore, mScore),
    };
  });

  customers.sort((a, b) => b.rScore + b.fScore + b.mScore - (a.rScore + a.fScore + a.mScore));

  const segmentCounts = {} as Record<RFMSegment, number>;
  for (const c of customers) {
    segmentCounts[c.segment] = (segmentCounts[c.segment] ?? 0) + 1;
  }

  return { customers, segmentCounts };
}
