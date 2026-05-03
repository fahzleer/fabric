-- Full-text search index for the search service (Plan ADR 0014: Option A — tsvector in product DB)
-- The search service reads this index via a read-only connection to fabric_products.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS search_vector tsvector
    GENERATED ALWAYS AS (
      to_tsvector('simple',
        coalesce(name, '') || ' ' ||
        coalesce(description, '') || ' ' ||
        coalesce(category, '') || ' ' ||
        coalesce(
          (SELECT string_agg(t::text, ' ') FROM jsonb_array_elements_text(tags) t),
          ''
        )
      )
    ) STORED;

CREATE INDEX IF NOT EXISTS idx_products_search ON products USING GIN (search_vector);
