import type { Invoice, InvoiceStatus } from "./types";

const ORDER_SERVICE_URL = process.env.API_CORE_URL ?? "http://localhost:4000";

type RawInvoice = {
  id: string;
  customerId: string;
  amountCents: number;
  currency: string;
  status: string;
  createdAt: string;
  dueAt: string;
};

export async function getInvoices(): Promise<Invoice[]> {
  try {
    const res = await fetch(`${ORDER_SERVICE_URL}/api/orders/admin/invoices?limit=50`, {
      cache: "no-store",
    });
    if (!res.ok) {
      console.error(`[admin] getInvoices → ${res.status}`);
      return [];
    }
    const rows = (await res.json()) as RawInvoice[];
    return rows.map((r) => ({
      id: r.id,
      customerEmail: r.customerId, // userId used as customer identifier
      amountCents: r.amountCents,
      currency: r.currency,
      status: r.status as InvoiceStatus,
      createdAt: r.createdAt,
      dueAt: r.dueAt,
    }));
  } catch (e) {
    console.error("[admin] getInvoices failed:", e);
    return [];
  }
}
