-- Payment service schema for fabric_payments database

CREATE TABLE IF NOT EXISTS payments (
  id             TEXT        PRIMARY KEY,
  order_id       TEXT        NOT NULL,
  amount_cents   INTEGER     NOT NULL,
  currency       TEXT        NOT NULL DEFAULT 'THB',
  method         TEXT        NOT NULL,
  provider       TEXT        NOT NULL,
  status         TEXT        NOT NULL DEFAULT 'pending',
  provider_ref   TEXT,
  failure_reason TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments (order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status   ON payments (status);
