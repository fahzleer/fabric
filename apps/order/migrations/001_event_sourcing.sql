-- Event Sourcing migration for fabric_orders
-- Replaces the single `orders` table with:
--   domain_events     — append-only event journal (source of truth)
--   orders_projection — denormalised read model (fast queries)
-- pg-boss creates its own pgboss.* schema on first start.

-- ── domain_events ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS domain_events (
  id             TEXT        NOT NULL DEFAULT gen_random_uuid(),
  aggregate_id   TEXT        NOT NULL,
  aggregate_type TEXT        NOT NULL DEFAULT 'Order',
  version        INT         NOT NULL,
  type           TEXT        NOT NULL,
  payload        JSONB       NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id),
  UNIQUE (aggregate_id, version)
);

CREATE INDEX IF NOT EXISTS idx_domain_events_aggregate_id
  ON domain_events (aggregate_id, version);

-- ── orders_projection ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS orders_projection (
  id             TEXT        NOT NULL,
  user_id        TEXT        NOT NULL,
  status         TEXT        NOT NULL DEFAULT 'pending',
  total_cents    INT         NOT NULL,
  currency       TEXT        NOT NULL DEFAULT 'THB',
  payment_method TEXT        NOT NULL,
  shipping       JSONB       NOT NULL,
  items          JSONB       NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL,
  updated_at     TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_orders_projection_user_id ON orders_projection (user_id);
CREATE INDEX IF NOT EXISTS idx_orders_projection_status  ON orders_projection (status);

-- ── Migrate existing orders → domain_events + orders_projection ───────────────

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'orders') THEN

    -- Synthetic OrderPlaced event (version 1) for every existing order
    INSERT INTO domain_events (aggregate_id, aggregate_type, version, type, payload, created_at)
    SELECT
      id,
      'Order',
      1,
      'OrderPlaced',
      jsonb_build_object(
        'userId',          user_id,
        'items',           items,
        'totalCents',      total_cents,
        'currency',        currency,
        'paymentMethod',   payment_method,
        'shippingAddress', shipping_address
      ),
      created_at::TIMESTAMPTZ
    FROM orders
    ON CONFLICT DO NOTHING;

    -- Synthetic status-change event (version 2) for non-pending orders
    INSERT INTO domain_events (aggregate_id, aggregate_type, version, type, payload, created_at)
    SELECT
      id,
      'Order',
      2,
      CASE status
        WHEN 'confirmed' THEN 'OrderConfirmed'
        WHEN 'paid'      THEN 'OrderPaid'
        WHEN 'cancelled' THEN 'OrderCancelled'
        WHEN 'shipped'   THEN 'OrderShipped'
        WHEN 'delivered' THEN 'OrderDelivered'
      END,
      '{}',
      updated_at::TIMESTAMPTZ
    FROM orders
    WHERE status NOT IN ('pending')
    ON CONFLICT DO NOTHING;

    -- Copy into projection
    INSERT INTO orders_projection
      (id, user_id, status, total_cents, currency, payment_method,
       shipping, items, created_at, updated_at)
    SELECT
      id, user_id, status, total_cents, currency, payment_method,
      shipping_address, items,
      created_at::TIMESTAMPTZ, updated_at::TIMESTAMPTZ
    FROM orders
    ON CONFLICT (id) DO NOTHING;

    DROP TABLE orders;
  END IF;
END $$;
