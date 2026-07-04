# Contributing to Fabric

## Prerequisites

- [Bun](https://bun.sh) >= 1.2.0 — **only** runtime/package manager used
- Node.js 22+ (Firebase Functions deployment only)
- Firebase CLI (`bun add -g firebase-tools`)

## Setup

```bash
git clone https://github.com/YOUR_USERNAME/fabric.git
cd fabric
bun install
```

## Development

```bash
bun run dev          # starts all apps (except worker)
bun run emulator     # starts Firebase emulators (DB + Storage)
```

Individual apps:

```bash
cd apps/cf-api && bun run dev      # :3010
cd apps/cf-commerce && bun run dev # :8082
cd apps/web && bun run dev         # :3000
cd apps/worker && bun run dev      # :3001
```

## Code Style

- **Linter / Formatter**: [Biome](https://biomejs.dev) — no ESLint, no Prettier
- **Check + autofix**: `bun run check`
- **Lint only**: `bun run lint`
- **Format only**: `bun run format`

## Testing

```bash
bun run test            # all packages via Turbo
bun test                # root-level tests only
cd packages/ui && bun run test   # Vitest (UI package only)
```

All tests must pass before committing — the pre-commit hook runs `bun test` automatically.

## Pre-commit Hook

Every `git commit` runs:

1. `bunx lint-staged` — Biome check/format on staged `.ts`/`.tsx` files
2. `bun test` — full test suite must pass

To skip in emergencies (avoid unless critical): `git commit --no-verify`

## Branch Strategy

| Branch | Purpose |
|--------|---------|
| `main` | production-ready, protected |
| `develop` | integration branch |
| `feat/*` | new features |
| `fix/*` | bug fixes |
| `chore/*` | tooling / config changes |

## Pull Requests

- Target `main` for hotfixes, `develop` for everything else
- CI must pass (lint + typecheck + test)
- Keep PRs focused — one concern per PR

## Design System & Tokens

`DESIGN.md` is the spec for UI work. The web app and `packages/ui` share **one**
semantic token layer (HSL CSS vars in `apps/web/src/app/globals.css` +
`packages/ui/src/index.css`, kept in lockstep). **PRs that touch UI must use
tokens, not raw Tailwind palette classes.**

| Don't write | Use the token |
|---|---|
| `text-gray-900` | `text-foreground` |
| `text-gray-700/600/500` | `text-muted-foreground` |
| `text-gray-400` (and lighter) | `text-faint` |
| `bg-gray-50` / `bg-gray-100` | `bg-muted` / `bg-secondary` |
| `border-gray-200` / `-300` | `border-border` / `border-border-strong` |
| `bg-red-*` / `bg-emerald-*` / `bg-amber-*` / `bg-blue-*` | `bg-destructive` / `bg-success` / `bg-warning` / `bg-info` (+ `-subtle` surfaces) |
| `text-warning` on a subtle surface | `text-warning-text` (AA-legible) |
| raw `<button>` / `<input>` | `<Button>` / `<Input>` from `@fabric/ui` |
| price `text-xl font-bold` | `text-price font-price` |

**Guards (run before pushing UI changes):**

```bash
bun run check:design   # check-accents.ts + check-grays.ts — 0 violations required
```

Two CI guards in `scripts/design/` enforce this:
- `check-accents.ts` — bans raw accent families (`red`/`emerald`/`amber`/`blue`/…).
- `check-grays.ts` — bans raw `gray-*` neutrals.

Documented carve-outs (both guards) — the **only** two: `analytics/_components/*`
(data-viz uses the categorical `--chart-*` palette) and `global-error.tsx`
(renders its own `<html>`, no token CSS at runtime). The `(shop)` marketing /
guide / payment / locale landing pages and the dark store page were the last raw
holdouts and are now fully tokenized and **enforced**. Don't add new entries to
these carve-out lists without a documented reason.

UI components live in `packages/ui` with a Storybook story + Vitest test + an
`*.e2e.ts` (Playwright a11y + visual-snapshot). New components/states need all
three; visual baselines are generated on CI (Linux), not committed locally.

## Architecture Notes

See [`CLAUDE.md`](./CLAUDE.md) for detailed architecture, domain types, auth flow, and critical pitfalls.

## License

MIT — see [LICENSE](./LICENSE)
