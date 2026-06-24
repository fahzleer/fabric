import type { DemoOrder } from "./demo-data";

export interface CohortRow {
  cohortLabel: string; // "Jan 2026", etc.
  cohortSize: number; // users in this cohort
  retention: (number | null)[]; // % retained each subsequent period (null = future)
}

export interface CohortResult {
  rows: CohortRow[];
  periods: number; // max periods tracked
  avgRetention: number[]; // average retention per period across cohorts
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
  const parts = key.split("-").map(Number);
  const y = parts[0] ?? new Date().getFullYear();
  const m = parts[1] ?? 1;
  const d = new Date(y, m - 1, 1);
  return d.toLocaleString("en", { month: "short", year: "numeric" });
}

export function computeCohort(orders: DemoOrder[], referenceDate = new Date()): CohortResult {
  // First purchase month per user = cohort assignment
  const firstMonth = new Map<string, string>();
  for (const o of orders) {
    const mk = monthKey(o.date);
    if (!firstMonth.has(o.userId) || mk < (firstMonth.get(o.userId) ?? "")) {
      firstMonth.set(o.userId, mk);
    }
  }

  // All months present in data
  const allMonths = Array.from(new Set([...orders.map((o) => monthKey(o.date))])).sort();

  // All activity per user per month
  const activity = new Map<string, Set<string>>(); // userId → Set<monthKey>
  for (const o of orders) {
    if (!activity.has(o.userId)) activity.set(o.userId, new Set());
    activity.get(o.userId)?.add(monthKey(o.date));
  }

  const cohortMonths = Array.from(new Set(firstMonth.values())).sort();
  const currentMonth = monthKey(referenceDate);
  const periods = allMonths.length;

  const rows: CohortRow[] = cohortMonths.map((cohortKey) => {
    const cohortUsers = Array.from(firstMonth.entries())
      .filter(([, mk]) => mk === cohortKey)
      .map(([uid]) => uid);

    const cohortIdx = allMonths.indexOf(cohortKey);
    const retention: (number | null)[] = [];

    for (let p = 0; p < periods; p++) {
      const targetMonth = allMonths[cohortIdx + p];
      if (!targetMonth) {
        retention.push(null);
        continue;
      }
      if (targetMonth > currentMonth) {
        retention.push(null);
        continue;
      }
      const retained = cohortUsers.filter((uid) => activity.get(uid)?.has(targetMonth)).length;
      retention.push(
        cohortUsers.length === 0 ? null : Math.round((retained / cohortUsers.length) * 100)
      );
    }

    return {
      cohortLabel: monthLabel(cohortKey),
      cohortSize: cohortUsers.length,
      retention,
    };
  });

  // Average retention per period (period 0 = 100%)
  const avgRetention: number[] = [];
  for (let p = 0; p < periods; p++) {
    const vals = rows.map((r) => r.retention[p]).filter((v): v is number => v !== null);
    avgRetention.push(vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : 0);
  }

  return { rows, periods, avgRetention };
}
