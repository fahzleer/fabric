#!/usr/bin/env bun
/**
 * Seed realistic demo data for a merchant account so every merchant-portal page
 * shows content. Writes directly to the same RTDB (emulator) cf-api uses.
 *
 * Idempotent + collision-safe: record ids are derived from the target user id,
 * so re-running overwrites that user's data and never clobbers another user's.
 *
 * Target user is configurable via env (defaults to merchant@example.com):
 *   SEED_USER_ID, SEED_USER_EMAIL, SEED_STORE_NAME, SEED_STORE_SLUG
 *
 *   cd apps/cf-api && bun --env-file=.env run scripts/seed-demo.ts
 *   SEED_USER_ID=… SEED_USER_EMAIL=… bun --env-file=.env run scripts/seed-demo.ts
 */
import { createFirebaseFromEnv } from "@fabric/firebase";
import type {
  FirebaseMerchantRecord,
  FirebaseOrderItemRecord,
  FirebaseOrderRecord,
  FirebaseProductRecord,
} from "@fabric/firebase";
import { isErr } from "@fabric/types";

const USER_ID = process.env.SEED_USER_ID ?? "Ogh8EkguSoHdlPhV97QOJu5exeDrtf0s";
const USER_EMAIL = process.env.SEED_USER_EMAIL ?? "merchant@example.com";
const STORE_NAME = process.env.SEED_STORE_NAME ?? "Bangkok Threads";
const STORE_SLUG = process.env.SEED_STORE_SLUG ?? "bangkok-threads";
const P = USER_ID.slice(0, 8); // id prefix → unique, idempotent record keys per user

const NOW = new Date();
const iso = (daysAgo: number) => new Date(NOW.getTime() - daysAgo * 86_400_000).toISOString();

const fb = createFirebaseFromEnv();
if (isErr(fb)) {
  console.error("Firebase init failed:", fb.error.message);
  process.exit(1);
}
const db = fb.value.db;

const stock = () => ({ XS: 8, S: 20, M: 25, L: 18, XL: 10, XXL: 5 });
const img = (label: string, c: string) => [
  `https://placehold.co/600x600/${c}/e5e7eb?text=${encodeURIComponent(label)}`,
];

// ── Products ────────────────────────────────────────────────────────────────────
const baseProducts: Omit<FirebaseProductRecord, "id" | "ownerId" | "rev">[] = [
  {
    name: "Classic Bangkok Tee",
    description: "Premium cotton t-shirt crafted in Bangkok. Lightweight, breathable, everyday wear.",
    tagline: "Everyday comfort, Bangkok-made",
    price: 599,
    currency: "THB",
    category: "basic",
    status: "active",
    stock: stock(),
    imageUrls: img("Bangkok Tee", "1f2937"),
    isPrimaryImageFirst: true,
    createdAt: iso(45),
    updatedAt: iso(9),
  },
  {
    name: "Sukhumvit Hoodie",
    description: "Heavyweight fleece hoodie with a relaxed fit. Warm, soft, built for city nights.",
    tagline: "Cozy nights, Bangkok streets",
    price: 1290,
    currency: "THB",
    category: "premium",
    status: "active",
    stock: stock(),
    imageUrls: img("Sukhumvit Hoodie", "0f766e"),
    isPrimaryImageFirst: true,
    createdAt: iso(40),
    updatedAt: iso(8),
  },
  {
    name: "Chao Phraya Cap",
    description: "Six-panel cotton cap with an embroidered river motif. Adjustable strap, one size.",
    tagline: "Shade for the long boat ride",
    price: 390,
    currency: "THB",
    category: "basic",
    status: "active",
    stock: { OS: 60 },
    imageUrls: img("Chao Phraya Cap", "7c2d12"),
    isPrimaryImageFirst: true,
    createdAt: iso(35),
    updatedAt: iso(5),
  },
  {
    name: "Lanna Tote Bag",
    description: "Sturdy canvas tote with a hand-screened northern Lanna pattern. Everyday carry.",
    tagline: "Carry the north with you",
    price: 450,
    currency: "THB",
    category: "basic",
    status: "active",
    stock: { OS: 44 },
    imageUrls: img("Lanna Tote", "4c1d95"),
    isPrimaryImageFirst: true,
    createdAt: iso(28),
    updatedAt: iso(3),
  },
  {
    name: "Siam Bomber Jacket",
    description: "Limited-run satin bomber with a woven Siam dragon lining. Numbered edition.",
    tagline: "Wear the legend",
    price: 2490,
    currency: "THB",
    category: "limited_edition",
    status: "active",
    stock: { S: 4, M: 6, L: 5, XL: 2 },
    imageUrls: img("Siam Bomber", "9d174d"),
    isPrimaryImageFirst: true,
    createdAt: iso(20),
    updatedAt: iso(2),
  },
];

const products: FirebaseProductRecord[] = baseProducts.map((p, i) => ({
  ...p,
  id: `seed-${P}-p${i + 1}`,
  ownerId: USER_ID,
  rev: 1,
}));
const [TEE, HOODIE, CAP, TOTE, BOMBER] = products.map((p) => p.id) as [
  string,
  string,
  string,
  string,
  string,
];
const priceCents = (p: FirebaseProductRecord) => p.price * 100;

// ── Customers (real customer accounts, for the "customer" column) ────────────────
const CUST_A = "QMSutheJEWq17cOZkUkhgvt2O2iCAwKr"; // test@example.com
const CUST_B = "HB6Iy5YOZ0ipBHlSbCT42B3M4xIFXlXW"; // freshtest@example.com

const addr = (recipientName: string, city: string, province: string) => ({
  street: "123 Sukhumvit Rd",
  city,
  province,
  country: "TH",
  postalCode: "10110",
  recipientName,
  phone: "+66812345678",
});
const item = (
  p: FirebaseProductRecord,
  size: string,
  quantity: number
): FirebaseOrderItemRecord => ({
  productId: p.id,
  productName: p.name,
  size,
  quantity,
  unitPriceCents: priceCents(p),
});
const items = (...list: FirebaseOrderItemRecord[]): Record<string, FirebaseOrderItemRecord> =>
  Object.fromEntries(list.map((it, i) => [`item-${i}`, it]));

const tee = products[0]!;
const hoodie = products[1]!;
const cap = products[2]!;
const tote = products[3]!;
const bomber = products[4]!;

type SeedOrder = Omit<FirebaseOrderRecord, "cartId" | "updatedAt" | "totalCents"> & {
  shipping: number;
  paid: boolean;
};
const mkOrder = (
  n: number,
  customer: string,
  status: FirebaseOrderRecord["status"],
  daysAgo: number,
  shipping: number,
  paid: boolean,
  ...line: FirebaseOrderItemRecord[]
): SeedOrder => ({
  id: `seed-${P}-o${n}`,
  userId: customer,
  status,
  shippingCents: shipping,
  discountCents: 0,
  currency: "THB",
  items: items(...line),
  shippingAddress: addr(customer === CUST_A ? "Anong P." : "Krit S.", "Bangkok", "Bangkok"),
  voucherCode: null,
  placedAt: iso(daysAgo),
  confirmedAt: status === "pending" ? null : iso(daysAgo),
  shippedAt: status === "shipped" || status === "delivered" ? iso(daysAgo - 1) : null,
  trackingNumber: status === "shipped" || status === "delivered" ? `TH99${P}${n}` : null,
  cancelledAt: status === "cancelled" ? iso(daysAgo - 1) : null,
  paymentId: paid ? `pay_${P}_${n}` : null,
  shipping,
  paid,
});

const seedOrders: SeedOrder[] = [
  mkOrder(1, CUST_A, "delivered", 18, 0, true, item(tee, "M", 2)),
  mkOrder(2, CUST_B, "delivered", 14, 5000, true, item(hoodie, "L", 1), item(cap, "OS", 1)),
  mkOrder(3, CUST_A, "delivered", 11, 0, true, item(bomber, "XL", 1)),
  mkOrder(4, CUST_B, "shipped", 6, 5000, true, item(tote, "OS", 3)),
  mkOrder(5, CUST_A, "confirmed", 3, 0, true, item(tee, "S", 1), item(cap, "OS", 2)),
  mkOrder(6, CUST_B, "pending", 1, 5000, false, item(hoodie, "M", 1)),
  mkOrder(7, CUST_A, "cancelled", 9, 0, false, item(bomber, "M", 1)),
];

const orderTotal = (o: SeedOrder) =>
  Object.values(o.items).reduce((s, it) => s + it.unitPriceCents * it.quantity, 0) + o.shipping;

const completedOrderCount = seedOrders.filter((o) => o.paid).length;
const totalRevenueCents = seedOrders.filter((o) => o.paid).reduce((s, o) => s + orderTotal(o), 0);

// ── Write everything atomically ──────────────────────────────────────────────────
const updates: Record<string, unknown> = {};
for (const p of products) updates[`product_current/${p.id}`] = p;
for (const o of seedOrders) {
  const { shipping: _s, paid: _p, ...rest } = o;
  const record: FirebaseOrderRecord = {
    ...rest,
    cartId: `cart-${o.id}`,
    totalCents: orderTotal(o),
    updatedAt: o.placedAt,
  };
  updates[`orders/${o.id}`] = record;
}

const merchant: FirebaseMerchantRecord & {
  completedOrderCount: number;
  totalRevenueCents: number;
} = {
  userId: USER_ID,
  storeName: STORE_NAME,
  email: USER_EMAIL,
  plan: "professional",
  planStatus: "active",
  stripeCustomerId: null,
  stripeSubscriptionId: null,
  productCount: products.length,
  createdAt: iso(60),
  updatedAt: NOW.toISOString(),
  planExpiresAt: iso(-365),
  storeSlug: STORE_SLUG,
  completedOrderCount,
  totalRevenueCents,
};
updates[`merchants/${USER_ID}`] = merchant;
updates[`merchantsBySlug/${STORE_SLUG}`] = USER_ID;

await db.ref().update(updates);

console.log(`✅ Seed complete for ${USER_EMAIL} (${USER_ID})`);
console.log(`   products:            ${products.length}`);
console.log(`   orders:              ${seedOrders.length} (${completedOrderCount} paid)`);
console.log(`   completedOrderCount: ${completedOrderCount}`);
console.log(`   totalRevenueCents:   ${totalRevenueCents} (฿${(totalRevenueCents / 100).toLocaleString()})`);
console.log(`   plan:                professional / active · store "${STORE_NAME}"`);
process.exit(0);
