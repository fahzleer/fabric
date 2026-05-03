# ADR 0014: Search Index Strategy

**Status:** Accepted  
**Date:** 2026-04-29

## Context

The product catalog needs full-text search (name, description, category, tags) plus structured filters (category, price range). Three options were evaluated:

| Option | Storage | Pros | Cons |
|--------|---------|------|------|
| **A — PostgreSQL tsvector** | `fabric_products` DB | No new infra; GIN index; ACID; always consistent | Limited relevance tuning; no autocomplete; Thai language requires `simple` config |
| B — Meilisearch | Separate process | Typo tolerance; fast; easy config | Extra service to operate; index rebuild on restart |
| C — Elasticsearch | Separate cluster | Industry standard; powerful DSL | Heavy resource usage; operational complexity out of scope |

Current traffic does not justify a dedicated search engine. The product corpus is bounded (thousands to tens of thousands of SKUs, not millions). tsvector GIN indexing delivers sub-10ms queries for this scale.

## Decision

**Option A — PostgreSQL tsvector with GIN index** (in `fabric_products` DB).

A `GENERATED ALWAYS AS … STORED` column concatenates `name || description || category || tags` into a `tsvector` at write time. Queries use `@@ plainto_tsquery('simple', $q)` and `ts_rank` ordering. The search service reads from the same `PRODUCT_DATABASE_URL` (read-only connection pool) — no separate sync process.

## Consequences

**Positive:**
- Zero new infrastructure: search runs on the existing PostgreSQL instance
- Index is always consistent with product data (generated column, no async sync)
- Filters on `category`, `price_cents`, `is_active` are native SQL predicates — no dual-store complexity
- GIN index typically returns results in < 5 ms for catalogs under 100 k rows

**Negative:**
- `plainto_tsquery('simple', …)` does not handle Thai morphology — Thai search quality is basic (word boundary split only)
- No fuzzy matching or typo tolerance — misspellings return no results
- Relevance ranking via `ts_rank` is less configurable than BM25/TF-IDF in dedicated engines

**Migration path:** If Thai NLP quality or relevance becomes a requirement, migrate to Meilisearch with an ADR update. The search service interface is decoupled from the storage backend.

## Implementation

- `apps/product/migrations/002_fts_index.sql` — `ADD COLUMN search_vector tsvector GENERATED ALWAYS AS … STORED` + `CREATE INDEX … USING GIN`
- `apps/search/src/application/search.service.ts` — reads `fabric_products` DB via `postgres.js`
