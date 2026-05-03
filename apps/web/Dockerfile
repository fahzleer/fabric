FROM oven/bun:1.2-alpine AS base
WORKDIR /app

# ── deps ──────────────────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json bun.lock bunfig.toml tsconfig.json ./
COPY packages/ packages/
COPY apps/web/package.json apps/web/
RUN bun install --frozen-lockfile

# ── builder ───────────────────────────────────────────────────────────────────
FROM deps AS builder
COPY apps/web/ apps/web/

# Build args wired to NEXT_PUBLIC_* at build time
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_API_CORE_URL
ARG NEXT_PUBLIC_APP_URL

WORKDIR /app/apps/web
RUN bun run build

# ── runner ────────────────────────────────────────────────────────────────────
FROM oven/bun:1.2-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Next.js standalone output
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static     apps/web/.next/static
COPY --from=builder /app/apps/web/public           apps/web/public

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["bun", "apps/web/server.js"]
