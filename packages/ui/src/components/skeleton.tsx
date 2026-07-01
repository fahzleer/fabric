import type * as React from "react";
import { cn } from "../lib/utils";

/**
 * Loading placeholder. Use multiple `<Skeleton>` blocks sized to the content they
 * stand in for. Decorative — hidden from assistive tech (the live region/page
 * spinner conveys "loading", not the shimmer).
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}

export { Skeleton };
