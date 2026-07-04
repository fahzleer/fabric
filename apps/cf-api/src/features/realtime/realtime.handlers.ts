import type { Database } from "firebase-admin/database";
import type { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { PasetoVerifierService } from "../../infrastructure/auth/paseto-verifier.service";
import { requireAuthEventSource } from "../../infrastructure/guards/auth.middleware";

const HEARTBEAT_MS = 25_000;
/** Coalesces a burst of Firebase child events (e.g. the initial child_added
 *  replay on attach) into a single notification instead of one per row. */
const DEBOUNCE_MS = 500;

function debounced(fn: () => void, delayMs: number): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return () => {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      fn();
    }, delayMs);
  };
}

/**
 * Server-Sent Events stream for live-updating dashboard stat cards. Watches
 * Firebase RTDB directly (via the Admin SDK's realtime listeners) rather
 * than an in-process event bus — that works correctly regardless of which
 * function instance handles a given request, unlike an in-memory emitter.
 * Payloads are just "something changed" pings; clients refetch their own
 * scoped data through the existing REST endpoints. No new dependency —
 * `hono/streaming` ships with the Hono version already in use.
 */
export function registerRealtimeRoutes(
  app: Hono,
  db: Database,
  verifier: PasetoVerifierService
): void {
  app.get("/events", requireAuthEventSource(verifier), async (c) => {
    return streamSSE(c, async (stream) => {
      const ordersRef = db.ref("orders");
      const payoutsRef = db.ref("payoutRequests");

      const notifyOrders = debounced(() => {
        void stream.writeSSE({ event: "orders_changed", data: String(Date.now()) });
      }, DEBOUNCE_MS);
      const notifyPayouts = debounced(() => {
        void stream.writeSSE({ event: "payouts_changed", data: String(Date.now()) });
      }, DEBOUNCE_MS);

      ordersRef.on("child_added", notifyOrders);
      ordersRef.on("child_changed", notifyOrders);
      payoutsRef.on("child_added", notifyPayouts);
      payoutsRef.on("child_changed", notifyPayouts);

      const heartbeat = setInterval(() => {
        void stream.writeSSE({ event: "heartbeat", data: String(Date.now()) });
      }, HEARTBEAT_MS);

      await new Promise<void>((resolve) => {
        stream.onAbort(() => {
          clearInterval(heartbeat);
          ordersRef.off("child_added", notifyOrders);
          ordersRef.off("child_changed", notifyOrders);
          payoutsRef.off("child_added", notifyPayouts);
          payoutsRef.off("child_changed", notifyPayouts);
          resolve();
        });
      });
    });
  });
}
