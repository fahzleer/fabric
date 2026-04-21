import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC = import.meta.dir;
const DOMAIN_ROOT = join(SRC, "domain");
const SHARED_ROOT = join(SRC, "shared");

function* walkTs(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      yield* walkTs(full);
      continue;
    }
    if (full.endsWith(".ts") && !full.endsWith(".spec.ts")) yield full;
  }
}

function findThrows(root: string): string[] {
  const offenders: string[] = [];
  for (const file of walkTs(root)) {
    const source = readFileSync(file, "utf8");
    source.split("\n").forEach((line, index) => {
      const stripped = line.replace(/\/\/.*$/, "").replace(/\/\*.*\*\//g, "");
      if (/(^|[\s;{])throw\s/.test(stripped)) {
        offenders.push(`${file}:${index + 1}  ${line.trim()}`);
      }
    });
  }
  return offenders;
}

describe("architecture: domain + application layer purity", () => {
  test("no `throw` in domain/ (use Result/Either instead)", () => {
    expect(findThrows(DOMAIN_ROOT)).toEqual([]);
  });

  test("no `throw` in shared/ application use-cases (use Result/Either instead)", () => {
    expect(findThrows(SHARED_ROOT)).toEqual([]);
  });
});
