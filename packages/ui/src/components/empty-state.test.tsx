import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "./empty-state";

describe("EmptyState", () => {
  it("renders the title", () => {
    render(<EmptyState title="Nothing here" />);
    expect(screen.getByText("Nothing here")).not.toBeNull();
  });

  it("renders the description when provided", () => {
    render(<EmptyState title="Empty" description="Add something" />);
    expect(screen.getByText("Add something")).not.toBeNull();
  });

  it("renders an action via children", () => {
    render(
      <EmptyState title="Empty">
        <button type="button">Do it</button>
      </EmptyState>
    );
    expect(screen.getByRole("button", { name: "Do it" })).not.toBeNull();
  });

  it("renders the icon slot", () => {
    render(<EmptyState title="Empty" icon={<svg data-testid="icon" />} />);
    expect(screen.getByTestId("icon")).not.toBeNull();
  });
});
