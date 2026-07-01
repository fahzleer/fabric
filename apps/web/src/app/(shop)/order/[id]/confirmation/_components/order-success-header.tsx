"use client";

import { EASE } from "@/lib/motion";
import { motion } from "motion/react";

/**
 * The order-confirmation completion moment: the success ring scales in, the
 * checkmark draws itself, then the heading and order id settle. Calm and
 * satisfying — this is post-payment, so there's no conversion cost to a slightly
 * longer, deliberate entrance. Reduced-motion (via MotionProvider) renders it
 * instantly with no drawing. Purely decorative motion; content is unchanged.
 */
export function OrderSuccessHeader({ orderId }: { orderId: string }) {
  return (
    <div className="text-center mb-8">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: EASE.editorial }}
        className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-success-subtle"
      >
        <svg
          className="h-8 w-8 text-success"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <motion.path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.5, ease: EASE.editorial, delay: 0.25 }}
          />
        </svg>
      </motion.div>
      <motion.h1
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE.editorial, delay: 0.15 }}
        className="text-3xl font-bold text-foreground"
      >
        Order Placed!
      </motion.h1>
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE.editorial, delay: 0.22 }}
        className="mt-2 text-muted-foreground"
      >
        Thank you for your order. Your order ID is:
      </motion.p>
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE.editorial, delay: 0.29 }}
        className="mt-1 text-lg font-mono font-semibold text-info"
      >
        #{orderId}
      </motion.p>
    </div>
  );
}
