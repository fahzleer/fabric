"use client";

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";

/**
 * Wraps the storefront in a single MotionConfig so every `motion` component
 * honors the OS `prefers-reduced-motion` setting automatically (`reducedMotion:
 * "user"` disables transform/opacity animations, keeping content in place).
 * Client boundary is kept shallow — it renders children straight through, so the
 * pages below stay Server Components.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
