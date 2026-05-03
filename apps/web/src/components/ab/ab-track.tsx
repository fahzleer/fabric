"use client";

import { useEffect } from "react";

type Props = {
  experimentId: string;
  eventType?: string;
  metadata?: Record<string, unknown>;
};

export function ABTrack({ experimentId, eventType = "impression", metadata }: Props) {
  useEffect(() => {
    fetch("/api/ab/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ experimentId, eventType, metadata }),
    }).catch(() => {
      /* fire-and-forget — tracking failures are non-fatal */
    });
  }, [experimentId, eventType, metadata]);

  return null;
}
