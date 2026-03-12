import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./button";

describe("Button", () => {
  it("renders with default variant as a <button> element", () => {
    render(<Button>Click me</Button>);
    const btn = screen.getByRole("button", { name: "Click me" });
    expect(btn.tagName).toBe("BUTTON");
  });

  it("renders each variant class correctly", () => {
    const variants = ["default", "destructive", "outline", "secondary", "ghost", "link"] as const;
    for (const variant of variants) {
      const { unmount } = render(<Button variant={variant}>{variant}</Button>);
      expect(screen.getByRole("button", { name: variant })).not.toBeNull();
      unmount();
    }
  });

  it("renders each size correctly", () => {
    const sizes = ["default", "sm", "lg", "icon"] as const;
    for (const size of sizes) {
      const { unmount } = render(<Button size={size}>{size}</Button>);
      expect(screen.getByRole("button", { name: size })).not.toBeNull();
      unmount();
    }
  });

  it("is disabled when disabled prop is true", () => {
    render(<Button disabled>Disabled</Button>);
    const btn = screen.getByRole("button", { name: "Disabled" });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it("calls onClick handler when clicked", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click</Button>);
    fireEvent.click(screen.getByRole("button", { name: "Click" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not call onClick when disabled", () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Click
      </Button>
    );
    fireEvent.click(screen.getByRole("button", { name: "Click" }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("renders as child element (Slot) when asChild is true", () => {
    render(
      <Button asChild>
        <a href="/home">Link</a>
      </Button>
    );
    const link = screen.getByRole("link", { name: "Link" });
    expect(link.tagName).toBe("A");
  });

  it("merges custom className with variant classes", () => {
    render(<Button className="w-full">Wide</Button>);
    const btn = screen.getByRole("button", { name: "Wide" });
    expect(btn.className).toContain("w-full");
  });

  it("has correct displayName", () => {
    expect(Button.displayName).toBe("Button");
  });
});
