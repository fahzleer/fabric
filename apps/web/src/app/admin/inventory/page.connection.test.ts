import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const PAGE = fileURLToPath(new URL("page.tsx", import.meta.url));
const source = readFileSync(PAGE, "utf-8");

describe("admin/inventory/page.tsx — connection() guard", () => {
  it("imports connection from next/server", () => {
    expect(source).toContain('from "next/server"');
    expect(source).toContain("connection");
  });

  it("calls await connection() before data fetches", () => {
    const connectionIndex = source.indexOf("await connection()");
    const fetchIndex = source.indexOf("await Promise.all(");
    expect(connectionIndex).toBeGreaterThan(-1);
    expect(fetchIndex).toBeGreaterThan(-1);
    expect(connectionIndex).toBeLessThan(fetchIndex);
  });

  it("still exports a default async function", () => {
    expect(source).toContain("export default async function");
  });
});
