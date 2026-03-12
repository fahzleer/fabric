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

## Architecture Notes

See [`CLAUDE.md`](./CLAUDE.md) for detailed architecture, domain types, auth flow, and critical pitfalls.

## License

MIT — see [LICENSE](./LICENSE)
