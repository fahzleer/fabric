import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Input } from "./input";

describe("Input", () => {
  it("renders an input element", () => {
    render(<Input placeholder="Type here" />);
    expect(screen.getByPlaceholderText("Type here")).not.toBeNull();
  });

  it("defaults to text type when type is not specified", () => {
    render(<Input data-testid="input" />);
    const input = screen.getByTestId("input") as HTMLInputElement;
    expect(input.type).toBe("text");
  });

  it("applies the given type", () => {
    render(<Input type="email" data-testid="input" />);
    const input = screen.getByTestId("input") as HTMLInputElement;
    expect(input.type).toBe("email");
  });

  it("applies password type", () => {
    render(<Input type="password" data-testid="input" />);
    const input = screen.getByTestId("input") as HTMLInputElement;
    expect(input.type).toBe("password");
  });

  it("is disabled when disabled prop is true", () => {
    render(<Input disabled data-testid="input" />);
    const input = screen.getByTestId("input") as HTMLInputElement;
    expect(input.disabled).toBe(true);
  });

  it("calls onChange when value changes", () => {
    const onChange = vi.fn();
    render(<Input onChange={onChange} data-testid="input" />);
    fireEvent.change(screen.getByTestId("input"), { target: { value: "hello" } });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("applies custom className", () => {
    render(<Input className="border-red-500" data-testid="input" />);
    const input = screen.getByTestId("input");
    expect(input.className).toContain("border-red-500");
  });

  it("renders with defaultValue", () => {
    render(<Input defaultValue="hello" data-testid="input" />);
    const input = screen.getByTestId("input") as HTMLInputElement;
    expect(input.value).toBe("hello");
  });

  it("has correct displayName", () => {
    expect(Input.displayName).toBe("Input");
  });
});
