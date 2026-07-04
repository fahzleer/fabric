"use client";

import { useEffect, useState } from "react";

function probeWebgl(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

/**
 * Gates whether decorative 3D scenes should render at all. Defaults to
 * `false` until the client-side check resolves, so a canvas never mounts
 * before we know it's safe to — the fallback (a static gradient) is what
 * paints first everywhere this is used.
 *
 * Checks, in order: OS reduced-motion preference, data-saver mode, low core
 * count (a cheap proxy for low-end devices), and a real WebGL context probe.
 */
export function useCanRender3D(): boolean {
  const [canRender, setCanRender] = useState(false);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } })
      .connection;
    if (connection?.saveData) return;

    if (typeof navigator.hardwareConcurrency === "number" && navigator.hardwareConcurrency < 4) {
      return;
    }

    if (!probeWebgl()) return;

    setCanRender(true);
  }, []);

  return canRender;
}
