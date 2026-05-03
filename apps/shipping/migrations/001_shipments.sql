-- Shipping service schema for fabric_shipments database

CREATE TABLE IF NOT EXISTS shipments (
  id                 TEXT        PRIMARY KEY,
  order_id           TEXT        NOT NULL UNIQUE,
  carrier            TEXT        NOT NULL,
  tracking_number    TEXT,
  status             TEXT        NOT NULL DEFAULT 'pending',
  address            JSONB       NOT NULL DEFAULT '{}',
  estimated_delivery TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shipments_order_id ON shipments (order_id);
CREATE INDEX IF NOT EXISTS idx_shipments_status   ON shipments (status);
