CREATE TABLE IF NOT EXISTS processed_stripe_events (
  stripe_event_id  TEXT PRIMARY KEY,
  event_type       TEXT NOT NULL,
  processed_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_processed_stripe_events_processed_at
  ON processed_stripe_events (processed_at);

-- Retention: remove events older than 30 days
-- Run via cron: DELETE FROM processed_stripe_events WHERE processed_at < NOW() - INTERVAL '30 days';
