-- Promotion service schema for fabric_promotions database

CREATE TABLE IF NOT EXISTS promotions (
  id               TEXT        PRIMARY KEY,
  code             TEXT        NOT NULL UNIQUE,
  description      TEXT        NOT NULL,
  discount_type    TEXT        NOT NULL,
  discount_value   REAL        NOT NULL,
  minimum_cents    INTEGER     NOT NULL DEFAULT 0,
  max_usage_total  INTEGER,
  max_usage_per_user INTEGER   NOT NULL DEFAULT 1,
  usage_count      INTEGER     NOT NULL DEFAULT 0,
  starts_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at       TIMESTAMPTZ,
  is_active        BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promotions_code      ON promotions (code);
CREATE INDEX IF NOT EXISTS idx_promotions_is_active ON promotions (is_active);
