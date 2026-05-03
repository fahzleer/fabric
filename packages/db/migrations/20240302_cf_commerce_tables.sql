-- cf-commerce domain tables — event store + product read model
-- Separate PostgreSQL database: cf_commerce
-- Pattern: append-only event log + materialised read model per aggregate

-- ── Commerce events (append-only event log) ──────────────────────────────────

CREATE TABLE IF NOT EXISTS commerce_events (
  event_id       TEXT PRIMARY KEY,
  event_type     TEXT NOT NULL,
  aggregate_id   TEXT NOT NULL,
  payload        JSONB NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1,
  occurred_at    TIMESTAMPTZ NOT NULL,
  recorded_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commerce_events_aggregate_id ON commerce_events (aggregate_id);
CREATE INDEX IF NOT EXISTS idx_commerce_events_event_type   ON commerce_events (event_type);
CREATE INDEX IF NOT EXISTS idx_commerce_events_occurred_at  ON commerce_events (occurred_at DESC);

-- ── Product read model (current state snapshot) ───────────────────────────────

CREATE TABLE IF NOT EXISTS product_read_models (
  product_id    TEXT PRIMARY KEY,
  owner_id      TEXT NOT NULL,
  name          TEXT NOT NULL,
  price         INTEGER NOT NULL,
  currency      TEXT NOT NULL DEFAULT 'THB',
  category      TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'draft',
  rev           INTEGER NOT NULL DEFAULT 0,
  last_event_at TIMESTAMPTZ NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_read_models_owner_id ON product_read_models (owner_id);
CREATE INDEX IF NOT EXISTS idx_product_read_models_status   ON product_read_models (status);

-- ── Idempotency log (per-event deduplication guard) ───────────────────────────

CREATE TABLE IF NOT EXISTS processed_events (
  event_id     TEXT PRIMARY KEY,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
