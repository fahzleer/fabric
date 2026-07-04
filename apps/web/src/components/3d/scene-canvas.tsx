"use client";

import { inViewOnce } from "@/lib/motion";
import { useInView } from "motion/react";
import dynamic from "next/dynamic";
import { useRef } from "react";
import type { PrimitiveSceneVariant } from "./primitive-scene";
import { useCanRender3D } from "./use-can-render-3d";

const PrimitiveScene = dynamic(() => import("./primitive-scene").then((m) => m.PrimitiveScene), {
  ssr: false,
});

type SceneCanvasProps = {
  variant: PrimitiveSceneVariant;
  className?: string;
  /** Defers mounting the (expensive) canvas until scrolled into view. Use
   *  for below-the-fold placements like the cart/checkout decorative band —
   *  never for the hero, which is already above the fold on mount. */
  lazyMount?: boolean;
};

/**
 * The only entry point pages should use for decorative 3D. Handles every
 * safety rule in one place: dynamic-imports the actual three.js scene
 * (never in the SSR/initial bundle), never renders under reduced-motion or
 * on a low-power/data-saver device (falls back to a static gradient
 * instead of blank space), and can defer mounting until scrolled into view.
 * Always decorative — `pointer-events-none` so it never sits between a
 * shopper and a clickable element.
 */
export function SceneCanvas({ variant, className = "", lazyMount = false }: SceneCanvasProps) {
  const canRender = useCanRender3D();
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, lazyMount ? inViewOnce : { once: true, amount: 0 });

  const shouldMount = canRender && (!lazyMount || isInView);

  return (
    <div
      ref={containerRef}
      className={`pointer-events-none select-none bg-gradient-to-br from-background via-card to-background ${className}`}
      aria-hidden="true"
    >
      {shouldMount && <PrimitiveScene variant={variant} />}
    </div>
  );
}
