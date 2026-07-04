import { type VariantProps, cva } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import type * as React from "react";
import { cn } from "../lib/utils";

const spinnerVariants = cva("animate-spin text-current", {
  variants: {
    size: {
      sm: "size-4",
      default: "size-6",
      lg: "size-8",
    },
  },
  defaultVariants: {
    size: "default",
  },
});

export interface SpinnerProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof spinnerVariants> {
  /** Accessible label announced to screen readers. */
  label?: string;
}

/**
 * Inline loading indicator. Inherits color from `currentColor`, so it adopts the
 * text color of whatever it's placed in (e.g. a Button). `role="status"` + an
 * sr-only label keep it announced; the icon itself is decorative.
 */
function Spinner({ className, size, label = "Loading", ...props }: SpinnerProps) {
  // <output> carries an implicit role="status" (a polite live region) — more
  // semantic than <span role="status"> and satisfies a11y/useSemanticElements.
  return (
    <output className={cn("inline-flex", className)} {...props}>
      <Loader2 className={spinnerVariants({ size })} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </output>
  );
}

export { Spinner, spinnerVariants };
