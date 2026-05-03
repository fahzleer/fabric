-- Analytics read model — separates heavy aggregate queries from the orders_projection write path.
-- The materialized view is refreshed every 5 minutes by a pg-boss scheduled job in main.ts.
-- Direct queries against orders_projection for analytics are replaced by reads against this view.

CREATE MATERIALIZED VIEW IF NOT EXISTS order_analytics_snapshot AS
WITH
  totals AS (
    SELECT
      COUNT(*) FILTER (WHERE status NOT IN ('cancelled', 'refunded'))              AS total_orders,
      COALESCE(SUM(total_cents) FILTER (WHERE status = 'delivered'), 0)            AS revenue_cents,
      COALESCE(MAX(currency)    FILTER (WHERE status = 'delivered'), 'THB')        AS currency,
      COUNT(DISTINCT user_id) FILTER (
        WHERE updated_at >= NOW() - INTERVAL '30 days'
          AND status NOT IN ('cancelled', 'refunded')
      )                                                                             AS active_users_30d
    FROM orders_projection
  ),
  prev_month AS (
    SELECT DISTINCT user_id
    FROM orders_projection
    WHERE updated_at >= DATE_TRUNC('month', NOW() - INTERVAL '1 month')
      AND updated_at <  DATE_TRUNC('month', NOW())
      AND status NOT IN ('cancelled', 'refunded')
  ),
  curr_month AS (
    SELECT DISTINCT user_id
    FROM orders_projection
    WHERE updated_at >= DATE_TRUNC('month', NOW())
      AND status NOT IN ('cancelled', 'refunded')
  ),
  churn AS (
    SELECT
      COUNT(p.user_id)::numeric AS prev_buyers,
      COUNT(c.user_id)::numeric AS retained
    FROM prev_month p
    LEFT JOIN curr_month c USING (user_id)
  )
SELECT
  t.total_orders::int                                                         AS total_orders,
  t.revenue_cents::bigint                                                     AS revenue_cents,
  t.currency,
  t.active_users_30d::int                                                     AS active_users_30d,
  CASE WHEN ch.prev_buyers > 0
    THEN ROUND(((ch.prev_buyers - ch.retained) / ch.prev_buyers) * 1000) / 10
    ELSE 0::numeric
  END                                                                         AS churn_rate_pct,
  NOW()                                                                       AS refreshed_at
FROM totals t
CROSS JOIN churn ch;

-- Unique index required for REFRESH MATERIALIZED VIEW CONCURRENTLY.
-- The view always returns exactly one row, so index on constant 1 is the minimal viable key.
CREATE UNIQUE INDEX IF NOT EXISTS idx_order_analytics_snapshot_singleton
  ON order_analytics_snapshot ((1));
