"use client";

import { trackEvent, trackFirstDeposit } from "@/lib/analytics";
import { useEffect } from "react";

interface OrderTrackerProps {
  orderId: string;
  totalCents: number;
  currency: string;
  itemCount: number;
}

export function OrderTracker({ orderId, totalCents, currency, itemCount }: OrderTrackerProps) {
  useEffect(() => {
    const data = {
      orderId,
      value: totalCents / 100,
      currency,
      num_items: itemCount,
    };
    trackEvent("order_placed", data);
    trackFirstDeposit(data);
  }, [orderId, totalCents, currency, itemCount]);
  return null;
}
