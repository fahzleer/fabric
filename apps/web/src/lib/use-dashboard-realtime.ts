"use client";

import { useEffect, useRef, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3010";

async function fetchSessionToken(): Promise<string | null> {
  try {
    const res = await fetch("/api/auth/get-session", { credentials: "include" });
    const data = (await res.json()) as { session?: { token?: string } };
    return data.session?.token ?? null;
  } catch {
    return null;
  }
}

export type DashboardRealtimeHandlers = {
  onOrdersChanged?: () => void;
  onPayoutsChanged?: () => void;
};

/**
 * Subscribes to cf-api's `/events` SSE stream so dashboard stat cards can
 * update without a manual refresh. Pure progressive enhancement: if the
 * session token can't be fetched, or the connection fails, the page already
 * rendered its data server-side — this only adds live updates on top, it's
 * never required to see the page. The browser's native EventSource retries
 * automatically on drop; we don't hand-roll reconnect logic.
 */
export function useDashboardRealtime(handlers: DashboardRealtimeHandlers): { connected: boolean } {
  const [connected, setConnected] = useState(false);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    let es: EventSource | undefined;
    let cancelled = false;

    fetchSessionToken().then((token) => {
      if (cancelled || !token) return;
      es = new EventSource(`${API_BASE}/events?token=${encodeURIComponent(token)}`);
      es.onopen = () => setConnected(true);
      es.onerror = () => setConnected(false);
      es.addEventListener("orders_changed", () => handlersRef.current.onOrdersChanged?.());
      es.addEventListener("payouts_changed", () => handlersRef.current.onPayoutsChanged?.());
    });

    return () => {
      cancelled = true;
      es?.close();
    };
  }, []);

  return { connected };
}
