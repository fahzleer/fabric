#!/usr/bin/env bun
/**
 * Recompute merchant analytics counters from the ACTUAL order records so
 * /merchant/analytics/summary matches /merchant/orders exactly.
 * "completed" = paid/fulfilled order (status confirmed | shipped | delivered).
 */
import { createFirebaseFromEnv } from "@fabric/firebase";
import type { FirebaseOrderRecord, FirebaseProductRecord } from "@fabric/firebase";
import { isErr } from "@fabric/types";

const MERCHANT_ID = "Ogh8EkguSoHdlPhV97QOJu5exeDrtf0s";
const PAID = new Set(["confirmed", "shipped", "delivered"]);

const fb = createFirebaseFromEnv();
if (isErr(fb)) {
  console.error("Firebase init failed:", fb.error.message);
  process.exit(1);
}
const db = fb.value.db;

const prodSnap = await db.ref("product_current").once("value");
const products = (prodSnap.val() ?? {}) as Record<string, FirebaseProductRecord>;
const myProductIds = new Set(
  Object.values(products).filter((p) => p.ownerId === MERCHANT_ID).map((p) => p.id)
);

const orderSnap = await db.ref("orders").once("value");
const orders = (orderSnap.val() ?? {}) as Record<string, FirebaseOrderRecord>;

let completedOrderCount = 0;
let totalRevenueCents = 0;
for (const o of Object.values(orders)) {
  const isMine = Object.values(o.items).some((it) => myProductIds.has(it.productId));
  if (isMine && PAID.has(o.status)) {
    completedOrderCount += 1;
    totalRevenueCents += o.totalCents;
  }
}

await db.ref(`merchants/${MERCHANT_ID}`).update({
  productCount: myProductIds.size,
  completedOrderCount,
  totalRevenueCents,
  updatedAt: new Date().toISOString(),
});

console.log("✅ Reconciled merchant counters from actual orders");
console.log(`   productCount:        ${myProductIds.size}`);
console.log(`   completedOrderCount: ${completedOrderCount}`);
console.log(`   totalRevenueCents:   ${totalRevenueCents} (฿${(totalRevenueCents / 100).toLocaleString()})`);
process.exit(0);
