#!/usr/bin/env bun
/**
 * Phase 5 — CI guard banning raw Tailwind `gray-NNN` neutrals in apps/web
 * (see DESIGN.md §7.1 / §9). Companion to check-accents.ts: that one bans raw
 * accent families, this one bans the neutral ramp. Use the semantic tokens:
 *   text-gray-{900,800}        → text-foreground
 *   text-gray-{700,600,500}    → text-muted-foreground
 *   text-gray-{400,300,…}      → text-faint
 *   bg-gray-50 / -100/200      → bg-muted / bg-secondary
 *   border-gray-{200,100}/{300+} → border-border / border-border-strong
 *
 * Documented carve-outs (same spirit as check-accents) — the ONLY exemptions:
 *   - analytics/_components — data-viz chart chrome (categorical/neutral mix)
 *   - global-error.tsx      — renders its own <html>, no token CSS at runtime
 *
 * The (shop) marketing/informational pages (about, guides, payment & locale
 * landings, product/products) were the last raw-gray holdouts; Phase 5 migrated
 * them to tokens (light pages via neutral-light-codemod.ts, the dark store page
 * via the dark surface hierarchy), so they are now ENFORCED — no carve-out.
 *
 * Also bans slate/zinc/neutral/stone so a future stray neutral family can't slip
 * in, even though the codebase only ever used Tailwind `gray`.
 *
 * Run: bun run scripts/design/check-grays.ts
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "../../apps/web/src");

const RE =
  /\b(bg|text|border|ring|divide|from|to|via|fill|stroke|placeholder|caret|decoration|outline|ring-offset|accent)-(gray|slate|zinc|neutral|stone)-\d{2,3}/g;

const rel = (p: string) => p.replace(`${ROOT}/`, "");

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
      violations.push({ file: rel(file), line: i + 1, cls: m[0] });
    }
  });
}

if (violations.length === 0) {
  console.log("✓ no raw gray-* neutrals in token-driven apps/web surfaces");
  process.exit(0);
}

console.error(`✗ ${violations.length} raw gray neutral(s) found — use semantic tokens:\n`);
for (const v of violations) console.error(`  ${v.file}:${v.line}  ${v.cls}`);
console.error("\n  text-gray-{900,800}→text-foreground   text-gray-{700,600,500}→text-muted-foreground");
console.error("  text-gray-{400-}→text-faint   bg-gray-50/100→bg-muted/secondary");
console.error("  border-gray-200/300→border-border/border-strong");
console.error("  (only analytics charts + global-error are carved out)");
process.exit(1);
