-- ── Fabric — local dev database init ─────────────────────────────────────────
-- Creates separate schemas per service (monolithic PG, logical separation)

CREATE SCHEMA IF NOT EXISTS orders;
CREATE SCHEMA IF NOT EXISTS customers;
CREATE SCHEMA IF NOT EXISTS payments;
CREATE SCHEMA IF NOT EXISTS shipping;

-- ── orders ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS orders.orders (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL,
  items            JSONB NOT NULL DEFAULT '[]',
  total_cents      INTEGER NOT NULL,
  currency         TEXT NOT NULL DEFAULT 'THB',
  status           TEXT NOT NULL DEFAULT 'pending',
  payment_method   TEXT NOT NULL,
  shipping_address JSONB NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS orders_user_id_idx ON orders.orders (user_id);
CREATE INDEX IF NOT EXISTS orders_status_idx  ON orders.orders (status);

-- ── customers ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS customers.customers (
  id         TEXT PRIMARY KEY,
  email      TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name  TEXT NOT NULL,
  phone      TEXT NOT NULL DEFAULT '',
  address    JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS customers_email_idx ON customers.customers (email);

-- ── payments ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS payments.payments (
  id             TEXT PRIMARY KEY,
  order_id       TEXT NOT NULL,
  amount_cents   INTEGER NOT NULL,
  currency       TEXT NOT NULL DEFAULT 'THB',
  method         TEXT NOT NULL,
  provider       TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending',
  provider_ref   TEXT,
  failure_reason TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS payments_order_id_idx ON payments.payments (order_id);
CREATE INDEX IF NOT EXISTS payments_status_idx   ON payments.payments (status);

-- ── shipping ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS shipping.shipments (
  id                 TEXT PRIMARY KEY,
  order_id           TEXT NOT NULL,
  carrier            TEXT NOT NULL,
  tracking_number    TEXT,
  status             TEXT NOT NULL DEFAULT 'pending',
  address            JSONB NOT NULL DEFAULT '{}',
  estimated_delivery TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS shipments_order_id_idx ON shipping.shipments (order_id);
