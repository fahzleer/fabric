/**
 * Run once after provisioning Railway Postgres.
 *   bun run apps/web/scripts/migrate.ts
 */
import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { max: 1 });

const migrations = [
  // better-auth tables (auto-created by betterAuth on first request — listed for reference)
  // Run this only for the tables we manage manually.

  // Admin tables
  `CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT NOT NULL,
    total_amount_in_cents INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'THB',
    status TEXT NOT NULL DEFAULT 'pending',
    lines JSONB NOT NULL DEFAULT '[]',
    placed_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  `CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    owner_id TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS inventory_receipts (
    id SERIAL PRIMARY KEY,
    product_id TEXT NOT NULL,
    store_id TEXT NOT NULL,
    quantity_counted INTEGER NOT NULL,
    retail_price_per_unit NUMERIC(10,2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'THB',
    received_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  `CREATE TABLE IF NOT EXISTS stock_audits (
    id SERIAL PRIMARY KEY,
    product_id TEXT NOT NULL,
    store_id TEXT NOT NULL,
    audited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    counted_quantity INTEGER NOT NULL,
    variance_units INTEGER NOT NULL DEFAULT 0,
    variance_baht NUMERIC(10,2) NOT NULL DEFAULT 0,
    audit_type TEXT NOT NULL DEFAULT 'cycle_count'
  )`,

  `CREATE OR REPLACE VIEW users AS
    SELECT id, email, name FROM "user"`,

  // A/B testing tables
  `CREATE TABLE IF NOT EXISTS ab_experiments (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft',
    variants JSONB NOT NULL DEFAULT '[{"id":"control","name":"Control","weight":0.5},{"id":"treatment","name":"Treatment","weight":0.5}]',
    goal TEXT NOT NULL DEFAULT 'conversion',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at TIMESTAMPTZ
  )`,

  `CREATE TABLE IF NOT EXISTS ab_assignments (
    experiment_id TEXT NOT NULL REFERENCES ab_experiments(id) ON DELETE CASCADE,
    user_key TEXT NOT NULL,
    variant_id TEXT NOT NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (experiment_id, user_key)
  )`,

  `CREATE TABLE IF NOT EXISTS ab_events (
    id BIGSERIAL PRIMARY KEY,
    experiment_id TEXT NOT NULL,
    user_key TEXT NOT NULL,
    variant_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  `CREATE INDEX IF NOT EXISTS ab_events_exp_type ON ab_events (experiment_id, event_type)`,
  `CREATE INDEX IF NOT EXISTS ab_events_occurred ON ab_events (occurred_at)`,

  // Seed starter experiment
  `INSERT INTO ab_experiments (id, name, description, status, variants, goal) VALUES
    ('hero-cta-text', 'Hero CTA Button Text',
     'Tests whether "Shop Now" vs "Explore Products" drives more clicks on the shop hero banner.',
     'running',
     '[{"id":"control","name":"Shop Now","weight":0.5},{"id":"treatment","name":"Explore Products","weight":0.5}]',
     'cta_click')
  ON CONFLICT (id) DO NOTHING`,
];

try {
  for (const migration of migrations) {
    await sql.unsafe(migration);
  }
  console.log(`✓ ${migrations.length} migrations applied`);
} finally {
  await sql.end();
}
