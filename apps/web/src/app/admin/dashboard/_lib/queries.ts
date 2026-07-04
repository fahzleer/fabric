import { auth } from "@/lib/auth";
import { headers } from "next/headers";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3010";
const INTERNAL_SECRET = process.env.INTERNAL_SECRET ?? "";

export type DashboardStats = {
  totalOrders: number;
  totalRevenueCents: number;
  currency: string;
  /**
   * All-time confirmed-or-later order count — cf-api's `getAdminStats()`
   * (order.service.ts) computes this from an unbounded `findAll`, no date
   * filter. Previously exposed here as `activeUsers30d` (fed from the same
   * `confirmedOrders` field but labeled/rendered as a 30-day unique-buyer
   * count on the dashboard) — that was wrong on two counts: it isn't a
   * buyer count, and it isn't scoped to 30 days. Renamed to reflect what
   * the number actually is; a real unique-buyers-in-30-days metric would
   * need a new backend query, out of scope here.
   */
  confirmedOrders: number;
  pendingOrders: number;
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

export async function getDashboardStats(): Promise<DashboardStats> {
  try {
    const h = await headers();
    const session = await auth.api.getSession({ headers: h });
    if (!session?.user) return fallback();
    const user = session.user as { id: string; email: string };
    const token = await issueAdminToken(user.id, user.email);
    if (!token) return fallback();

    const res = await fetch(`${API_BASE}/admin/stats`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return fallback();
    const data = (await res.json()) as {
      totalOrders?: number;
      totalRevenueCents?: number;
      currency?: string;
      confirmedOrders?: number;
      pendingOrders?: number;
    };
    return {
      totalOrders: data.totalOrders ?? 0,
      totalRevenueCents: data.totalRevenueCents ?? 0,
      currency: data.currency ?? "THB",
      confirmedOrders: data.confirmedOrders ?? 0,
      pendingOrders: data.pendingOrders ?? 0,
    };
  } catch {
    return fallback();
  }
}

function fallback(): DashboardStats {
  return {
    totalOrders: 0,
    totalRevenueCents: 0,
    currency: "THB",
    confirmedOrders: 0,
    pendingOrders: 0,
  };
}
