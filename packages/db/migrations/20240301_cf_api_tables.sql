-- cf-api domain tables — all domain data consolidated into PostgreSQL
-- Each service (cf-api, cf-commerce, web) gets its own dedicated PostgreSQL database.
-- cf-api database: products, orders, carts, merchants, payouts, vouchers, tokens, users, auth

-- ── Users ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  role        TEXT NOT NULL DEFAULT 'customer',
  display_name TEXT NOT NULL DEFAULT '',
  email_verified_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_role  ON users (role);

-- ── Login attempts (brute-force lockout) ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS login_attempts (
  email           TEXT PRIMARY KEY,
  attempt_count   INTEGER NOT NULL DEFAULT 0,
  first_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_until    TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Refresh tokens ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_family TEXT NOT NULL,
  token_hash   TEXT NOT NULL,
  expires_at   TIMESTAMPTZ NOT NULL,
  revoked_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id     ON refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_family ON refresh_tokens (token_family);

-- ── Token blacklist ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS token_blacklist (
  jti        TEXT PRIMARY KEY,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Merchants ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS merchants (
  user_id                TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  store_name             TEXT NOT NULL,
  email                  TEXT NOT NULL,
  plan                   TEXT NOT NULL DEFAULT 'free',
  plan_status            TEXT NOT NULL DEFAULT 'active',
  stripe_customer_id     TEXT,
  stripe_subscription_id TEXT,
  product_count          INTEGER NOT NULL DEFAULT 0,
  completed_order_count  INTEGER NOT NULL DEFAULT 0,
  total_revenue_cents    BIGINT  NOT NULL DEFAULT 0,
  paid_out_cents         BIGINT  NOT NULL DEFAULT 0,
  plan_expires_at        TIMESTAMPTZ,
  store_slug             TEXT UNIQUE,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_merchants_store_slug ON merchants (store_slug);

-- ── Products ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS products (
  id          TEXT PRIMARY KEY,
  rev         INTEGER NOT NULL DEFAULT 1,
  owner_id    TEXT NOT NULL REFERENCES merchants(user_id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price_cents BIGINT NOT NULL,
  currency    TEXT NOT NULL DEFAULT 'THB',
  category    TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'active',
  stock       JSONB NOT NULL DEFAULT '{}',
  image_urls  TEXT[] NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_owner_id ON products (owner_id);
CREATE INDEX IF NOT EXISTS idx_products_status   ON products (status);
CREATE INDEX IF NOT EXISTS idx_products_category ON products (category);

CREATE TABLE IF NOT EXISTS product_history (
  seq        BIGSERIAL PRIMARY KEY,
  product_id TEXT NOT NULL,
  rev        INTEGER NOT NULL,
  snapshot   JSONB NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_history_product_id ON product_history (product_id);

-- ── Carts ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS carts (
  id         TEXT PRIMARY KEY,
  user_id    TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_carts_user_id ON carts (user_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS cart_items (
  id             BIGSERIAL PRIMARY KEY,
  cart_id        TEXT NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  product_id     TEXT NOT NULL,
  product_name   TEXT NOT NULL,
  size           TEXT NOT NULL,
  quantity       INTEGER NOT NULL,
  unit_price_cents BIGINT NOT NULL,
  added_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (cart_id, product_id, size)
);

CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id ON cart_items (cart_id);

-- ── Orders ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS orders (
  id                   TEXT PRIMARY KEY,
  user_id              TEXT NOT NULL REFERENCES users(id),
  cart_id              TEXT,
  status               TEXT NOT NULL DEFAULT 'pending',
  total_cents          BIGINT NOT NULL,
  shipping_cents       BIGINT NOT NULL DEFAULT 0,
  discount_cents       BIGINT NOT NULL DEFAULT 0,
  currency             TEXT NOT NULL DEFAULT 'THB',
  shipping_address     JSONB NOT NULL,
  voucher_code         TEXT,
  payment_id           TEXT,
  placed_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at         TIMESTAMPTZ,
  shipped_at           TIMESTAMPTZ,
  tracking_number      TEXT,
  cancelled_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders (user_id);
CREATE INDEX IF NOT EXISTS idx_orders_cart_id ON orders (cart_id);
CREATE INDEX IF NOT EXISTS idx_orders_status  ON orders (status);

CREATE TABLE IF NOT EXISTS order_items (
  id               BIGSERIAL PRIMARY KEY,
  order_id         TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id       TEXT NOT NULL,
  product_name     TEXT NOT NULL,
  size             TEXT NOT NULL,
  quantity         INTEGER NOT NULL,
  unit_price_cents BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items (order_id);

-- ── Payouts ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS payout_requests (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id      TEXT NOT NULL REFERENCES merchants(user_id) ON DELETE CASCADE,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  amount_cents BIGINT NOT NULL,
  bank_info    TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending',
  resolved_at  TIMESTAMPTZ,
  admin_note   TEXT
);

CREATE INDEX IF NOT EXISTS idx_payout_requests_user_id ON payout_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_payout_requests_status  ON payout_requests (status);

-- ── Vouchers ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vouchers (
  code              TEXT PRIMARY KEY,
  discount_tag      TEXT NOT NULL,
  discount_pct      NUMERIC(5,2) NOT NULL DEFAULT 0,
  discount_amount   BIGINT NOT NULL DEFAULT 0,
  discount_buy      INTEGER NOT NULL DEFAULT 0,
  discount_get      INTEGER NOT NULL DEFAULT 0,
  min_order_cents   BIGINT NOT NULL DEFAULT 0,
  max_usages        INTEGER NOT NULL DEFAULT 1,
  current_usages    INTEGER NOT NULL DEFAULT 0,
  valid_until_epoch BIGINT NOT NULL,
  is_active         BOOLEAN NOT NULL DEFAULT true
);

-- ── Activity log ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS activity_log (
  id          TEXT PRIMARY KEY,
  user_id     TEXT REFERENCES users(id) ON DELETE SET NULL,
  session_id  TEXT,
  event_type  TEXT NOT NULL,
  event_data  JSONB,
  ip_address  TEXT,
  user_agent  TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_user_id    ON activity_log (user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_event_type ON activity_log (event_type);
CREATE INDEX IF NOT EXISTS idx_activity_log_occurred_at ON activity_log (occurred_at DESC);

-- ── Domain events (append-only event log) ────────────────────────────────────
-- Already created in 20240210_create_domain_events.sql; kept here for reference.
-- Skipped to avoid duplicate creation.
