CREATE TABLE IF NOT EXISTS domain_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type   TEXT NOT NULL,
  merchant_id  TEXT NOT NULL,
  user_id      TEXT,
  payload      JSONB NOT NULL,
  occurred_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  processed    BOOLEAN NOT NULL DEFAULT false
);

-- Compound index for "events after timestamp for user" SSE resume queries
CREATE INDEX IF NOT EXISTS idx_domain_events_user_time
  ON domain_events (user_id, occurred_at DESC)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_domain_events_merchant_time
  ON domain_events (merchant_id, occurred_at DESC);

-- Retention support
CREATE INDEX IF NOT EXISTS idx_domain_events_occurred_at
  ON domain_events (occurred_at);
