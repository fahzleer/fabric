-- Cart persistence — replaces the in-memory Map in cart.routes.ts
-- Keyed by (user_id, product_id, size) so UPSERT keeps a single row per SKU.

CREATE TABLE IF NOT EXISTS cart_items (
  user_id    TEXT    NOT NULL,
  product_id TEXT    NOT NULL,
  size       TEXT    NOT NULL,
  quantity   INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, product_id, size)
);

CREATE INDEX IF NOT EXISTS idx_cart_items_user_id ON cart_items (user_id);
