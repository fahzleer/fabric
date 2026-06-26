#!/usr/bin/env bun
/**
 * Phase 3 — dark dashboard re-theme codemod (see DESIGN.md §8).
 *
 * The merchant + admin shells now carry `.dark`, so the token system resolves to
 * its dark palette there. This maps the hardcoded dark-mode neutrals (and the
 * remaining accent colors) onto tokens. Dark token values closely match the
 * grays they replace (gray-950≈background, gray-900≈card, gray-800≈muted,
 * white≈foreground, gray-400≈muted-foreground) so the result looks ~the same,
 * just token-driven and consistent.
 *
 * Scope: app/(merchant)/**, app/admin/**, components/merchant/**,
 * components/admin/**  (the only subtrees under `.dark`).
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const WEB = join(import.meta.dir, "../../apps/web/src");
const ZONES = [
  join(WEB, "app/(merchant)"),
  join(WEB, "app/admin"),
  join(WEB, "components/merchant"),
  join(WEB, "components/admin"),
];

// Ordered, literal class replacements. Applied with word-ish boundaries and
// preserving any variant prefix (hover:, focus:, group-hover:, sm:, …) and
// opacity suffix (/NN). We capture (prefix)(class)(opacity) per util.
type Rule = { util: string; from: string; to: string };
const RULES: Rule[] = [
  // backgrounds — surface hierarchy
  { util: "bg", from: "gray-950", to: "background" },
  { util: "bg", from: "gray-900", to: "card" },
  { util: "bg", from: "gray-800", to: "muted" },
  { util: "bg", from: "gray-700", to: "muted" },
  { util: "bg", from: "white", to: "muted" }, // bg-white/5 → subtle raised
  { util: "bg", from: "black", to: "background" },
  // text
  { util: "text", from: "white", to: "foreground" },
  { util: "text", from: "gray-100", to: "foreground" },
  { util: "text", from: "gray-200", to: "foreground" },
  { util: "text", from: "gray-300", to: "foreground" },
  { util: "text", from: "gray-400", to: "muted-foreground" },
  { util: "text", from: "gray-500", to: "muted-foreground" },
  { util: "text", from: "gray-600", to: "muted-foreground" },
  // borders / divide / ring
  { util: "border", from: "gray-700", to: "border" },
  { util: "border", from: "gray-800", to: "border" },
  { util: "border", from: "gray-900", to: "border" },
  { util: "border", from: "white", to: "border" },
  { util: "divide", from: "gray-800", to: "border" },
  { util: "divide", from: "gray-700", to: "border" },
  { util: "ring", from: "gray-700", to: "border" },
  { util: "ring", from: "gray-800", to: "border" },
];

// Accent families → functional tokens (same mapping as Phase 2)
const ACCENT: Record<string, string> = {
  emerald: "success", green: "success", teal: "success", lime: "success",
  amber: "warning", yellow: "warning", orange: "warning",
  red: "destructive", rose: "destructive", pink: "destructive",
  blue: "info", indigo: "info", violet: "info", cyan: "info", sky: "info", purple: "info",
};
const ACCENT_FAMILIES = Object.keys(ACCENT).join("|");
const ACCENT_UTILS = "bg|text|border|ring|from|to|via|divide|fill|stroke|ring-offset|placeholder|decoration";

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try { entries = readdirSync(dir); } catch { return out; }
  for (const e of entries) {
    const f = join(dir, e);
    if (statSync(f).isDirectory()) walk(f, out);
    else if (f.endsWith(".tsx")) out.push(f);
  }
  return out;
}

let files = 0;
let total = 0;
const perFile: Array<[string, number]> = [];
const seen = new Set<string>();

for (const zone of ZONES) {
  for (const file of walk(zone)) {
    if (seen.has(file)) continue;
    seen.add(file);
    let src = readFileSync(file, "utf8");
    let count = 0;

    // neutral rules
    for (const { util, from, to } of RULES) {
      const re = new RegExp(
        `((?:[a-z-]+:)*)${util}-${from.replace("/", "\\/")}(?![\\w])(/\\d+)?`,
        "g"
      );
      src = src.replace(re, (_m, prefix, opacity = "") => {
        count++;
        return `${prefix}${util}-${to}${opacity}`;
      });
    }

    // accent rules (shade-aware: bg-50/100 → subtle)
    const accentRe = new RegExp(
      `((?:[a-z-]+:)*)(${ACCENT_UTILS})-(${ACCENT_FAMILIES})-(\\d{2,3})(/\\d+)?`,
      "g"
    );
    src = src.replace(accentRe, (_m, prefix, util, family, shade, opacity = "") => {
      const fn = ACCENT[family];
      const token =
        util === "bg" && (shade === "50" || shade === "100") && opacity === ""
          ? `${fn}-subtle`
          : fn;
      count++;
      return `${prefix}${util}-${token}${opacity}`;
    });

    if (count > 0) {
      writeFileSync(file, src);
      files++;
      total += count;
      perFile.push([file.replace(`${WEB}/`, ""), count]);
    }
  }
}

perFile.sort((a, b) => b[1] - a[1]);
for (const [f, n] of perFile) console.log(`  ${String(n).padStart(3)}  ${f}`);
console.log(`\n${total} replacements across ${files} files`);
