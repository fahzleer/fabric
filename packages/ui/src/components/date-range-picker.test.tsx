import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DateRangePicker, rangeForLastNDays } from "./date-range-picker";

describe("rangeForLastNDays", () => {
  it("returns a range spanning exactly N days inclusive", () => {
    const range = rangeForLastNDays(7);
    const from = new Date(range.from);
    const to = new Date(range.to);
    const diffDays = Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(6);
  });

  it("ends today", () => {
    const range = rangeForLastNDays(30);
    expect(range.to).toBe(new Date().toISOString().slice(0, 10));
  });
});

describe("DateRangePicker", () => {
  it("renders preset buttons and date inputs", () => {
    render(<DateRangePicker value={rangeForLastNDays(7)} onChange={vi.fn()} />);
    expect(screen.getByText("7d")).not.toBeNull();
    expect(screen.getByText("30d")).not.toBeNull();
    expect(screen.getByText("90d")).not.toBeNull();
    expect(screen.getByLabelText("From date")).not.toBeNull();
    expect(screen.getByLabelText("To date")).not.toBeNull();
  });

  it("marks the matching preset as active", () => {
    render(<DateRangePicker value={rangeForLastNDays(30)} onChange={vi.fn()} />);
    expect(screen.getByText("30d").getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("7d").getAttribute("aria-pressed")).toBe("false");
  });

  it("calls onChange with a new preset range when a preset is clicked", () => {
    const onChange = vi.fn();
    render(<DateRangePicker value={rangeForLastNDays(7)} onChange={onChange} />);
    fireEvent.click(screen.getByText("90d"));
    expect(onChange).toHaveBeenCalledWith(rangeForLastNDays(90));
  });

  it("calls onChange when the from-date input changes", () => {
    const onChange = vi.fn();
    const value = rangeForLastNDays(7);
    render(<DateRangePicker value={value} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("From date"), { target: { value: "2026-01-01" } });
    expect(onChange).toHaveBeenCalledWith({ ...value, from: "2026-01-01" });
  });

  it("shows no active preset for a custom range", () => {
    render(<DateRangePicker value={{ from: "2026-01-01", to: "2026-01-15" }} onChange={vi.fn()} />);
    expect(screen.getByText("7d").getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByText("30d").getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByText("90d").getAttribute("aria-pressed")).toBe("false");
  });
});
