CREATE TABLE IF NOT EXISTS domain_events (
  id            BIGSERIAL PRIMARY KEY,
  event_id      TEXT        NOT NULL UNIQUE,
  event_type    TEXT        NOT NULL,
  aggregate_id  TEXT        NOT NULL,
  payload       JSONB       NOT NULL,
  schema_version INTEGER    NOT NULL DEFAULT 1,
  occurred_at   TIMESTAMP WITH TIME ZONE NOT NULL,
  recorded_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_domain_events_aggregate ON domain_events (aggregate_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_domain_events_type ON domain_events (event_type);
CREATE INDEX IF NOT EXISTS idx_domain_events_occurred ON domain_events (occurred_at);
