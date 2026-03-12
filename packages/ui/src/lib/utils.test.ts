import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn (class name utility)", () => {
  it("merges single class", () => {
    expect(cn("text-red-500")).toBe("text-red-500");
  });

  it("merges multiple classes", () => {
    const result = cn("px-4", "py-2", "rounded");
    expect(result).toContain("px-4");
    expect(result).toContain("py-2");
    expect(result).toContain("rounded");
  });

  it("deduplicates conflicting Tailwind classes (last wins)", () => {
    const result = cn("text-red-500", "text-blue-500");
    expect(result).toBe("text-blue-500");
    expect(result).not.toContain("text-red-500");
  });

  it("handles conditional class with falsy value", () => {
    const result = cn("base", false);
    expect(result).toBe("base");
    expect(result).not.toContain("not-included");
  });

  it("handles conditional class with truthy value", () => {
    const result = cn("base", "included");
    expect(result).toContain("included");
  });

  it("handles undefined and null gracefully", () => {
    const result = cn("base", undefined, null as unknown as string);
    expect(result).toBe("base");
  });

  it("returns empty string for no inputs", () => {
    expect(cn()).toBe("");
  });

  it("handles array of classes", () => {
    const result = cn(["px-4", "py-2"]);
    expect(result).toContain("px-4");
    expect(result).toContain("py-2");
  });
});
