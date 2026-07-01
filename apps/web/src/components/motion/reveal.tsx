"use client";

import { fadeInUp, fadeInUpItem, inViewOnce, staggerContainer } from "@/lib/motion";
import { type HTMLMotionProps, motion } from "motion/react";
import type { ElementType, ReactNode } from "react";

type RevealProps = {
  children: ReactNode;
  className?: string;
  /** Render as a different element (e.g. "section", "li"). Defaults to div. */
  as?: ElementType;
  /** Extra delay (s) before this element settles — for hand-tuned choreography. */
  delay?: number;
} & Omit<HTMLMotionProps<"div">, "children" | "className">;

/**
 * Single-element editorial entrance: fades and drifts up as it scrolls into
 * view, once. Reduced-motion collapses it to a plain fade (handled by the
 * MotionProvider). Only opacity/transform animate → no layout shift.
 */
export function Reveal({ children, className, as = "div", delay, ...rest }: RevealProps) {
  const MotionTag = motion[as as keyof typeof motion] as typeof motion.div;
  return (
    <MotionTag
      className={className}
      variants={fadeInUp}
      initial="hidden"
      whileInView="visible"
      viewport={inViewOnce}
      {...(delay ? { transition: { delay } } : {})}
      {...rest}
    >
      {children}
    </MotionTag>
  );
}

/**
 * Stagger container — reveals its `RevealItem` children one after another as the
 * group enters the viewport. Use for grids/lists so the eye is guided, not
 * bombarded.
 */
export function RevealGroup({ children, className, as = "div", ...rest }: RevealProps) {
  const MotionTag = motion[as as keyof typeof motion] as typeof motion.div;
  return (
    <MotionTag
      className={className}
      variants={staggerContainer}
      initial="hidden"
      whileInView="visible"
      viewport={inViewOnce}
      {...rest}
    >
      {children}
    </MotionTag>
  );
}

/** A single staggered child inside a `RevealGroup`. */
export function RevealItem({
  children,
  className,
  as = "div",
  ...rest
}: Omit<RevealProps, "delay">) {
  const MotionTag = motion[as as keyof typeof motion] as typeof motion.div;
  return (
    <MotionTag className={className} variants={fadeInUpItem} {...rest}>
      {children}
    </MotionTag>
  );
}
