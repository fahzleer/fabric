/// <reference types="bun-types" />
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const MODAL_PAGE = fileURLToPath(new URL("page.tsx", import.meta.url));

const source = readFileSync(MODAL_PAGE, "utf-8");

describe("@modal/product/[id]/page.tsx — connection() guard", () => {
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
