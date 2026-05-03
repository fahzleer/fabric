import { adminDb } from "@/infrastructure/db/admin-db";
import { sql } from "drizzle-orm";

export type InventoryBalanceRow = {
  product_id: string;
  product_name: string;
  store_id: string;
  total_received: string;
  total_sold: string;
  expected_on_hand: string;
  retail_price_per_unit: string;
  currency: string;
  last_audited_at: Date | null;
  last_counted_quantity: string | null;
  last_variance_units: string | null;
  last_variance_baht: string | null;
  last_audit_type: string | null;
};

export async function getInventoryBalances(): Promise<InventoryBalanceRow[]> {
  try {
    const result = await adminDb.execute(sql`
      WITH receipt_totals AS (
        SELECT
          product_id,
          store_id,
          SUM(quantity_counted)      AS total_received,
          MAX(retail_price_per_unit) AS latest_price,
          MAX(currency)              AS currency
        FROM inventory_receipts
        GROUP BY product_id, store_id
      ),
      sold_totals AS (
        SELECT
          (line->>'productId') AS product_id,
          COALESCE(SUM((line->>'quantity')::int), 0) AS total_sold
        FROM orders,
             jsonb_array_elements(lines) AS line
        WHERE status IN ('confirmed', 'paid', 'shipped', 'delivered')
        GROUP BY (line->>'productId')
      ),
      last_audits AS (
        SELECT DISTINCT ON (product_id, store_id)
          product_id,
          store_id,
          audited_at       AS last_audited_at,
          counted_quantity AS last_counted_quantity,
          variance_units   AS last_variance_units,
          variance_baht    AS last_variance_baht,
          audit_type       AS last_audit_type
        FROM stock_audits
        ORDER BY product_id, store_id, audited_at DESC
      )
      SELECT
        rt.product_id,
        rt.store_id,
        COALESCE(p.name, rt.product_id)               AS product_name,
        rt.total_received,
        COALESCE(st.total_sold, 0)                    AS total_sold,
        GREATEST(0, rt.total_received - COALESCE(st.total_sold, 0)) AS expected_on_hand,
        rt.latest_price                               AS retail_price_per_unit,
        rt.currency,
        la.last_audited_at,
        la.last_counted_quantity,
        la.last_variance_units,
        la.last_variance_baht,
        la.last_audit_type
      FROM receipt_totals rt
      LEFT JOIN sold_totals st ON st.product_id = rt.product_id
      LEFT JOIN last_audits la ON la.product_id = rt.product_id AND la.store_id = rt.store_id
      LEFT JOIN LATERAL (
        SELECT name FROM products WHERE id = rt.product_id LIMIT 1
      ) p ON true
      ORDER BY last_variance_baht ASC NULLS LAST
    `);
    return result as unknown as InventoryBalanceRow[];
  } catch {
    // inventory_receipts / stock_audits tables not yet created
    return [];
  }
}

export type AuditSummaryRow = {
  audit_type: string;
  total_audits: string;
  total_variance_units: string;
  total_variance_baht: string;
};

export async function getAuditSummary(): Promise<AuditSummaryRow[]> {
  try {
    const result = await adminDb.execute(sql`
      SELECT
        audit_type,
        COUNT(*)              AS total_audits,
        SUM(variance_units)   AS total_variance_units,
        SUM(variance_baht)    AS total_variance_baht
      FROM stock_audits
      WHERE audited_at >= NOW() - INTERVAL '90 days'
      GROUP BY audit_type
      ORDER BY audit_type
    `);
    return result as unknown as AuditSummaryRow[];
  } catch {
    // stock_audits table not yet created
    return [];
  }
}
