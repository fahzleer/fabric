"use client";

import { useEffect } from "react";

interface ExperimentCookieSetterProps {
  experimentId: string;
}

function getCookieValue(name: string): string | undefined {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match?.[1];
}

function pushDataLayer(event: string, payload: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  const dataLayer = (window as { dataLayer?: unknown[] }).dataLayer;
  if (Array.isArray(dataLayer)) {
    dataLayer.push({ event, ...payload });
  }
}

/** Assigns a stable variant cookie on first visit (50/50 split) and tracks assignment. */
export function ExperimentCookieSetter({ experimentId }: ExperimentCookieSetterProps) {
  useEffect(() => {
    const key = `exp_${experimentId}`;
    const assignedKey = `exp_${experimentId}_assigned`;
    const existing = getCookieValue(key);

    if (!existing) {
      const variant = Math.random() < 0.5 ? "control" : "variant";
      // 30-day stable assignment
      document.cookie = `${key}=${variant};path=/;max-age=2592000;SameSite=Lax`;
      sessionStorage.setItem(assignedKey, variant);
      pushDataLayer("experiment_assignment", {
        experiment_id: experimentId,
        experiment_variant: variant,
      });
    } else {
      sessionStorage.setItem(assignedKey, existing);
      // Emit assignment once per session so GA4 captures the dimension even on repeat visits.
      if (!sessionStorage.getItem(`${assignedKey}_tracked`)) {
        sessionStorage.setItem(`${assignedKey}_tracked`, "1");
        pushDataLayer("experiment_assignment", {
          experiment_id: experimentId,
          experiment_variant: existing,
        });
      }
    }
  }, [experimentId]);

  return null;
}
