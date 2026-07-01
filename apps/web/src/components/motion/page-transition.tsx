"use client";

import { pageTransition } from "@/lib/motion";
import { motion } from "motion/react";
import type { ReactNode } from "react";

/**
 * Storefront route transition. Placed in `(shop)/template.tsx`, which Next
 * re-mounts on every navigation, so each page fades + drifts in for continuity.
 * Kept quick (base duration) so it never delays a shopper. Reduced-motion turns
 * it into an instant appearance via the MotionProvider.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <motion.div variants={pageTransition} initial="hidden" animate="visible">
      {children}
    </motion.div>
  );
}
