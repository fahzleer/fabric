import { adminDb } from "@/infrastructure/db/admin-db";
import { auth } from "@/lib/auth";
import { sql } from "drizzle-orm";
import { headers } from "next/headers";
import type { Invoice, InvoiceStatus } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3010";
const INTERNAL_SECRET = process.env.INTERNAL_SECRET ?? "";

type AdminOrder = {
  id: string;
  status: string;
  totalAmountInCents: number;
  currency: string;
  itemCount: number;
  placedAt: string;
  customerId: string;
};

async function issueAdminToken(userId: string, email: string): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/internal/issue-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-secret": INTERNAL_SECRET },
      body: JSON.stringify({ userId, email, role: "admin" }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { accessToken?: string };
    return data.accessToken ?? null;
  } catch {
    return null;
  }
}

async function fetchEmailMap(userIds: string[]): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();
  try {
    const inList = sql.join(
      userIds.map((id) => sql`${id}`),
      sql`,`
    );
    const rows = await adminDb.execute(sql`SELECT id, email FROM "user" WHERE id IN (${inList})`);
    const map = new Map<string, string>();
    for (const row of rows as unknown as Array<{ id: string; email: string }>) {
      map.set(row.id, row.email);
    }
    return map;
  } catch {
    return new Map();
  }
}

function orderToInvoice(order: AdminOrder, emailMap: Map<string, string>): Invoice {
  const placedAt = new Date(order.placedAt);
  const dueAt = new Date(placedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
  const status: InvoiceStatus =
    order.status === "delivered" ? "paid" : order.status === "cancelled" ? "overdue" : "pending";
  const email = emailMap.get(order.customerId) ?? `uid:${order.customerId.slice(0, 8)}`;
  return {
    id: order.id,
    customerEmail: email,
    amountCents: order.totalAmountInCents,
    currency: order.currency,
    status,
    createdAt: order.placedAt,
    dueAt: dueAt.toISOString(),
  };
}

export async function getInvoices(): Promise<Invoice[]> {
  try {
    const h = await headers();
    const session = await auth.api.getSession({ headers: h });
    if (!session?.user) return [];
    const user = session.user as { id: string; email: string };
    const token = await issueAdminToken(user.id, user.email);
    if (!token) return [];

    const res = await fetch(`${API_BASE}/admin/orders?perPage=100`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { items?: AdminOrder[] };
    const orders = (data.items ?? []).filter((o) => o.status !== "pending");

    const emailMap = await fetchEmailMap([...new Set(orders.map((o) => o.customerId))]);
    return orders.map((o) => orderToInvoice(o, emailMap));
  } catch {
    return [];
  }
}
