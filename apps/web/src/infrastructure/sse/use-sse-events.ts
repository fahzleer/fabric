"use client";

import { useEffect, useRef } from "react";
import { clearSsePosition, getSseLastEventId, saveSseLastEventId } from "../dexie/sse-position.db";

interface UseSseEventsOptions {
  readonly userId: string;
  readonly eventsUrl: string;
  readonly onMessage: (data: string) => void;
  readonly onError?: (err: Event) => void;
}

export function useSseEvents({ userId, eventsUrl, onMessage, onError }: UseSseEventsOptions): void {
  const onMessageRef = useRef(onMessage);
  const onErrorRef = useRef(onError);
  onMessageRef.current = onMessage;
  onErrorRef.current = onError;

  useEffect(() => {
    let es: EventSource | null = null;
    let closed = false;

    async function connect() {
      const lastEventId = await getSseLastEventId(userId);
      const url = lastEventId
        ? `${eventsUrl}/sse/${userId}?lastEventId=${encodeURIComponent(lastEventId)}`
        : `${eventsUrl}/sse/${userId}`;

      es = new EventSource(url, { withCredentials: true });

      es.onmessage = (e) => {
        if (e.lastEventId) {
          saveSseLastEventId(userId, e.lastEventId).catch(() => undefined);
        }
        onMessageRef.current(e.data);
      };

      es.onerror = (e) => {
        onErrorRef.current?.(e);
        if (es?.readyState === EventSource.CLOSED) {
          if (!closed) {
            setTimeout(() => {
              if (!closed) connect();
            }, 3000);
          }
        }
      };
    }

    connect();

    return () => {
      closed = true;
      es?.close();
    };
  }, [userId, eventsUrl]);
}

export { clearSsePosition };
