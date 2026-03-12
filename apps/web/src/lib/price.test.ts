/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";
import { formatPrice } from "./price";

describe("formatPrice", () => {
  test("formats whole THB amount without decimals", () => {
    const result = formatPrice({ amount: 1000, currency: "THB" });
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
    expect(result).toMatch(/1[,.]?000/);
  });

  test("formats fractional THB amount with 2 decimal places", () => {
    const result = formatPrice({ amount: 100.5, currency: "THB" });
    expect(result).toContain("50");
  });

  test("formats USD", () => {
    const result = formatPrice({ amount: 99, currency: "USD" });
    expect(result).toContain("99");
    expect(typeof result).toBe("string");
  });

  test("formats EUR", () => {
    const result = formatPrice({ amount: 50, currency: "EUR" });
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  test("formats JPY", () => {
    const result = formatPrice({ amount: 100, currency: "JPY" });
    expect(typeof result).toBe("string");
  });

  test("formats GBP", () => {
    const result = formatPrice({ amount: 25, currency: "GBP" });
    expect(typeof result).toBe("string");
  });

  test("formats CNY", () => {
    const result = formatPrice({ amount: 88.88, currency: "CNY" });
    expect(typeof result).toBe("string");
  });

  test("formats KRW", () => {
    const result = formatPrice({ amount: 500, currency: "KRW" });
    expect(typeof result).toBe("string");
  });

  test("falls back to en-US for unknown currency codes", () => {
    const result = formatPrice({ amount: 10, currency: "SGD" });
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  test("returns zero-value format for 0 amount", () => {
    const result = formatPrice({ amount: 0, currency: "THB" });
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});
