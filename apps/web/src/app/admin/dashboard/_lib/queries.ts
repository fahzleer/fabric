const ORDER_SERVICE_URL = process.env.API_CORE_URL ?? "http://localhost:4000";

export type DashboardStats = {
  totalOrders: number;
  totalRevenueCents: number;
  currency: string;
  activeUsers30d: number;
  churnRatePct: number;
};

export async function getDashboardStats(): Promise<DashboardStats> {
  try {
    const res = await fetch(`${ORDER_SERVICE_URL}/api/orders/admin/stats`, { cache: "no-store" });
    if (!res.ok) {
      console.error(`[admin] getDashboardStats → ${res.status}`);
      return fallback();
    }
    return (await res.json()) as DashboardStats;
  } catch (e) {
    console.error("[admin] getDashboardStats failed:", e);
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
