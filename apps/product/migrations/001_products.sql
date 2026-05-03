-- fabric_products initial schema
CREATE TABLE IF NOT EXISTS products (
  id           TEXT PRIMARY KEY,
  merchant_id  TEXT NOT NULL,
  name         TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  price_cents  INTEGER NOT NULL,
  currency     TEXT NOT NULL DEFAULT 'THB',
  category     TEXT NOT NULL DEFAULT '',
  tags         JSONB NOT NULL DEFAULT '[]',
  inventory    JSONB NOT NULL DEFAULT '{}',
  image_urls   JSONB NOT NULL DEFAULT '[]',
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_products_merchant ON products (merchant_id);
CREATE INDEX IF NOT EXISTS idx_products_active   ON products (is_active);
CREATE INDEX IF NOT EXISTS idx_products_category ON products (category) WHERE is_active;
