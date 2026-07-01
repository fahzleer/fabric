import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Alert, AlertDescription, AlertTitle } from "./alert";

describe("Alert", () => {
  it("renders with the alert role", () => {
    render(
      <Alert>
        <AlertTitle>Title</AlertTitle>
        <AlertDescription>Body</AlertDescription>
      </Alert>
    );
    expect(screen.getByRole("alert")).not.toBeNull();
    expect(screen.getByText("Title")).not.toBeNull();
    expect(screen.getByText("Body")).not.toBeNull();
  });

  it("defaults to the info variant surface", () => {
    render(<Alert data-testid="alert">x</Alert>);
    expect(screen.getByTestId("alert").className).toContain("bg-info-subtle");
  });

  it("uses the AA-legible warning text token", () => {
    render(
      <Alert variant="warning" data-testid="alert">
        x
      </Alert>
    );
    expect(screen.getByTestId("alert").className).toContain("warning-text");
  });

  it("renders each variant without error", () => {
    const variants = ["info", "success", "warning", "destructive"] as const;
    for (const variant of variants) {
      const { unmount } = render(
        <Alert variant={variant} data-testid="alert">
          {variant}
        </Alert>
      );
      expect(screen.getByTestId("alert")).not.toBeNull();
      unmount();
    }
  });
});
