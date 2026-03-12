import { adminDb } from "@/infrastructure/db/admin-db";
import { sql } from "drizzle-orm";
import type { Invoice, InvoiceStatus } from "./types";

type Row = Record<string, unknown>;

export async function getInvoices(): Promise<Invoice[]> {
  const rows = await adminDb.execute(sql`
    SELECT
      o.id,
      u.email                                    AS customer_email,
      o.total_amount_in_cents                    AS amount_cents,
      o.currency,
      CASE o.status
        WHEN 'delivered'   THEN 'paid'
        WHEN 'cancelled'   THEN 'overdue'
        ELSE                    'pending'
      END                                        AS status,
      o.placed_at                                AS created_at,
      (o.placed_at + INTERVAL '30 days')         AS due_at
    FROM orders o
    JOIN users u ON u.id = o.user_id
    WHERE o.status != 'pending'
    ORDER BY o.placed_at DESC
    LIMIT 50
  `);

  return (rows as Row[]).map((r) => ({
    id: String(r.id),
    customerEmail: String(r.customer_email),
    amountCents: Number(r.amount_cents),
    currency: String(r.currency ?? "THB"),
    status: String(r.status) as InvoiceStatus,
    createdAt: String(r.created_at),
    dueAt: String(r.due_at),
  }));
}
