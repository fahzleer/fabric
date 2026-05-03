// Kysely table interfaces for fabric_orders

export interface DomainEventTable {
  id:             string;
  aggregate_id:   string;
  aggregate_type: string;
  version:        number;
  type:           string;
  payload:        unknown;
  created_at:     Date;
}

export interface OrderProjectionTable {
  id:             string;
  user_id:        string;
  status:         string;
  total_cents:    number;
  currency:       string;
  payment_method: string;
  shipping:       unknown;
  items:          unknown;
  created_at:     Date;
  updated_at:     Date;
}

export interface CartItemTable {
  user_id:    string;
  product_id: string;
  size:       string;
  quantity:   number;
  updated_at: Date;
}

export interface OrderAnalyticsSnapshotTable {
  total_orders:     number;
  revenue_cents:    number;
  currency:         string;
  active_users_30d: number;
  churn_rate_pct:   number;
  refreshed_at:     Date;
}

export interface FabricOrdersDatabase {
  domain_events:            DomainEventTable;
  orders_projection:        OrderProjectionTable;
  cart_items:               CartItemTable;
  order_analytics_snapshot: OrderAnalyticsSnapshotTable;
}
