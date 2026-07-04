"use client";

import { SceneCanvas } from "@/components/3d/scene-canvas";
import { fadeInUp } from "@/lib/motion";
import { motion } from "motion/react";

/**
 * Decorative gig-poster banner above the featured grid. Deliberately its own
 * band, not layered over the featured-grid's LCP image — the 3D canvas is
 * `pointer-events-none` and never competes with that image for first paint
 * (it mounts client-side only, well after the LCP element is already painted).
 */
export function HeroBanner() {
  return (
    <div className="relative h-40 overflow-hidden rounded-lg border border-border-strong sm:h-48">
      <SceneCanvas variant="hero" className="absolute inset-0 h-full w-full" />
      <motion.div
        className="pointer-events-none absolute inset-0 flex flex-col items-start justify-center px-6"
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
      >
        <h1 className="font-display tracking-wordmark text-3xl font-black text-foreground sm:text-4xl">
          WEAR THE NOISE
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          เสื้อวงดนตรีคุณภาพ พังก์ เมทัล อีโม ฮาร์ดคอร์ เดธคอร์
        </p>
      </motion.div>
    </div>
  );
}
