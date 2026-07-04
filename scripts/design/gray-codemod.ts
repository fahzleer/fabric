#!/usr/bin/env bun
/**
 * Phase 5 — neutral gray migration codemod (see DESIGN.md §7.1 / §9).
 *
 * Maps raw Tailwind `gray-NNN` neutrals → the semantic token ramp so apps/web
 * stops bypassing the token layer. Variant prefixes (hover:, focus:, sm:,
 * group-hover:, dark:, …) and opacity modifiers (/80) are preserved.
 *
 * gray-400 folds into the dedicated `--faint` token (NOT muted-foreground) so the
 * ×261 intentionally-faint placeholders/icons/timestamps keep their lightness.
 *
 * Scoped — SKIPS surfaces where a light token would be wrong or is carved out:
 *   - analytics/_components  → data-viz (chart chrome); categorical/neutral mix,
 *     same carve-out as the accent codemod
 *   - global-error.tsx       → renders its own <html>, no token CSS at runtime
 *   - hardcoded-DARK islands  → (shop) landing/guide/payment heros, the dark
 *     store page, product pages with dark sections, and the modal backdrop.
 *     These use bg-gray-800/900/950 as their own surface; folding their grays to
 *     LIGHT tokens would render dark-on-dark. They migrate with the dark re-theme.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "../../apps/web/src");

// Hardcoded-dark files: excluded wholesale so we never fold dark-context grays
// onto light tokens. Tracked as a carve-out in check-grays.ts too.
const DARK_ISLANDS = new Set([
  "app/(shop)/about/page.tsx",
  "app/(shop)/en/my/page.tsx",
  "app/(shop)/en/ph/page.tsx",
  "app/(shop)/guides/how-to-order/page.tsx",
  "app/(shop)/guides/page.tsx",
  "app/(shop)/guides/returns/page.tsx",
  "app/(shop)/id/page.tsx",
  "app/(shop)/payment/card/page.tsx",
  "app/(shop)/payment/compare/page.tsx",
  "app/(shop)/payment/promptpay/page.tsx",
  "app/(shop)/product/[id]/page.tsx",
  "app/(shop)/products/page.tsx",
  "app/(shop)/store/[slug]/page.tsx",
  "app/(shop)/vi/page.tsx",
  "components/modal/modal-client.tsx",
  "components/modal/modal.tsx",
]);

const rel = (path: string) => path.replace(`${ROOT}/`, "");

const SKIP = (path: string) =>
  path.includes("/analytics/_components/") ||
  path.endsWith("global-error.tsx") ||
  DARK_ISLANDS.has(rel(path));

const UTILS =
  "bg|text|border|ring|from|to|via|divide|fill|stroke|ring-offset|outline|decoration|placeholder|caret|accent";

// (1) leading boundary, (2) variant prefixes, (3) util, (4) shade, (5) opacity
const RE = new RegExp(`([\\s"'\`{])((?:[a-z-]+:)*)(${UTILS})-gray-(\\d{2,3})(/\\d+)?`, "g");

function mapToken(util: string, shade: number): string {
  // Border-like utilities → border ramp
  if (["border", "divide", "ring", "outline", "ring-offset"].includes(util)) {
    return shade <= 200 ? "border" : "border-strong";
  }
  // Surface utilities → muted / secondary
  if (["bg", "from", "to", "via"].includes(util)) {
    if (shade <= 50) return "muted";
    if (shade <= 200) return "secondary";
    return "border-strong"; // dark-ish surface in a light file (rare; islands excluded)
  }
  // Text-like utilities (text, placeholder, fill, stroke, caret, decoration, accent)
  if (shade >= 800) return "foreground";
  if (shade >= 500) return "muted-foreground";
  return "faint"; // 100–400 → the dedicated faint tier
}

let totalFiles = 0;
let totalReplacements = 0;
const perFile: Array<[string, number]> = [];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith(".tsx")) out.push(full);
  }
  return out;
}

for (const file of walk(ROOT)) {
  if (SKIP(file)) continue;
  const src = readFileSync(file, "utf8");
  let count = 0;
  const next = src.replace(RE, (_m, lead, prefix, util, shade, opacity = "") => {
    count++;
    return `${lead}${prefix}${util}-${mapToken(util, Number(shade))}${opacity}`;
  });
  if (count > 0) {
    writeFileSync(file, next);
    totalFiles++;
    totalReplacements += count;
    perFile.push([rel(file), count]);
  }
}

perFile.sort((a, b) => b[1] - a[1]);
for (const [f, n] of perFile) console.log(`  ${String(n).padStart(3)}  ${f}`);
console.log(`\n${totalReplacements} gray replacements across ${totalFiles} files`);
