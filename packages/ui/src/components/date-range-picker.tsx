"use client";
import * as React from "react";
import { cn } from "../lib/utils";

export type DateRange = {
  /** ISO date string (YYYY-MM-DD), inclusive. */
  from: string;
  /** ISO date string (YYYY-MM-DD), inclusive. */
  to: string;
};

type Preset = { label: string; days: number };

const PRESETS: Preset[] = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
];

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function rangeForLastNDays(days: number): DateRange {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - (days - 1));
  return { from: toIsoDate(from), to: toIsoDate(to) };
}

export interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
}

/**
 * A lightweight date-range filter: quick presets (7/30/90 days) plus two
 * native date inputs for a custom range. No calendar-grid dependency —
 * this is a filter control, not a scheduling UI.
 */
export const DateRangePicker = React.forwardRef<HTMLDivElement, DateRangePickerProps>(
  ({ value, onChange, className }, ref) => {
    const activePresetDays = PRESETS.find((p) => {
      const preset = rangeForLastNDays(p.days);
      return preset.from === value.from && preset.to === value.to;
    })?.days;

    return (
      <div ref={ref} className={cn("flex flex-wrap items-center gap-2", className)}>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-muted p-1">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => onChange(rangeForLastNDays(preset.days))}
              aria-pressed={activePresetDays === preset.days}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                activePresetDays === preset.days
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            aria-label="From date"
            value={value.from}
            max={value.to}
            onChange={(e) => onChange({ ...value, from: e.target.value })}
            className="rounded-lg border border-border bg-muted px-2.5 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <input
            type="date"
            aria-label="To date"
            value={value.to}
            min={value.from}
            onChange={(e) => onChange({ ...value, to: e.target.value })}
            className="rounded-lg border border-border bg-muted px-2.5 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
      </div>
    );
  }
);
DateRangePicker.displayName = "DateRangePicker";

export { rangeForLastNDays };
