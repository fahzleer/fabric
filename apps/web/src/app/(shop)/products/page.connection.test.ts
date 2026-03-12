/// <reference types="bun-types" />
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const PRODUCTS_PAGE = join(import.meta.dir, "page.tsx");
const source = readFileSync(PRODUCTS_PAGE, "utf-8");

describe("products/page.tsx — connection() guard", () => {
  it("imports connection from next/server", () => {
    expect(source).toContain('from "next/server"');
    expect(source).toContain("connection");
  });

  it("calls await connection() before Effect.runPromise", () => {
    const connectionIndex = source.indexOf("await connection()");
    const runPromiseIndex = source.indexOf("Effect.runPromise");
    expect(connectionIndex).toBeGreaterThan(-1);
    expect(runPromiseIndex).toBeGreaterThan(-1);
    expect(connectionIndex).toBeLessThan(runPromiseIndex);
  });

  it("still exports a default async function", () => {
    expect(source).toContain("export default async function");
  });
});
