import { auth } from "@/lib/auth";
import { headers } from "next/headers";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3010";
const INTERNAL_SECRET = process.env.INTERNAL_SECRET ?? "";

export type DashboardStats = {
  totalOrders: number;
  totalRevenueCents: number;
  currency: string;
  activeUsers30d: number;
  churnRatePct: number;
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
      activeUsers30d: data.confirmedOrders ?? 0,
      churnRatePct: 0,
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
    activeUsers30d: 0,
    churnRatePct: 0,
  };
}
