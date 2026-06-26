#!/usr/bin/env bun
/**
 * Phase 2 — accent-color consolidation codemod (see DESIGN.md §8).
 *
 * Maps the 14 ad-hoc Tailwind accent families → the 5 functional design tokens.
 * Deliberately SCOPED to light, status-semantic UI:
 *   - SKIPS analytics/_components (data-viz — categorical hues are intentional,
 *     they belong on the --chart-* palette, not the status tokens)
 *   - SKIPS (merchant)/ and admin/ (hardcoded-dark dashboards — token neutrals
 *     break there until the Phase 3 dark re-theme adds `.dark`)
 *   - SKIPS global-error (renders its own <html>, no token CSS available)
 *
 * Shade rules:
 *   bg-{F}-50 / -100        → bg-{fn}-subtle   (tinted surface)
 *   bg-{F}-{200..950}       → bg-{fn}          (solid)
 *   text|border|ring|from|to|via-{F}-{any} → ...-{fn}
 * Variant prefixes (hover:, focus:, dark:, group-hover:, sm:, …) and opacity
 * modifiers (/20) are preserved.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "../../apps/web/src");

const FAMILY_TO_FN: Record<string, string> = {
  emerald: "success",
  green: "success",
  teal: "success",
  lime: "success",
  amber: "warning",
  yellow: "warning",
  orange: "warning",
  red: "destructive",
  rose: "destructive",
  pink: "destructive",
  blue: "info",
  indigo: "info",
  violet: "info",
  cyan: "info",
  sky: "info",
  purple: "info",
};

const FAMILIES = Object.keys(FAMILY_TO_FN).join("|");
const UTILS = "bg|text|border|ring|from|to|via|divide|fill|stroke|ring-offset|outline|decoration|placeholder|caret|accent";

// Captures: (1) leading boundary, (2) variant prefixes, (3) util, (4) family, (5) shade, (6) opacity
const RE = new RegExp(
  `([\\s"'\`{])((?:[a-z-]+:)*)(${UTILS})-(${FAMILIES})-(\\d{2,3})(/\\d+)?`,
  "g"
);

const SKIP = (path: string) =>
  path.includes("/analytics/_components/") ||
  path.includes("/(merchant)/") ||
  path.includes("/admin/") ||
  path.endsWith("global-error.tsx");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith(".tsx")) out.push(full);
  }
  return out;
}

let totalFiles = 0;
let totalReplacements = 0;
const perFile: Array<[string, number]> = [];

for (const file of walk(ROOT)) {
  if (SKIP(file)) continue;
  const src = readFileSync(file, "utf8");
  let count = 0;
  const next = src.replace(RE, (_m, lead, prefix, util, family, shade, opacity = "") => {
    const fn = FAMILY_TO_FN[family];
    const isBgSubtle = util === "bg" && (shade === "50" || shade === "100") && opacity === "";
    const token = isBgSubtle ? `${fn}-subtle` : fn;
    count++;
    return `${lead}${prefix}${util}-${token}${opacity}`;
  });
  if (count > 0) {
    writeFileSync(file, next);
    totalFiles++;
    totalReplacements += count;
    perFile.push([file.replace(ROOT, "apps/web/src"), count]);
  }
}

perFile.sort((a, b) => b[1] - a[1]);
for (const [f, n] of perFile) console.log(`  ${String(n).padStart(3)}  ${f}`);
console.log(`\n${totalReplacements} replacements across ${totalFiles} files`);
