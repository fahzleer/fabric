# Fabric — Design System

> **v2 — Punk/Band-Merch Identity Redesign (current).** Sections 3, 4, 5, 7,
> 9, and 10 describe the **current** system. §0–§2, §6, and §8 below that
> predate this redesign are kept as **historical record** of the original
> token-consolidation project (still an accurate account of *how* the token
> architecture came to exist) — their *specific color/radius values* are
> superseded by §1 in this preface and by the updated §3/§4/§5/§7/§9/§10.
>
> **Why this redesign happened.** A UX/IA audit (see the redesign roadmap,
> §11) found a fundamental brand-identity mismatch: Fabric sells band/
> subculture t-shirts (genres: Punk, Metal, Emo, Hardcore, Deathcore — see
> `apps/web/src/app/(shop)/products/_lib/product-helpers.ts`), but the
> original system (§0–§7 below) was "quiet luxury editorial" — an ink/cream/
> thread-gold palette with a Playfair Display serif, restrained "the way good
> fabric falls" motion. A punk/metal merch shop should not look like a
> minimalist fashion boutique. This redesign replaces the palette, radius,
> shadow, typography, and motion timing with a dark-canvas, high-contrast,
> gig-poster-derived identity, and fixes the real IA/friction problems the
> audit surfaced (orphaned content pages, forced login at checkout, English
> labels in a Thai-first UI, blind admin approvals, a mislabeled KPI). See
> §11 for the full roadmap and evidence log.
>
> **How this was measured.** Tokens below are extracted from the source of truth
> (`apps/web/src/app/globals.css`, the Tailwind class usage across all 48 page
> routes, and `packages/ui`). Because Fabric owns this code, the Tailwind classes
> *are* the exact values DevTools would compute — reading source is more precise
> than reverse-engineering computed pixels off the live DOM.
>
> Counts in this doc = number of occurrences across `apps/web/src/**/*.tsx`.

---

## 0. Audit summary — why we're redoing this

There is already a clean token system in `globals.css` (semantic HSL vars +
a `fabric-*` brand palette) and a proper shadcn-style component library in
`packages/ui`. **The web app uses almost none of it.**

| Signal | Finding |
|---|---|
| `@fabric/ui` imports in `apps/web` | **0 files** — the component library is dead weight |
| Raw `<button>` tags with inline classes | **62** |
| Semantic token usage (`text-muted-foreground`) | **1** occurrence (vs `text-gray-400` ×261) |
| Distinct accent color families in use | **14** (emerald, red, blue, amber, green, violet, indigo, purple, yellow, orange, cyan, rose, pink, teal) |
| Dead custom utilities | `font-editorial` 0, `tracking-wordmark` 0, `font-serif` 0 |
| Price typography | uses `text-gray-900`, ignores the defined `.font-price` (tabular mono) |
| `--radius` token (4px) vs actual card radius | components use `rounded-lg`/`rounded-xl` (8–12px) — token unused |

**Conclusion:** the problem isn't "no system," it's "three half-systems
ignoring each other." The redesign consolidates to **one** semantic token
layer that both `apps/web` and `packages/ui` consume.

---

## 1. Type scale — *measured (current)*

Font: **Geist** (sans, UI) + **Geist Mono** (numerals), loaded via `next/font`.
Geist is open-license (OFL/Vercel) and metrically close to Inter — no swap needed.

| Role | Class (actual) | Size | Line-height | Weight | Count |
|---|---|---|---|---|---|
| Body / default | `text-sm` | 14px / 0.875rem | 20px | 400–500 | 471 |
| Meta / label / caption | `text-xs` | 12px / 0.75rem | 16px | 500 | 328 |
| Section heading | `text-2xl` | 24px / 1.5rem | 32px | 600–700 | 63 |
| Card title | `text-lg` | 18px / 1.125rem | 28px | 600 | 39 |
| Price | `text-xl` | 20px / 1.25rem | 28px | 700 | 28 |
| Page heading (h1) | `text-3xl` | 30px / 1.875rem | 36px | 700 | 28 |
| Hero | `text-4xl` | 36px / 2.25rem | 40px | 700 | 8 |

**Weights in use:** `font-medium` (500) ×315 · `font-semibold` (600) ×225 ·
`font-bold` (700) ×120 · `font-normal` (400) ×1.
**Letter-spacing:** default (0) everywhere; the only tracked utilities
(`tracking-wordmark` 0.15em, `.font-editorial` −0.02em) are **unused**.

> ⚠️ Observation: the type scale skips `text-base` (16px, only ×11). Body text
> is 14px-dominant — fine for dense dashboards, slightly tight for an editorial
> storefront. Proposed scale (§7) reintroduces 16px as reading-body.

---

## 2. Spacing scale — *measured (current)*

Base unit = **4px** (Tailwind default). Consistent. The scale is well-behaved;
the issue is breadth, not the step.

| Token | px | Primary use | Count |
|---|---|---|---|
| `gap-1` / `p-1` | 4px | icon ↔ label | 24 |
| `gap-2` / `px-2` | 8px | inline groups, pills | 57 |
| `gap-3` / `px-3` | 12px | button internals | 63 |
| `gap-4` / `p-4` | 16px | card padding, grid gutter | 58 |
| `px-4` | 16px | **the** horizontal rhythm | 260 |
| `py-3` | 12px | **the** control height pad | 179 |
| `px-6` / `p-6` | 24px | section padding | 74 |
| `px-8` / `p-8` | 32px | hero / large cards | 23 |

**De-facto rhythm:** horizontal `px-4` (16), vertical control `py-3` (12),
card `p-4`/`p-6` (16/24), section gap `gap-4` (16).
Defined fluid tokens `--space-page` / `--space-section` exist but are **unused**.

---

## 3. Color — *measured (current)*

The app runs on raw **Tailwind `gray`** (cool gray), not the HSL semantic tokens.

### Neutrals (actual hex = Tailwind `gray`)

| Role | Class | Hex | HSL | Count |
|---|---|---|---|---|
| Text primary | `text-gray-900` | `#111827` | 221 39% 11% | 177 |
| Text secondary | `text-gray-700` | `#374151` | 217 19% 27% | 114 |
| Text muted | `text-gray-600` | `#4b5563` | 215 14% 34% | 103 |
| Text subtle | `text-gray-500` | `#6b7280` | 220 9% 46% | 146 |
| Text placeholder / icon | `text-gray-400` | `#9ca3af` | 218 11% 65% | 261 |
| Border | `border-gray-200` | `#e5e7eb` | 220 13% 91% | — |
| Surface subtle | `bg-gray-50` | `#f9fafb` | 210 20% 98% | 85 |
| Surface muted | `bg-gray-100` | `#f3f4f6` | 220 14% 96% | 32 |
| Dark surface (dashboards) | `bg-gray-800` / `-900` | `#1f2937` / `#111827` | — | 135 |

### Functional / brand (actual)

| Role | Class | Hex | Count |
|---|---|---|---|
| Brand red (destructive / OOS) | `bg-red-500` / `text-red-500` | `#ef4444` | 33 / — |
| Error surface | `bg-red-50` | `#fef2f2` | 15 |
| Success | `bg-emerald-500` / `text-emerald-400` | `#10b981` | 58 / 33 |
| Warning | `bg-amber-500` | `#f59e0b` | 30 |
| Info / link | `bg-blue-600` / `text-blue-600` | `#2563eb` | 23 |

### The defined-but-unused token layer (`globals.css`)

```
--foreground        0 0% 4%      (#0a0a0a)   ← only 11 uses via text-foreground
--muted-foreground  0 0% 42%     (#6b6b6b)   ← 1 use
--border            0 0% 91%     (#e8e8e8)   ← 4 uses
--destructive       0 72% 51%    (#dc2626)   ← unused in app
--primary           0 0% 6%      (#0f0f0f)   ← 1 use
fabric-ink   #0a0a0a · fabric-cream #f5f0e8 · fabric-thread #c4a882
fabric-smoke #6b6b6b · fabric-linen #e8e2d8   ← brand palette, 0 uses
```

> ⚠️ Shadow color: every shadow uses Tailwind's default
> (`rgb(0 0 0 / 0.05–0.1)`), neutral black — no branded shadow tint.

### 3.5 Color — v2 punk identity (**current**, supersedes above)

Dark-canvas is now the **app-wide default** (`<html className="dark">` in
`apps/web/src/app/layout.tsx`) — the storefront moved from a light "quiet
luxury" shell to the same dark identity merchant/admin already used. `:root`
remains only as a lighter print/email escape hatch, not the primary experience.

| Token | Value (HSL) | Hex approx | Role |
|---|---|---|---|
| `--background` | `0 0% 3%` | `#080808` | deep black canvas |
| `--foreground` | `40 15% 94%` | `#efeceA` | cool bone-white (dropped the old warm-cream tint) |
| `--card` / `--popover` | `0 0% 8%` | `#141414` | raised surface |
| `--primary` | `0 0% 96%` | `#f5f5f5` | flat near-white button — 1–2 color print aesthetic, not tonal gold |
| `--secondary` | `0 0% 14%` | — | |
| `--muted` | `0 0% 13%` | — | |
| `--muted-foreground` | `0 0% 66%` | — | |
| `--brand` / `--accent` | `355 78% 48%` | `#c2263d` "riot red" | primary CTA accent, active nav, price emphasis |
| `--destructive` | `0 84% 48%` | `#c22a1a`-ish | errors, out-of-stock |
| `--border` / `--border-strong` | `0 0% 20%` / `0 0% 32%` | — | visible, heavier borders — hard edges, not soft hairlines |
| `--ring` | `355 78% 48%` (= brand) | — | focus ring reinforces brand on every keyboard interaction |
| `--radius` | `0.25rem` (4px) | — | sharp corners — gig-poster/flyer edges, not boutique-soft |

**Brand vs. destructive hue separation (verified, not assumed).** `--brand`
sits at hue 355 (crimson) and `--destructive` at hue 0 (red-orange) — a
deliberate ~15° split so a payment CTA and an error message never read as the
same swatch. **Lightness was computed, not guessed**: both were originally
drafted at a lighter 56–60%, but WCAG contrast math against their white
`-foreground` text measured **3.78–4.19:1 — failing AA's 4.5:1 normal-text
threshold**. Darkening both to **48% lightness** measures **4.87:1** (destructive)
and **5.03:1** (brand) — passing comfortably. This is the same rigor the
original system applied when it caught `text-warning`'s ~1.7:1 failure (§7.2)
— measure the actual ratio, don't eyeball it.

**Card treatment:** the soft blur-shadow elevation model is replaced by a
**flat offset "sticker" shadow** on product-card hover (`2px 2px 0 0
hsl(var(--border-strong))`) instead of `shadow-md` — the single highest-impact
micro-decision for reading as "merch" rather than "menswear." Modals/dropdowns
keep normal soft shadows (functional elevation, not a brand statement).

---

## 4. Border radius — *measured (current)*

| Token | px | Use | Count |
|---|---|---|---|
| `rounded` | 4px | inputs, small chips | 50 |
| `rounded-sm` | 2px | tags | 12 |
| `rounded-md` | 6px | buttons (shared UI) | 9 |
| `rounded-lg` | 8px | **cards** (dominant) | 204 |
| `rounded-xl` | 12px | large cards, modals | 114 |
| `rounded-2xl` | 16px | login card, feature panels | 6 |
| `rounded-full` | ∞ | pills, badges, avatars | 107 |

> ⚠️ `--radius: 0.25rem` (4px) in `globals.css` is the nominal token but real
> cards are 8–12px. The token doesn't reflect reality.

> **v2 update (current):** `--radius` is `0.25rem` (4px) again — but this time
> deliberately, not a stale unused value. The punk identity (§3.5) wants sharp,
> gig-poster edges; `rounded-lg`/`rounded-xl` cards now render genuinely
> sharper (`--radius-lg` = 4px, `--radius-md` = 2px, `--radius-sm` = 0px) via
> the existing `--radius-sm/md/lg` calc chain in `@theme inline` — no separate
> per-tier edits needed.

---

## 5. Shadow — *measured (current)*

| Token | Value (Tailwind) | Use | Count |
|---|---|---|---|
| `shadow-sm` | `0 1px 2px 0 rgb(0 0 0 / .05)` | card resting (dominant) | 59 |
| `shadow` | `0 1px 3px 0 rgb(0 0 0 / .1)` | — | 4 |
| `shadow-md` | `0 4px 6px −1px rgb(0 0 0 / .1)` | card hover | 4 |
| `shadow-lg` | `0 10px 15px −3px rgb(0 0 0 / .1)` | dropdown | 1 |
| `shadow-xl` | `0 20px 25px −5px rgb(0 0 0 / .1)` | modal | 2 |

**Card hover pattern (actual):** `shadow-sm` → `hover:shadow-md` +
`transition-shadow`. Product image: `group-hover:scale-105`.

> **v2 update (current):** product-card hover replaces `shadow-md` with a flat
> offset "sticker" shadow (`2px 2px 0 0 hsl(var(--border-strong))`) — see §3.5.
> Modals/dropdowns are unchanged (functional elevation, not a brand statement).

---

## 6. Grid & containers — *measured (current)*

| Context | Breakpoint behavior | Count |
|---|---|---|
| Product grid | `grid-cols-1` → `sm:grid-cols-2` → `lg:grid-cols-3` → `xl:grid-cols-4` | — |
| Dense data | `grid-cols-2` → `sm:grid-cols-3/4` | 24 |
| Forms / panels | `grid-cols-1` → `md:grid-cols-2` | — |
| Gutter | `gap-4` (16px) default, `gap-6` (24px) on wide | 58 / 4 |

**Containers:** `max-w-7xl` (1280px) main shell ×12 · `max-w-2xl/3xl`
(672/768px) content ×21 · `max-w-md` (448px) auth cards ×10.
Page inset: `px-4 sm:px-6 lg:px-8` (16 → 24 → 32px).
Tailwind breakpoints (default): `sm` 640 · `md` 768 · `lg` 1024 · `xl` 1280 · `2xl` 1536.

---

## 7. Proposed token system — *the redesign target*

One semantic layer, consumed by **both** `apps/web` and `packages/ui`.
Keep the HSL-var pattern already in `globals.css` (it supports dark mode);
fix the values to match reality and **map the Tailwind grays onto it** so
migration is a find-and-replace, not a redraw.

> **Naming reconciliation (decided in Phase 0).** We use **shadcn semantic
> names** (`foreground`, `muted-foreground`, `border`, `destructive`, `primary`)
> rather than inventing `--fg`/`text-fg`, because `packages/ui` already consumes
> those names — adopting them keeps it to *one* system. Neutrals use the Fabric
> pure-neutral brand ramp (`--foreground: 0 0% 4%` = fabric-ink), not shadcn's
> default cool-slate. Values live in `apps/web/src/app/globals.css` and
> `packages/ui/src/index.css`, kept in lockstep.

### 7.1 Neutrals → semantic tokens *(implemented Phase 0)*

| Semantic token (utility) | Light value | Replaces (current) |
|---|---|---|
| `text-foreground` | `0 0% 4%` (#0a0a0a) | `text-gray-900` |
| `text-muted-foreground` | `0 0% 42%` (#6b6b6b) | `text-gray-500/600` |
| `bg-background` | `0 0% 100%` | `bg-white` |
| `bg-muted` / `bg-secondary` | `0 0% 94/96%` | `bg-gray-50/100` |
| `border-border` / `border-input` | `0 0% 91%` (#e8e8e8) | `border-gray-200` |
| `border-border-strong` | `0 0% 84%` | `border-gray-300` |

> The current code uses **4** gray text levels (900/700/600/500/400). The target
> collapses to a **2-tier** hierarchy (foreground + muted-foreground). The most
> common class is `text-gray-400` (×261, faint) — Phase 3 decides whether it
> folds into `muted-foreground` or gets one dedicated `*-faint` token to avoid
> darkening a lot of currently-light text.

### 7.2 Functional — collapse 14 families → **5**, one shade each *(implemented Phase 0; `brand`/`destructive` values superseded — see §3.5)*

| Token (utility prefix) | Value | Subsumes |
|---|---|---|
| `brand` | `355 78% 48%` (#c2263d "riot red") — was `36 38% 64%` thread gold | the punk/band-merch accent (see §3.5) |
| `success` | `160 84% 39%` (#10b981) | emerald + green (257 uses) |
| `warning` | `38 92% 50%` (#f59e0b) | amber + yellow + orange (136) |
| `destructive` | `0 84% 60%` (#ef4444) | red + rose (174) |
| `info` | `221 83% 53%` (#2563eb) | blue + indigo + violet/cyan (209) |

Each has a `-foreground` (on-color text) and a `-subtle` (tinted surface, e.g.
`bg-destructive-subtle`, `bg-warning-subtle`). **No other accent colors permitted
in status-semantic UI.**

> **Carve-out — data-viz is NOT status (discovered in Phase 2).** Charts and
> segment swatches (RFM, cohort, funnel, CLV…) legitimately need 5–8
> *distinguishable* hues to separate categories — collapsing them to 5 functional
> tokens would make adjacent series the same color. Those use the categorical
> **`--chart-1..5`** palette (already defined in `packages/ui/src/index.css`),
> not the status tokens. The "no other accents" rule therefore applies to
> status/semantic UI, **not** to `analytics/_components/*`.
>
> ⚠️ **Known a11y gap:** `text-warning` (amber-500) on `bg-warning-subtle` is
> ~1.7:1 — fails AA for small text. Revisit in the Phase 4 contrast pass (either
> darken `--warning` for text use or add a `--warning-text` token).

### 7.3 Type scale — 7 steps, reintroduce 16px body

| Token | Size / LH | Weight | Use |
|---|---|---|---|
| `text-caption` | 12 / 16 | 500 | meta, labels |
| `text-body-sm` | 14 / 20 | 400 | dense UI, tables |
| `text-body` | **16 / 24** | 400 | reading body (NEW default for storefront) |
| `text-title` | 18 / 28 | 600 | card titles |
| `text-price` | 20 / 28 | 700, **mono tabular** | prices (revive `.font-price`) |
| `text-h2` | 24 / 32 | 600 | section |
| `text-h1` | 30 / 36 | 700 | page |
| `text-display` | 36–48 / 1.1 | 700, display font | hero |

> **v2 update (current):** the display role now pairs with `.font-display`
> (Kanit, `--font-display`) instead of Playfair `--font-serif` — see §3.5's
> sibling typography note below and §10 for the full rationale (Playfair was
> Latin-only and, per the original audit, never even applied to Thai content;
> Kanit is one family natively covering Thai + Latin at every weight 100–900).

### 7.4 Radius / shadow / spacing — restrict the scale

| Category | Keep only | Drop |
|---|---|---|
| Radius | `sm` 0 (inputs) · `lg` 4 (cards) · `xl` 8 (modals) · `full` (pills) | `rounded` bare, `2xl`, `3xl` |
| Shadow | `xs`=resting · `md`=hover/raised (sticker-offset on cards, see §3.5) · `xl`=overlay/modal | the rest |
| Spacing | 4-base: 1,2,3,4,6,8,12,16 | ad-hoc 5,7 etc. |

> **v2 update (current):** `--radius` is `0.25rem` (4px), not `0.5rem` (8px) —
> the punk identity wants sharp gig-poster edges. See §3.5/§4.

### 7.5 Grid — canonical

```
Container:  max-w-7xl (1280)  ·  inset px-4 sm:px-6 lg:px-8
Product:    cols 1 → sm:2 → lg:3 → xl:4   ·  gutter gap-4 sm:gap-6
Content:    max-w-3xl (768) prose
Form:       cols 1 → md:2  ·  gap-4
```

---

## 8. System Design Roadmap

Phased so each step ships independently and nothing regresses. Effort = rough.

### Phase 0 — Foundation (tokens) · ✅ DONE
- [x] Expose **all** semantic tokens in `@theme inline` (was only bg/fg) so
      `packages/ui`'s `bg-primary` / `bg-destructive` / `text-muted-foreground`
      actually resolve — verified: Sign-in button now computes `rgb(15,15,15)`
      (`--primary`), was unstyled before.
- [x] Add the 5 functional colors (`success`/`warning`/`info`/`destructive`/
      `brand`) + `-foreground` + `-subtle` surfaces to both `globals.css` and
      `packages/ui/src/index.css`.
- [x] Align `packages/ui` neutrals to the Fabric pure-neutral brand ramp (was
      shadcn cool-slate) → both files now share one palette.
- [x] Set `--radius: 0.5rem` + `--radius-sm/md/lg` scale; `.font-price` /
      `--font-serif` (Playfair) wired into `@theme`.

### Phase 1 — Adopt `packages/ui` in `apps/web` · ✅ DONE (light surfaces)
- [x] Wire `@fabric/ui` into `apps/web`: add dep + `transpilePackages` in
      `next.config.ts` (package ships raw TSX) + `bun install`.
- [x] Extend `<Button>` with `success` / `info` / `warning` variants (shadcn
      only ships default/destructive/outline/secondary/ghost/link).
- [x] **Critical Tailwind fix:** added `@source "../../../../packages/ui/src"`
      to `globals.css`. Tailwind v4 ignores `node_modules`, so utilities used
      *only* inside `@fabric/ui` (Button's `h-9`/`h-11` sizes, variant bg
      colors) were never generated → `size="sm"` buttons rendered 22px tall
      instead of 36px. Verified fixed (h-9 → 36px) in the browser.
- [x] Raw `<button>` swept **60 → 23**. All light shopper + auth surfaces use
      `<Button>` / `<Input>`: login, register, store-register, product-filters,
      cart-item-row, add-to-cart, order-summary, address/omise/stripe/promptpay/
      x402 payment forms, checkout tabs, nav user-menu, product error/not-found,
      analytics tools, payout approve/reject.
- [x] Verified in browser: `/products` (filter pills toggle outline↔primary,
      `font-price` mono revived on prices), `/auth/login`. 720 tests green.
- [x] `<Card>`: product-card surface tokenized (`bg-card`/`border-border`); the
      `<Card>` component fits non-interactive panels — clickable cards (Link
      roots) are tokenized in place instead.

**Intentionally left raw (23 remaining):**
- ~14 non-button affordances: payment-method tabs & filter segmented controls,
  password-visibility toggles, text-link buttons (Remove / Clear), modal close
  icon, size-selector toggle. These are tokenized but stay `<button>`.
- `global-error.tsx`: renders its own `<html>` and does **not** import
  `globals.css`, so token CSS vars are absent during a catastrophic error —
  kept on literal Tailwind so the fallback never renders unstyled.
- **9 merchant/admin dark buttons** deferred to Phase 3 (see below): those
  shells use hardcoded `bg-gray-950` without the `.dark` class, so `<Button>`
  default (`bg-primary` ≈ black) would be black-on-black until the dark
  re-theme activates token-based `.dark`.

### Phase 2 — Color consolidation · ✅ DONE (light surfaces)
- [x] Codemod (`scripts/design/accent-codemod.ts`) mapped 14 families → 5
      functional tokens: **186 replacements across 28 files**, shade-aware
      (`bg-{50,100}`→`-subtle`, solid→token), prefixes/opacity preserved.
      Plus a 17-fix pass adding `/90`·`/80` to hovers that had collapsed.
      Scoped to light status UI — **excludes** `analytics/_components` (charts),
      `(merchant)/` + `admin/` (dark, Phase 3), `global-error`.
- [x] `<Badge>` gained soft status tones (`success`/`warning`/`info`/`danger`/
      `neutral`); adopted in `account/orders` (status map → `variant` tone).
- [x] CI guard `scripts/design/check-accents.ts` — fails the build on raw accent
      classes in light status UI (charts + dark dashboards exempted for now).
      Currently green: 0 violations.
- [x] Verified in browser: functional tokens resolve (info `rgb(36,99,235)`,
      success `rgb(16,183,127)`, warning `rgb(245,159,10)`, destructive
      `rgb(239,67,67)`); `/products` no regression. 720 tests green.

**Deferred to Phase 3 (dark dashboards):** merchant/admin accent colors are
still raw — they're entangled with the hardcoded-dark theme and migrate together
when `.dark` is activated. Chart swatches stay multi-hue (move to `--chart-*`).

### Phase 3 — Typography & dark dashboards · ✅ DONE (dark re-theme)
- [x] **Dark dashboard re-theme** — the heart of this phase:
  - Added `.dark` + `bg-background text-foreground` to the merchant + admin
    shells. The shared Navbar uses hardcoded light classes, so it stays light
    on top (unchanged); only token-based descendants flip dark.
  - Codemod (`scripts/design/dark-zone-codemod.ts`) mapped hardcoded dark
    neutrals **and** remaining accents → tokens across **33 files, 1130
    replacements** + 171 cleanup fixes (white-overlay opacity, stragglers).
    Hierarchy preserved: `gray-950→background`, `gray-900→card`,
    `gray-800→muted`, `white→foreground`, `gray-400→muted-foreground`,
    `border-white/10→border-border`.
  - **Verified** the `.dark` flip in-browser: `bg-background` 255→**10**,
    `card` **18**, `muted` **31** (hierarchy intact), `primary`→gold thread
    `rgb(193,168,139)`, `foreground`→warm white. Dark values closely match the
    old grays, so dashboards look ~the same but token-driven. (Pages are
    auth-gated; verification = token-resolution + typecheck + 720 tests.)
  - `check-accents` guard now **enforces merchant + admin** (exclusions
    removed) — 0 violations; dark zones can't regress to raw colors.
- [x] Prices → `font-price` (mono tabular) on the product **detail** page too.
- Typography note: Playfair (`font-editorial`) covers Latin only, so it is NOT
  applied to the Thai-first heros (would fall back mid-string). The editorial
  serif stays available for Latin-only surfaces (wordmark / English landings).

**Resolved — dark merchant/admin raw `<button>`s stay raw (accepted decision, not
limbo).** They are already fully tokenized (correct `bg-primary`/`bg-muted` colors
in the `.dark` theme) and carry focus rings, so they are *correct and accessible*
today. Adopting `<Button>` would be a cosmetic state/sizing-consistency nicety
whose only cost — visual QA on **auth-gated** dashboards — buys no token or a11y
improvement. It is therefore **explicitly out of the design-system definition of
done** and tracked as optional future polish, not a Phase 4/5 deliverable. (The
storefront, which *is* the completion scope, uses `<Button>` throughout.)

### Phase 4 — Components & states · ✅ DONE
- [x] **State matrix** — `<Button>` and `<Input>` gained an `AllStates` story (the
      canonical reference: default / disabled / loading for Button across the 7
      variants; default / filled / disabled / error for Input). Hover & active are
      the components' `transition-colors` + `active:scale-[.98]`; focus-visible is
      the shared `--ring` (below). New primitives `<Spinner>` / `<Skeleton>` /
      `<EmptyState>` / `<Alert>` each ship a full story set + Vitest test + `*.e2e.ts`.
      Verified: `packages/ui` Vitest **82 green**, typecheck clean.
- [x] **Focus-visible ring audit** — every keyboard-focusable control on the token
      surfaces resolves `focus-visible:ring-ring` (the `@fabric/ui` Button/Input
      bake it in; the intentionally-raw segmented controls, filter/clear and cart
      "Remove" text-links were given the standard `focus-visible:ring-2 ring-ring
      ring-offset` treatment). The only ring-less buttons are `tabIndex={-1}`
      password toggles (not focusable) and `global-error.tsx` (intentional
      exception). Verified: `grep` finds **0** bare `focus:` / gray-ring utilities
      outside `global-error`.
- [x] **Skeleton / empty / error states** — product grid: `products/loading.tsx`
      (Skeleton) · `products/page.tsx` `<EmptyState>` · `products/error.tsx`.
      Cart: `cart/loading.tsx` · `cart/page.tsx` `<EmptyState>` · `cart/error.tsx`.
      Checkout: `checkout/loading.tsx` · `checkout/error.tsx`. All built from the
      `@fabric/ui` primitives; typecheck + 720 tests green.

### Phase 5 — Governance · ✅ DONE
- [x] **Storybook as the single source + snapshot tests** — every component story
      (incl. the new `AllStates`, spinner/skeleton/empty-state/alert) is registered
      in `packages/ui/src/e2e/visual-regression.e2e.ts` (Playwright `toHaveScreenshot`,
      `maxDiffPixelRatio 0.01`) and, where AA-safe, in `accessibility.e2e.ts`
      (axe, 0 violations). Visual baselines are generated on CI (Linux, chromium)
      per the existing pipeline, not committed locally.
- [x] **CI guard — no raw `gray-*` / accent-`NNN` in `apps/web`** (allowlist `ui`).
      `scripts/design/check-grays.ts` (neutrals) + `check-accents.ts` (accents),
      chained by the `check:design` npm script and run as a dedicated CI step in
      `.github/workflows/ci.yml`. The last raw-gray holdouts — the `(shop)`
      marketing/guide/payment/locale landing pages (migrated by
      `neutral-light-codemod.ts`, ink CTAs → `primary`) and the dark `store/[slug]`
      page (dark surface hierarchy) — are now tokenized and **enforced**; only
      `analytics/_components` (chart `--chart-*`) and `global-error.tsx` remain
      carved out. Verified: `bun run check:design` → **0 violations**.
- [x] **`DESIGN.md` is the spec; PRs link to a token** — `CONTRIBUTING.md` gained a
      "Design System & Tokens" section (the §9 cheat sheet + the `check:design`
      command + the two documented carve-outs) requiring UI PRs to use tokens.

---

## 9. Quick reference — migration cheat sheet

| You see (current) | Replace with (target) |
|---|---|
| `text-gray-900` | `text-foreground` |
| `text-gray-700` / `-600` / `-500` | `text-muted-foreground` |
| `text-gray-400` (and lighter) | `text-faint` (dedicated `--faint` tier — keeps the ×261 light icons/placeholders light) |
| `bg-gray-50` / `-100` | `bg-muted` / `bg-secondary` |
| `bg-white` (card surface) | `bg-card` (dark-ready) |
| `border-gray-200` / `-300` | `border-border` / `border-border-strong` |
| `bg-gray-900 text-white` (ink CTA) | `bg-primary text-primary-foreground` (hover `bg-primary/90`) |
| `bg-red-500` / `text-red-*` | `bg-destructive` / `text-destructive` |
| `bg-red-50` (error surface) | `bg-destructive-subtle` |
| `bg-emerald-*` / `bg-green-*` | `bg-success` / `bg-success-subtle` |
| `bg-amber-*` / `bg-yellow-*` | `bg-warning` / `bg-warning-subtle` |
| `bg-blue-*` / `bg-indigo-*` | `bg-info` / `bg-info-subtle` |
| raw `<button className=…>` | `<Button variant=…>` from `@fabric/ui` |
| raw `<input className=…>` | `<Input>` from `@fabric/ui` |
| `rounded-lg border bg-white shadow-sm` | `<Card>` from `@fabric/ui` |
| price `text-xl font-bold` | `text-price` |
| `.font-editorial` (Playfair) | `.font-display` (Kanit) — see §3.5 |
| accent gold `bg-brand` (was `#c4a882`) | `bg-brand` now resolves to riot-red `#c2263d` — same class, new value |
| soft `shadow-md` on product-card hover | flat offset "sticker" shadow — see §3.5 |

---

## 10. Motion — *storefront motion layer*

> Scope: the customer-facing **`(shop)`** storefront only. Admin & merchant
> dashboards are tools, not showcases, and carry no motion. This is a motion
> layer, not a redesign — it choreographs movement on top of the design.

**Aesthetic — v2 update (current).** Quick, present, a little raw — DIY/gig-
poster energy, not quiet-luxury restraint. Never bouncy or springy (that's
still off-limits), but no longer *lingering* either: the old system's
"editorial calm, the way good fabric falls" pacing has been retuned faster
across the board. Small distances and one focal motion per view are kept —
those are about avoiding visual noise, not about the old aesthetic — but
speed now carries the "punk" feeling instead of unhurried pacing.

**Library.** [`motion`](https://motion.dev) (`motion/react`, the Framer Motion
successor) — React 19 / Next 16 compatible. CSS/Tailwind transitions are used for
trivial hovers (product cards) to keep those Server Components and the bundle
lean. No second animation library.

### 10.1 Motion tokens — `src/lib/motion.ts` (+ CSS easings in `globals.css`)

| Token | Value | Use |
|---|---|---|
| `EASE.entrance` (was `EASE.editorial`) | `cubic-bezier(0.16, 1, 0.3, 1)` | entrances (weighted ease-out) — curve unchanged, renamed only |
| `EASE.settle` (was `EASE.smooth`) | `cubic-bezier(0.4, 0, 0.2, 1)` | reversible state changes — curve unchanged, renamed only |
| `DURATION.fast` | 0.2 s | micro-interactions — unchanged, already snappy |
| `DURATION.base` | **0.25 s** (was 0.4 s) | transitions |
| `DURATION.slow` | **0.35 s** (was 0.6 s) | entrances |
| `DISTANCE.sm / md` | 8 / 16 px | subtle travel offsets — unchanged; speed carries the feel, not distance |

The rename drops the old identity's branding from the API surface — the
curve *shapes* are unchanged (they were never the "quiet luxury" signal,
duration was), only the *names* and the *durations*. The same curves exist as
CSS vars `--ease-entrance` / `--ease-settle` (exposed as Tailwind `ease-entrance`
/ `ease-settle` utilities) so CSS hovers and JS motion speak one language.
Reusable variants: `fadeInUp`, `fadeInUpItem`, `staggerContainer`,
`pageTransition`, `heroSettle`/`heroStagger`, plus the `inViewOnce` viewport
config — all mechanically retuned, no new motion code.

### 10.2 Shared components — `src/components/motion/`

- **`<MotionProvider>`** — wraps the `(shop)` layout in `MotionConfig
  reducedMotion="user"`; every `motion` element honors reduced-motion automatically.
- **`<Reveal>` / `<RevealGroup>` + `<RevealItem>`** — `whileInView` (run once)
  fade-up for single elements and staggered grids/lists.
- **`<PageTransition>`** — used by `(shop)/template.tsx`; a quick settle on every
  route change.

### 10.3 Where motion is applied

| Surface | Motion |
|---|---|
| Route changes (`(shop)/template.tsx`) | transform-only settle (see §10.4) |
| Product card (`product-card`, `featured-products-grid`) | CSS lift + image zoom + flat sticker-shadow on hover (§3.5), `ease-entrance` |
| Product grid (`product-grid`) | staggered `whileInView` reveal; replays on re-filter |
| Add-to-cart (`add-to-cart-button`) | quick label pop (`AnimatePresence mode="wait"`) |
| Cart (`cart/page`) | item add/remove via `AnimatePresence` + `layout` (FLIP) |
| Order confirmation | success ring scale-in + checkmark **draw** + settled detail card |

### 10.4 Non-negotiables (kept)

- **Reduced motion** — honored everywhere: `MotionProvider` (JS) + a global
  `@media (prefers-reduced-motion: reduce)` reset in `globals.css` (CSS hovers).
  Motion becomes instant; content/function never change.
- **Performance / CLS / LCP** — only `transform` + `opacity` animate (never layout
  props). The page-level template transition is **transform-only** (no opacity
  hide) precisely so above-the-fold / LCP content is never invisible before
  hydration. Full fade-ups are reserved for below-the-fold `whileInView` reveals.
- **SSR / hydration** — motion lives in `"use client"` leaves; pages stay Server
  Components where possible. No `Date.now()`/`Math.random()`-driven animation.

---

## 11. v2 Redesign Roadmap — Punk/Band-Merch Identity

Grounded in a 3-surface UX audit (storefront, merchant, admin) run before any
code changed — see the audit findings summary at the top of each phase below.
Phased the same way §8's original project was: each phase ships independently,
keeps `bun run check:design` / `turbo typecheck` / `bun test` green, and is
committed incrementally with cited evidence.

### Phase 0 — Token foundation · ⏳ IN PROGRESS
- [x] Palette: dark-canvas became the app-wide default (`<html className="dark">`
      in `apps/web/src/app/layout.tsx`); riot-red `--brand`/`--accent`/`--ring`,
      re-verified `--destructive` lightness, sharper `--border`/`--border-strong`,
      `--radius: 0.25rem`. See §3.5 for the full table and the measured
      (not assumed) AA contrast verification for brand/destructive.
- [x] Typography: Kanit (`next/font/google`, `subsets: ["latin","thai"]`,
      weights 400/500/700/900) replaces Playfair Display as `--font-display`;
      `.font-editorial` renamed `.font-display`. See §7.3/§10.
- [x] Motion: `EASE.editorial`→`EASE.entrance`, `EASE.smooth`→`EASE.settle`,
      `DURATION.base` 0.4s→0.25s, `DURATION.slow` 0.6s→0.35s — mechanical
      rename + retune across `apps/web/src/lib/motion.ts` and all 8 consumers
      (`components/motion/*`, `product-card.tsx`, `featured-products-grid.tsx`,
      `add-to-cart-button.tsx`, `checkout/page.tsx`, `cart/page.tsx`,
      `cart-item-row.tsx`, `order-success-header.tsx`, `modal.tsx`). See §10.
- [x] `packages/ui/src/index.css` kept in lockstep with `globals.css`.
- [ ] DESIGN.md rewrite — this section; §3.5/§4/§5/§7/§9/§10 updated in place
      (in progress, this commit).
- [ ] Live browser contrast verification (`preview_inspect` computed styles on
      a real rendered button/card) — pending.
- Verified so far: `bun run check:design` 0 violations, `turbo typecheck`
  clean (web + ui), `bun test` 785 pass / 0 fail (no markup changed yet, so
  the existing suite runs unmodified).

### Phase 1 — Storefront IA · not started
Audit findings this phase fixes: no search on `/products`; content pages
(about/guides/payment) orphaned from nav with no site footer; checkout forces
login with no guest option; address-form/checkout-steps/order-status labels
are English on a Thai-first UI; featured-products grid doesn't react to
filters; locale landing pages (`/en/my`, `/en/ph`, `/id`, `/vi`) unreachable
from any navigation.

### Phase 2 — Storefront visual application · not started
Applies the Phase 0 tokens/typography/motion to product-card, product-detail,
cart, checkout, order-confirmation, trust-badges, FAQ — plus the CTA copy fix
that depends on Phase 1's guest checkout landing, and inline payment-method/
voucher help text.

### Phase 3 — Merchant dashboard IA + visual · not started
Audit findings this phase fixes: flat 9-item sidebar (regroups into
Overview/Catalog/Sales/Finance/Growth); no onboarding progress feedback;
unsectioned product form; no per-size stock on the product list; payout
minimum buried in helper text; freeform bank-info textarea; no customer name
on orders; no analytics date range; billing allows upgrade before onboarding
completes; no inventory stock legend; Affiliates crammed onto one scrolling
page. New shared `Tabs` + `DateRangePicker` primitives land in `packages/ui`.

### Phase 4 — Admin dashboard IA (incl. KPI bug) + visual · not started
**Confirmed real bug** (not just a UX nit): `admin/dashboard/_lib/queries.ts`
line 56 maps `data.confirmedOrders` to a field rendered as "Active Buyers
(30d)" / "unique buyers in last 30 days" — it is neither unique nor buyers.
The "Churn Rate" card is hardcoded `churnRatePct: 0`, never computed. Both get
an honest relabel (not a new backend active-users/churn query — out of scope
for this redesign). Also fixes: payout approval shows only a truncated user
ID with no merchant context (admins approve/reject nearly blind); rejection
reason lost on reload; no inventory search; truncated order/customer IDs with
no copy affordance; no analytics date range; invoices have no view/download.

### Phase 5 — Content/marketing/locale pages · not started
About, guides, payment-method pages, and the 4 locale landing pages get
folded into the Phase 1 footer (no longer orphaned) and the Phase 0/2 visual
identity. Sequenced last — lowest business risk, benefits from settled nav.
