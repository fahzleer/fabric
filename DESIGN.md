# Fabric — Design System

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

### 7.2 Functional — collapse 14 families → **5**, one shade each *(implemented Phase 0)*

| Token (utility prefix) | Value | Subsumes |
|---|---|---|
| `brand` | `36 38% 64%` (#c4a882 thread gold) | the editorial accent (currently nothing) |
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
| `text-display` | 36–48 / 1.1 | 700, serif optional | hero (revive Playfair `--font-serif`) |

### 7.4 Radius / shadow / spacing — restrict the scale

| Category | Keep only | Drop |
|---|---|---|
| Radius | `sm` 4 (inputs) · `lg` 8 (cards) · `xl` 12 (modals) · `full` (pills) | `rounded` bare, `2xl`, `3xl` |
| Shadow | `xs`=resting · `md`=hover/raised · `xl`=overlay/modal | the rest |
| Spacing | 4-base: 1,2,3,4,6,8,12,16 | ad-hoc 5,7 etc. |

> Set `--radius` to `0.5rem` (8px) so the token matches the real card radius.

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
