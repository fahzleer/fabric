/**
 * Fabric storefront — motion tokens (see DESIGN.md §1.3 "Motion").
 *
 * One motion language for the customer-facing `(shop)` storefront: quick,
 * present, a little raw — DIY/gig-poster energy, never bouncy or springy.
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

/** Easing curves. `entrance` is a weighted ease-out for entrances; `settle`
 *  an ease-in-out for reversible state/transition changes. No overshoot.
 *  Renamed from editorial/smooth — those names belonged to the old quiet-
 *  luxury identity; the curve shapes themselves are unchanged. */
export const EASE = {
  entrance: [0.16, 1, 0.3, 1],
  settle: [0.4, 0, 0.2, 1],
} as const;

/** Duration scale (seconds). Retuned faster than the old "restrained"
 *  system — punk/DIY energy reads as quick and present, not lingering.
 *  `fast` (micro-interactions) was already snappy and is unchanged. */
export const DURATION = {
  fast: 0.2,
  base: 0.25,
  slow: 0.35,
} as const;

/** Subtle travel distances (px). Unchanged — speed carries the "punk" feel,
 *  not travel distance (more distance risks CLS/motion-sickness for no
 *  aesthetic gain). */
export const DISTANCE = {
  sm: 8,
  md: 16,
} as const;

export const springlessBase: Transition = {
  duration: DURATION.base,
  ease: EASE.entrance,
};

/** Content settling into place: fade + a small upward drift. */
export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: DISTANCE.md },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION.slow, ease: EASE.entrance },
  },
};

/** Quieter variant for items inside a stagger (less travel, faster). */
export const fadeInUpItem: Variants = {
  hidden: { opacity: 0, y: DISTANCE.sm },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION.base, ease: EASE.entrance },
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
    transition: { duration: DURATION.base, ease: EASE.entrance },
  },
};

/**
 * Hero / above-the-fold entrance (e.g. the featured-products hero on the
 * storefront landing). Same LCP-safety rule as `pageTransition` — **transform-only,
 * opacity never leaves 1** — so the LCP image (marked `priority`) is painted
 * immediately and only nudges into its resting position, never hidden pre-animation.
 * Use with `heroStagger` on the parent to offset each child slightly.
 */
export const heroSettle: Variants = {
  hidden: { y: DISTANCE.md },
  visible: {
    y: 0,
    transition: { duration: DURATION.slow, ease: EASE.entrance },
  },
};

/** Parent for `heroSettle` children — coordinates the hero + secondary cards
 *  mount animation (runs once immediately, not whileInView, since it's above
 *  the fold and already visible on first paint). */
export const heroStagger: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
};
