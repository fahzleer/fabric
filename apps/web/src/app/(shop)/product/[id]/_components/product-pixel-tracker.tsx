"use client";

import { trackEvent } from "@/lib/analytics";
import { useEffect } from "react";

interface ProductPixelTrackerProps {
  productId: string;
  productName: string;
  price: number;
  currency: string;
}

export function ProductPixelTracker({
  productId,
  productName,
  price,
  currency,
}: ProductPixelTrackerProps) {
  useEffect(() => {
    trackEvent("product_viewed", { productId, productName, price, currency });
  }, [productId, productName, price, currency]);
  return null;
}
