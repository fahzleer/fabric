"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const NEXT_STATUS: Record<string, { label: string; value: "shipped" | "delivered" }> = {
  confirmed: { label: "Mark as Shipped", value: "shipped" },
  shipped: { label: "Mark as Delivered", value: "delivered" },
};

export function StatusUpdateForm({
  orderId,
  currentStatus,
}: { orderId: string; currentStatus: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const next = NEXT_STATUS[currentStatus];
  if (!next) return null;

  const handleUpdate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/merchant/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: next.value }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        setError(d.error ?? "Failed to update status");
      } else {
        router.refresh();
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      {error && <p className="text-xs text-destructive">{error}</p>}
      <button
        type="button"
        onClick={handleUpdate}
        disabled={loading}
        className="rounded-lg bg-success px-4 py-2 text-sm font-medium text-foreground hover:bg-success disabled:opacity-50"
      >
        {loading ? "Updating…" : next.label}
      </button>
    </div>
  );
}
