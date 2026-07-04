"use client";

import { formatPrice } from "@/lib/price";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@fabric/ui";
import type { Invoice } from "./types";

function buildInvoiceText(inv: Invoice): string {
  const amount = formatPrice({ amount: inv.amountCents / 100, currency: inv.currency });
  return [
    "FABRIC — INVOICE",
    "=================",
    `Invoice ID: ${inv.id}`,
    `Customer:   ${inv.customerEmail}`,
    `Amount:     ${amount}`,
    `Status:     ${inv.status}`,
    `Created:    ${new Date(inv.createdAt).toLocaleDateString("en-US")}`,
    `Due:        ${new Date(inv.dueAt).toLocaleDateString("en-US")}`,
    "",
    "This invoice is generated from confirmed order data and is not a",
    "tax document.",
  ].join("\n");
}

function handleDownload(inv: Invoice): void {
  const blob = new Blob([buildInvoiceText(inv)], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `invoice-${inv.id}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

export function InvoiceActions({ invoice }: { invoice: Invoice }) {
  return (
    <div className="flex items-center justify-end gap-3">
      <Dialog>
        <DialogTrigger className="text-xs font-medium text-info hover:text-info/80">
          View
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invoice {invoice.id.slice(0, 8)}…</DialogTitle>
          </DialogHeader>
          <pre className="whitespace-pre-wrap rounded-lg bg-muted p-4 text-xs text-foreground font-mono">
            {buildInvoiceText(invoice)}
          </pre>
        </DialogContent>
      </Dialog>
      <button
        type="button"
        onClick={() => handleDownload(invoice)}
        className="text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        Download
      </button>
    </div>
  );
}
