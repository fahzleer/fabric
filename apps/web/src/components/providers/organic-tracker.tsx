"use client";

import { initOrganicTracking } from "@/lib/analytics";
import { useEffect } from "react";

export function OrganicTracker() {
  useEffect(() => {
    initOrganicTracking();
  }, []);
  return null;
}
