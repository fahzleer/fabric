export type InventoryBalanceRow = {
  product_id: string;
  product_name: string;
  store_id: string;
  total_received: string;
  total_sold: string;
  expected_on_hand: string;
  retail_price_per_unit: string;
  currency: string;
  last_audited_at: Date | null;
  last_counted_quantity: string | null;
  last_variance_units: string | null;
  last_variance_baht: string | null;
  last_audit_type: string | null;
};

export async function getInventoryBalances(): Promise<InventoryBalanceRow[]> {
  return [];
}

export type AuditSummaryRow = {
  audit_type: string;
  total_audits: string;
  total_variance_units: string;
  total_variance_baht: string;
};

export async function getAuditSummary(): Promise<AuditSummaryRow[]> {
  return [];
}
