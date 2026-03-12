export type InvoiceStatus = "paid" | "pending" | "overdue";

export type Invoice = {
  id: string;
  customerEmail: string;
  amountCents: number;
  currency: string;
  status: InvoiceStatus;
  createdAt: string;
  dueAt: string;
};
