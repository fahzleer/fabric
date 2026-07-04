"use client";

import { useDashboardRealtime } from "@/lib/use-dashboard-realtime";
import { useRouter } from "next/navigation";

/**
 * Mount once per dashboard page. Re-runs the page's server data fetch
 * (via router.refresh()) whenever cf-api's SSE stream reports a relevant
 * change, so stat cards update live — reusing the count-up/reveal motion
 * already built for these cards rather than a separate live-update path.
 */
export function DashboardRealtimeRefresh() {
  const router = useRouter();
  useDashboardRealtime({
    onOrdersChanged: () => router.refresh(),
    onPayoutsChanged: () => router.refresh(),
  });
  return null;
}
