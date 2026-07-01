import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge } from "./badge";

describe("Badge", () => {
  it("renders children", () => {
    render(<Badge>New</Badge>);
    expect(screen.getByText("New")).not.toBeNull();
  });

  it("renders all variants without error", () => {
    const variants = [
      "default",
      "secondary",
      "destructive",
      "outline",
      "success",
      "warning",
      "info",
      "danger",
      "neutral",
    ] as const;
    for (const variant of variants) {
      const { unmount } = render(<Badge variant={variant}>{variant}</Badge>);
      expect(screen.getByText(variant)).not.toBeNull();
      unmount();
    }
  });

  it("uses default variant when none is specified", () => {
    render(<Badge data-testid="badge">Default</Badge>);
    const badge = screen.getByTestId("badge");
    expect(badge.className).toContain("bg-primary");
  });

  it("applies custom className", () => {
    render(
      <Badge className="custom-class" data-testid="badge">
        Test
      </Badge>
    );
    expect(screen.getByTestId("badge").className).toContain("custom-class");
  });

  it("passes through HTML attributes", () => {
    render(
      <Badge id="my-badge" data-testid="badge">
        Test
      </Badge>
    );
    expect(screen.getByTestId("badge").id).toBe("my-badge");
  });
});
