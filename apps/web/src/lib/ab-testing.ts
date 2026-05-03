import { adminDb } from "@/infrastructure/db/admin-db";
import { sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { cache } from "react";

export type Variant = { id: string; name: string; weight: number };

export type Experiment = {
  id: string;
  name: string;
  description: string;
  status: "draft" | "running" | "paused" | "completed";
  variants: Variant[];
  goal: string;
  createdAt: Date;
  endedAt: Date | null;
};

export type ExperimentStats = {
  experiment: Experiment;
  variants: {
    variant: Variant;
    impressions: number;
    conversions: number;
    conversionRate: number;
  }[];
  totalImpressions: number;
  totalConversions: number;
  winner: string | null;
};

type Row = Record<string, unknown>;

// Deterministic hash: assigns user to a bucket 0–99 based on experiment+key
function bucket(experimentId: string, userKey: string): number {
  const str = `${experimentId}:${userKey}`;
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = (h * 33) ^ str.charCodeAt(i);
  }
  return Math.abs(h >>> 0) % 100;
}

function pickVariant(variants: Variant[], b: number): string {
  let cumulative = 0;
  for (const v of variants) {
    cumulative += v.weight * 100;
    if (b < cumulative) return v.id;
  }
  // fallback: last bucket catches any rounding overflow; non-null asserted because
  // an experiment always has at least one variant (enforced by the DB schema).
  // biome-ignore lint/style/noNonNullAssertion: variants is guaranteed non-empty
  return variants[variants.length - 1]!.id;
}

// Read anonymous key from cookie (read-only — cookie is set via /api/ab/assign)
async function getAnonymousKey(): Promise<string | null> {
  const jar = await cookies();
  return jar.get("_ab_uid")?.value ?? null;
}

// Assign a user to a variant (idempotent — same user always gets same variant)
export async function assign(experimentId: string, userId?: string): Promise<string | null> {
  const rows = (await adminDb.execute(
    sql`SELECT status, variants FROM ab_experiments WHERE id = ${experimentId}`
  )) as unknown as Row[];

  const exp = rows[0];
  if (!exp || exp.status !== "running") return null;

  const variants = exp.variants as unknown as Variant[];
  const key = userId ?? (await getAnonymousKey());
  if (!key) return null;
  const b = bucket(experimentId, key);
  const variantId = pickVariant(variants, b);

  await adminDb.execute(sql`
    INSERT INTO ab_assignments (experiment_id, user_key, variant_id)
    VALUES (${experimentId}, ${key}, ${variantId})
    ON CONFLICT (experiment_id, user_key) DO UPDATE SET variant_id = EXCLUDED.variant_id
  `);

  return variantId;
}

// Record an impression or conversion event
export async function track(
  experimentId: string,
  eventType: "impression" | "conversion" | string,
  userId?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const key = userId ?? (await getAnonymousKey());
  if (!key) return;

  const rows = (await adminDb.execute(
    sql`SELECT variant_id FROM ab_assignments WHERE experiment_id = ${experimentId} AND user_key = ${key}`
  )) as unknown as Row[];

  const variantId = (rows[0]?.variant_id as string) ?? null;
  if (!variantId) return;

  await adminDb.execute(sql`
    INSERT INTO ab_events (experiment_id, user_key, variant_id, event_type, metadata)
    VALUES (${experimentId}, ${key}, ${variantId}, ${eventType}, ${JSON.stringify(metadata ?? {})})
  `);
}

// Server-side cached variant getter for a single request
export const getVariant = cache(
  async (experimentId: string, userId?: string): Promise<string | null> => {
    return assign(experimentId, userId);
  }
);

// Admin: list all experiments
export async function listExperiments(): Promise<Experiment[]> {
  const rows = (await adminDb.execute(
    sql`SELECT id, name, description, status, variants, goal, created_at, ended_at
        FROM ab_experiments ORDER BY created_at DESC`
  )) as unknown as Row[];

  return rows.map((r) => ({
    id: r.id as string,
    name: r.name as string,
    description: r.description as string,
    status: r.status as Experiment["status"],
    variants: r.variants as unknown as Variant[],
    goal: r.goal as string,
    createdAt: new Date(r.created_at as string),
    endedAt: r.ended_at ? new Date(r.ended_at as string) : null,
  }));
}

// Admin: get stats for one experiment
export async function getExperimentStats(experimentId: string): Promise<ExperimentStats | null> {
  const expRows = (await adminDb.execute(
    sql`SELECT id, name, description, status, variants, goal, created_at, ended_at
        FROM ab_experiments WHERE id = ${experimentId}`
  )) as unknown as Row[];

  if (!expRows[0]) return null;

  const exp: Experiment = {
    id: expRows[0].id as string,
    name: expRows[0].name as string,
    description: expRows[0].description as string,
    status: expRows[0].status as Experiment["status"],
    variants: expRows[0].variants as unknown as Variant[],
    goal: expRows[0].goal as string,
    createdAt: new Date(expRows[0].created_at as string),
    endedAt: expRows[0].ended_at ? new Date(expRows[0].ended_at as string) : null,
  };

  const statsRows = (await adminDb.execute(sql`
    SELECT
      variant_id,
      SUM(CASE WHEN event_type = 'impression' THEN 1 ELSE 0 END)::int  AS impressions,
      SUM(CASE WHEN event_type = 'conversion' THEN 1 ELSE 0 END)::int  AS conversions
    FROM ab_events
    WHERE experiment_id = ${experimentId}
    GROUP BY variant_id
  `)) as unknown as Row[];

  const statsMap = new Map(statsRows.map((r) => [r.variant_id as string, r]));

  let totalImpressions = 0;
  let totalConversions = 0;
  let winnerRate = -1;
  let winner: string | null = null;

  const variantStats = exp.variants.map((v) => {
    const s = statsMap.get(v.id);
    const impressions = Number(s?.impressions ?? 0);
    const conversions = Number(s?.conversions ?? 0);
    const conversionRate = impressions > 0 ? conversions / impressions : 0;
    totalImpressions += impressions;
    totalConversions += conversions;
    if (impressions >= 30 && conversionRate > winnerRate) {
      winnerRate = conversionRate;
      winner = v.id;
    }
    return { variant: v, impressions, conversions, conversionRate };
  });

  return { experiment: exp, variants: variantStats, totalImpressions, totalConversions, winner };
}

// Admin: update experiment status
export async function setExperimentStatus(
  experimentId: string,
  status: Experiment["status"]
): Promise<void> {
  await adminDb.execute(sql`
    UPDATE ab_experiments
    SET status = ${status}, ended_at = CASE WHEN ${status} = 'completed' THEN now() ELSE ended_at END
    WHERE id = ${experimentId}
  `);
}
