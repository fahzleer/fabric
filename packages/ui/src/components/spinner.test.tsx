import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Spinner } from "./spinner";

describe("Spinner", () => {
  it("renders with a status role", () => {
    render(<Spinner />);
    expect(screen.getByRole("status")).not.toBeNull();
  });

  it("exposes an accessible label", () => {
    render(<Spinner label="Saving" />);
    expect(screen.getByText("Saving")).not.toBeNull();
  });

  it("applies the size variant to the icon", () => {
    render(<Spinner size="lg" data-testid="spinner" />);
    const svg = screen.getByTestId("spinner").querySelector("svg");
    expect(svg?.getAttribute("class")).toContain("size-8");
  });

  it("applies custom className", () => {
    render(<Spinner className="text-info" data-testid="spinner" />);
    expect(screen.getByTestId("spinner").className).toContain("text-info");
  });
});
