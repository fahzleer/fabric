import { adminDb } from "@/infrastructure/db/admin-db";
import { sql } from "drizzle-orm";

export type DashboardStats = {
  totalOrders: number;
  totalRevenueCents: number;
  currency: string;
  activeUsers30d: number;
  churnRatePct: number;
};

type Row = Record<string, unknown>;

export async function getDashboardStats(): Promise<DashboardStats> {
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [ordersResult, revenueResult, activeResult, churnResult] = await Promise.all([
    adminDb.execute(sql`
      SELECT COUNT(*)::text AS count
      FROM orders
      WHERE status NOT IN ('cancelled', 'refunded')
    `),
    adminDb.execute(sql`
      SELECT
        COALESCE(SUM(total_amount_in_cents), 0)::text AS total,
        COALESCE(
          (SELECT currency FROM orders WHERE status = 'delivered' LIMIT 1),
          'THB'
        ) AS currency
      FROM orders
      WHERE status = 'delivered'
    `),
    adminDb.execute(sql`
      SELECT COUNT(DISTINCT user_id)::text AS active_users
      FROM orders
      WHERE placed_at >= ${thirtyDaysAgo.toISOString()}
        AND status NOT IN ('cancelled', 'refunded')
    `),
    adminDb.execute(sql`
      WITH prev_month AS (
        SELECT DISTINCT user_id
        FROM orders
        WHERE placed_at >= ${prevMonthStart.toISOString()}
          AND placed_at <= ${prevMonthEnd.toISOString()}
          AND status NOT IN ('cancelled', 'refunded')
      ),
      current_month AS (
        SELECT DISTINCT user_id
        FROM orders
        WHERE placed_at >= ${currentMonthStart.toISOString()}
          AND status NOT IN ('cancelled', 'refunded')
      )
      SELECT
        COUNT(p.user_id)::text AS prev_buyers,
        COUNT(c.user_id)::text AS retained
      FROM prev_month p
      LEFT JOIN current_month c USING (user_id)
    `),
  ]);

  const ordersRow = (ordersResult as unknown as Row[])[0] ?? {};
  const revenueRow = (revenueResult as unknown as Row[])[0] ?? {};
  const activeRow = (activeResult as unknown as Row[])[0] ?? {};
  const churnRow = (churnResult as unknown as Row[])[0] ?? {};

  const prevBuyers = Number(churnRow.prev_buyers ?? 0);
  const retained = Number(churnRow.retained ?? 0);
  const churned = prevBuyers - retained;
  const churnRatePct = prevBuyers > 0 ? Math.round((churned / prevBuyers) * 1000) / 10 : 0;

  return {
    totalOrders: Number(ordersRow.count ?? 0),
    totalRevenueCents: Number(revenueRow.total ?? 0),
    currency: String(revenueRow.currency ?? "THB"),
    activeUsers30d: Number(activeRow.active_users ?? 0),
    churnRatePct,
  };
}
