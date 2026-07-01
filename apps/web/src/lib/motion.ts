/**
 * Fabric storefront — motion tokens (see DESIGN.md §10 "Motion").
 *
 * One motion language for the customer-facing `(shop)` storefront: quiet,
 * editorial, tactile — the way good fabric falls, never bouncy or springy.
 * Every value below is reused across surfaces so the whole storefront moves
 * coherently. Reduced-motion is honored globally by wrapping the storefront in
 * `<MotionProvider>` (MotionConfig reducedMotion="user"); these variants also
 * collapse to a plain cross-fade when the library reports reduced motion.
 *
 * Only compositor-friendly properties (`transform`, `opacity`) are animated —
 * never layout properties — so entrances never cause layout shift (CLS) and
 * interactions stay at 60fps.
 */
import type { Transition, Variants } from "motion/react";

/** Easing curves. `editorial` is a weighted ease-out for entrances; `smooth`
 *  an ease-in-out for reversible state/transition changes. No overshoot. */
export const EASE = {
  editorial: [0.16, 1, 0.3, 1],
  smooth: [0.4, 0, 0.2, 1],
} as const;

/** Duration scale (seconds). Micro-interactions fast; entrances base/slow. */
export const DURATION = {
  fast: 0.2,
  base: 0.4,
  slow: 0.6,
} as const;

/** Subtle travel distances (px). Restraint reads as premium. */
export const DISTANCE = {
  sm: 8,
  md: 16,
} as const;

export const springlessBase: Transition = {
  duration: DURATION.base,
  ease: EASE.editorial,
};

/** Content settling into place: fade + a small upward drift. */
export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: DISTANCE.md },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION.slow, ease: EASE.editorial },
  },
};

/** Quieter variant for items inside a stagger (less travel, faster). */
export const fadeInUpItem: Variants = {
  hidden: { opacity: 0, y: DISTANCE.sm },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION.base, ease: EASE.editorial },
  },
};

/** Parent that orchestrates a staggered reveal of its children. */
export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.06, delayChildren: 0.04 },
  },
};

/** Standard whileInView trigger — run once, start a little before fully in view. */
export const inViewOnce = {
  once: true,
  margin: "0px 0px -10% 0px",
  amount: 0.2,
} as const;

/**
 * Page/route settle (used by the (shop) template). Deliberately **transform-only**
 * (opacity stays 1): the template wraps above-the-fold content incl. the LCP
 * element, and an opacity-0 mount would leave that content invisible until
 * hydration — an LCP/CLS regression. A small upward settle keeps content painted
 * and only nudges `transform`, which the browser composites without reflow.
 */
export const pageTransition: Variants = {
  hidden: { y: DISTANCE.sm },
  visible: {
    y: 0,
    transition: { duration: DURATION.base, ease: EASE.editorial },
  },
};
