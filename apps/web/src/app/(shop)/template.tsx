import { PageTransition } from "@/components/motion/page-transition";
import type { ReactNode } from "react";

/**
 * Re-mounted by Next on every storefront navigation, so each page gets a quick
 * editorial fade-in for continuity. Server Component — the client boundary lives
 * inside PageTransition.
 */
export default function ShopTemplate({ children }: { children: ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
