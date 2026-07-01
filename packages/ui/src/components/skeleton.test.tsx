import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Skeleton } from "./skeleton";

describe("Skeleton", () => {
  it("renders the pulse placeholder", () => {
    render(<Skeleton data-testid="skeleton" />);
    expect(screen.getByTestId("skeleton").className).toContain("animate-pulse");
  });

  it("is hidden from assistive tech", () => {
    render(<Skeleton data-testid="skeleton" />);
    expect(screen.getByTestId("skeleton").getAttribute("aria-hidden")).toBe("true");
  });

  it("merges custom className", () => {
    render(<Skeleton className="h-4 w-48" data-testid="skeleton" />);
    const cls = screen.getByTestId("skeleton").className;
    expect(cls).toContain("h-4");
    expect(cls).toContain("bg-muted");
  });
});
