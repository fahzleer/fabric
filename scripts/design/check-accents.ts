#!/usr/bin/env bun
/**
 * CI guard — bans raw Tailwind accent colors in light, status-semantic UI.
 * Enforces the Phase 2 consolidation (DESIGN.md §7.2): use the functional
 * tokens (success / warning / info / destructive / brand) instead of raw
 * bg-{emerald,green,amber,red,blue,…}-NNN.
 *
 * Scoped exclusions:
 *   - analytics/_components — data-viz; categorical hues belong on --chart-*
 *   - global-error          — renders its own <html>, no token CSS
 * As of Phase 3 the merchant + admin dashboards are token-driven (dark theme),
 * so they ARE enforced now. packages/ui is the ONE place raw colors are allowed.
 *
 * Run: bun run scripts/design/check-accents.ts
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "../../apps/web/src");

const RE =
  /\b(bg|text|border|ring|from|to|via|divide|fill|stroke|ring-offset|placeholder|decoration)-(emerald|green|teal|lime|amber|yellow|orange|red|rose|pink|blue|indigo|violet|cyan|sky|purple)-\d{2,3}/g;

const SKIP = (p: string) =>
  p.includes("/analytics/_components/") || p.endsWith("global-error.tsx");

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const f = join(dir, e);
    if (statSync(f).isDirectory()) walk(f, out);
    else if (f.endsWith(".tsx")) out.push(f);
  }
  return out;
}

const violations: Array<{ file: string; line: number; cls: string }> = [];

for (const file of walk(ROOT)) {
  if (SKIP(file)) continue;
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    for (const m of line.matchAll(RE)) {
      violations.push({ file: file.replace(`${ROOT}/`, ""), line: i + 1, cls: m[0] });
    }
  });
}

if (violations.length === 0) {
  console.log("✓ no raw accent colors in light status-semantic UI");
  process.exit(0);
}

console.error(`✗ ${violations.length} raw accent color(s) found — use functional tokens:\n`);
for (const v of violations) console.error(`  ${v.file}:${v.line}  ${v.cls}`);
console.error("\n  bg-{green,emerald}-* → bg-success    bg-{amber,yellow}-* → bg-warning");
console.error("  bg-{red,rose}-*       → bg-destructive  bg-{blue,indigo}-* → bg-info");
console.error("  (charts → --chart-* tokens; merchant/admin dark → Phase 3)");
process.exit(1);
