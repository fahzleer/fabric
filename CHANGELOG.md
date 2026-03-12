# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [0.0.1] — 2026-03-11

### Added
- Monorepo setup: Turborepo + Bun workspaces
- `apps/cf-api` — Main API (Hono + Firebase Functions v2)
  - PASETO v3.local authentication
  - Products, Cart, Orders CRUD
  - Stripe merchant billing (starter/professional/enterprise)
  - Payouts, Store, Internal token bridge
- `apps/cf-commerce` — Commerce Function (Hono + Firebase Functions v2)
  - Pricing pipeline (Railway Oriented Programming)
  - Events system (CQRS + Free Monad + SSE)
  - Payment processing (Omise card + PromptPay)
- `apps/web` — Next.js 16 storefront + merchant portal
  - better-auth + PostgreSQL sessions
  - Dexie IndexedDB offline cart
  - Web3/USDC payments via x402 protocol
  - Merchant dashboard (products, analytics, payouts, billing)
- `apps/worker` — Cloudflare Worker edge router
- `packages/types` — Domain types (branded types, FSM, ADTs)
- `packages/ui` — Shared React components (shadcn/ui + Tailwind CSS 4)
- `packages/firebase` — Firebase admin helpers
- `packages/cache` — GCS + Memcached adapters
- `packages/orpc` — oRPC contract definitions
- `packages/contract` — Shared API contracts
- Biome 1.9.4 for lint + format
- Husky pre-commit hook (lint-staged + bun test)
- 720 passing tests across 53 files
