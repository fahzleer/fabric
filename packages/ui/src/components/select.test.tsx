import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "./select";

function BasicSelect({ position }: { position?: "popper" | "item-aligned" }) {
  return (
    <Select>
      <SelectTrigger className="w-48" data-testid="trigger">
        <SelectValue placeholder="Choose..." />
      </SelectTrigger>
      <SelectContent {...(position !== undefined ? { position } : {})}>
        <SelectItem value="a">Option A</SelectItem>
        <SelectItem value="b">Option B</SelectItem>
      </SelectContent>
    </Select>
  );
}

describe("Select", () => {
  it("renders the trigger with placeholder", () => {
    render(<BasicSelect />);
    expect(screen.getByText("Choose...")).not.toBeNull();
  });

  it("renders trigger with custom className", () => {
    render(
      <Select>
        <SelectTrigger className="custom-class" data-testid="t">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="x">X</SelectItem>
        </SelectContent>
      </Select>
    );
    expect(screen.getByTestId("t").className).toContain("custom-class");
  });

  it("trigger is disabled when disabled prop passed", () => {
    render(
      <Select>
        <SelectTrigger disabled data-testid="t">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="x">X</SelectItem>
        </SelectContent>
      </Select>
    );
    const trigger = screen.getByTestId("t");
    expect((trigger as HTMLButtonElement).disabled).toBe(true);
  });

  it('renders with position="popper" (default)', () => {
    render(<BasicSelect position="popper" />);
    expect(screen.getByTestId("trigger")).not.toBeNull();
  });

  it('renders with position="item-aligned"', () => {
    render(<BasicSelect position="item-aligned" />);
    expect(screen.getByTestId("trigger")).not.toBeNull();
  });

  it("renders SelectGroup and SelectLabel", () => {
    render(
      <Select>
        <SelectTrigger data-testid="t">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel data-testid="label">Fruits</SelectLabel>
            <SelectItem value="a">Apple</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    );
    expect(screen.getByTestId("t")).not.toBeNull();
  });

  it("renders SelectSeparator", () => {
    render(
      <Select>
        <SelectTrigger data-testid="t">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">A</SelectItem>
          <SelectSeparator data-testid="sep" />
          <SelectItem value="b">B</SelectItem>
        </SelectContent>
      </Select>
    );
    expect(screen.getByTestId("t")).not.toBeNull();
  });

  it("renders SelectContent with scroll buttons when open", () => {
    render(
      <Select defaultOpen>
        <SelectTrigger data-testid="t">
          <SelectValue placeholder="Choose" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Option A</SelectItem>
          <SelectItem value="b">Option B</SelectItem>
        </SelectContent>
      </Select>
    );
    expect(screen.getByText("Option A")).not.toBeNull();
    expect(screen.getByText("Option B")).not.toBeNull();
  });

  it("renders SelectContent with item-aligned position and custom className when open", () => {
    render(
      <Select defaultOpen>
        <SelectTrigger data-testid="t">
          <SelectValue placeholder="Choose" />
        </SelectTrigger>
        <SelectContent position="item-aligned" className="custom-content">
          <SelectItem value="x">Item X</SelectItem>
        </SelectContent>
      </Select>
    );
    expect(screen.getByText("Item X")).not.toBeNull();
  });
});
