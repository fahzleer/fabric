"use client";

import { DURATION, EASE } from "@/lib/motion";
import { motion } from "motion/react";

/** Product-capacity bar that resizes smoothly on mount/update instead of snapping. */
export function AnimatedCapacityBar({ capacityPct }: { capacityPct: number }) {
  const barColour =
    capacityPct >= 90 ? "bg-destructive" : capacityPct >= 70 ? "bg-warning" : "bg-success";
  return (
    <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <motion.div
        className={`h-full rounded-full ${barColour}`}
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(100, capacityPct)}%` }}
        transition={{ duration: DURATION.slow, ease: EASE.entrance }}
      />
    </div>
  );
}
