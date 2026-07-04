#!/usr/bin/env bun
/**
 * Phase 5 — light-surface neutral codemod (see DESIGN.md §8/§9).
 *
 * Maps the raw Tailwind grays still used by the storefront's marketing /
 * informational pages (about, guides, payment landings, locale landings,
 * product & products pages) onto the semantic token layer, so the Phase 5
 * `check-neutrals` guard can enforce a gray-free apps/web.
 *
 * These are LIGHT pages, so the mapping differs from the dark-zone codemod:
 *   text-gray-900/800  → foreground        text-gray-700/600/500 → muted-foreground
 *   text-gray-400/300/200 → faint          bg-gray-50 → muted   bg-gray-100/200 → secondary
 *   border-gray-100/200 → border           border-gray-300 → border-strong
 * The regular ink CTA/step-badge pattern (bg-gray-900 + text-white + hover:bg-gray-700/800)
 * maps to the primary token: bg-primary + text-primary-foreground + hover:bg-primary/90.
 *
 * The dark store/[slug] page is intentionally excluded — it carries `.dark` and
 * migrates via its own edit (dark surface hierarchy, not light).
 *
 * Run: bun run scripts/design/neutral-light-codemod.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SHOP = join(import.meta.dir, "../../apps/web/src/app/(shop)");
const FILES = [
  "about/page.tsx",
  "guides/page.tsx",
  "guides/how-to-order/page.tsx",
  "guides/returns/page.tsx",
  "payment/card/page.tsx",
  "payment/compare/page.tsx",
  "payment/promptpay/page.tsx",
  "products/page.tsx",
  "product/[id]/page.tsx",
  "en/my/page.tsx",
  "en/ph/page.tsx",
  "id/page.tsx",
  "vi/page.tsx",
].map((f) => join(SHOP, f));

type Rule = { util: string; from: string; to: string };
const RULES: Rule[] = [
  // ink CTA / step-badge — bg-gray-900 + text-white + hover:bg-gray-{700,800}
  { util: "bg", from: "gray-900", to: "primary" },
  { util: "bg", from: "gray-800", to: "primary/90" }, // only hover:bg-gray-800 in this set
  { util: "bg", from: "gray-700", to: "primary/90" }, // only hover:bg-gray-700 in this set
  { util: "text", from: "white", to: "primary-foreground" }, // always on the ink surface here
  // surfaces
  { util: "bg", from: "white", to: "card" }, // card surfaces on light pages (dark-ready)
  { util: "bg", from: "gray-50", to: "muted" },
  { util: "bg", from: "gray-100", to: "secondary" },
  { util: "bg", from: "gray-200", to: "secondary" },
  { util: "bg", from: "gray-300", to: "border-strong" },
  { util: "bg", from: "gray-400", to: "faint" },
  { util: "bg", from: "gray-600", to: "muted-foreground" },
  // text hierarchy — collapse to foreground / muted-foreground / faint
  { util: "text", from: "gray-900", to: "foreground" },
  { util: "text", from: "gray-800", to: "foreground" },
  { util: "text", from: "gray-700", to: "muted-foreground" },
  { util: "text", from: "gray-600", to: "muted-foreground" },
  { util: "text", from: "gray-500", to: "muted-foreground" },
  { util: "text", from: "gray-400", to: "faint" },
  { util: "text", from: "gray-300", to: "faint" },
  { util: "text", from: "gray-200", to: "faint" },
  // borders / dividers / ring
  { util: "border", from: "gray-100", to: "border" },
  { util: "border", from: "gray-200", to: "border" },
  { util: "border", from: "gray-300", to: "border-strong" },
  { util: "divide", from: "gray-50", to: "border" },
  { util: "divide", from: "gray-100", to: "border" },
  { util: "divide", from: "gray-200", to: "border" },
  { util: "ring", from: "gray-900", to: "ring" },
];

let files = 0;
let total = 0;
const perFile: Array<[string, number]> = [];

for (const file of FILES) {
  let src: string;
  try {
    src = readFileSync(file, "utf8");
  } catch {
    console.error(`  ! missing: ${file}`);
    continue;
  }
  let count = 0;
  for (const { util, from, to } of RULES) {
    // preserve any variant prefix (hover:, sm:, group-hover:, …) and /NN opacity
    const re = new RegExp(`((?:[a-z-]+:)*)${util}-${from}(?![\\w-])(/\\d+)?`, "g");
    src = src.replace(re, (_m, prefix, opacity = "") => {
      count++;
      return `${prefix}${util}-${to}${opacity}`;
    });
  }
  if (count > 0) {
    writeFileSync(file, src);
    files++;
    total += count;
    perFile.push([file.replace(`${SHOP}/`, ""), count]);
  }
}

perFile.sort((a, b) => b[1] - a[1]);
for (const [f, n] of perFile) console.log(`  ${String(n).padStart(3)}  ${f}`);
console.log(`\n${total} replacements across ${files} files`);
