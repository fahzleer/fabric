import type * as React from "react";
import { cn } from "../lib/utils";

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Decorative icon (lucide or svg). Sized to 24px and muted automatically. */
  icon?: React.ReactNode;
  title: string;
  description?: string;
}

/**
 * Centered empty / no-results state. Pass an action (e.g. a `<Button>`) as
 * children. Tokenized throughout — no raw grays/accents.
 */
function EmptyState({ icon, title, description, className, children, ...props }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-12 text-center",
        className
      )}
      {...props}
    >
      {icon ? (
        <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground [&_svg]:size-6">
          {icon}
        </div>
      ) : null}
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children ? <div className="mt-2">{children}</div> : null}
    </div>
  );
}

export { EmptyState };
