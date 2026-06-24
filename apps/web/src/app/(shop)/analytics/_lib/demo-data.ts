/** Deterministic seeded RNG so demo data is always the same */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export interface DemoOrder {
  orderId: string;
  userId: string;
  value: number; // THB
  date: Date;
  channel: string; // last-touch acquisition channel
  product: string;
}

export interface DemoFunnelStage {
  stage: string;
  users: number;
}

const PRODUCTS = [
  { id: "ruxium-plus", name: "Ruxium Plus", price: 990 },
  { id: "ruxicah", name: "Ruxicah", price: 1290 },
  { id: "rusiren", name: "RUSIREN", price: 890 },
  { id: "bundle-3", name: "Bundle 3-box", price: 2390 },
];

const CHANNELS = ["meta", "google", "tiktok", "line_oa", "shopee"];

function userOrdersPerYear(rand: () => number): number {
  const tier = rand();
  if (tier > 0.8) return 8 + Math.floor(rand() * 4);
  if (tier > 0.3) return 3 + Math.floor(rand() * 4);
  return 1 + Math.floor(rand() * 2);
}

function generateOrdersForUser(
  u: number,
  userId: string,
  channel: string,
  rand: () => number,
  now: Date
): DemoOrder[] {
  const ordersPerYear = userOrdersPerYear(rand);
  const firstOffsetDays = 180 + Math.floor(rand() * 180);
  const firstDate = new Date(now.getTime() - firstOffsetDays * 86400000);
  const result: DemoOrder[] = [];

  for (let o = 0; o < ordersPerYear; o++) {
    const dayOffset = Math.floor((o / ordersPerYear) * firstOffsetDays);
    const jitter = Math.floor((rand() - 0.5) * 14);
    const orderDate = new Date(firstDate.getTime() + (dayOffset + jitter) * 86400000);
    if (orderDate > now) break;
    const product = PRODUCTS[Math.floor(rand() * PRODUCTS.length)];
    if (!product) continue;
    const qty = rand() > 0.7 ? 2 : 1;
    result.push({
      orderId: `ord-${u}-${o}`,
      userId,
      value: product.price * qty,
      date: orderDate,
      channel,
      product: product.name,
    });
  }
  return result;
}

// 40 customers, up to 12 months of purchase history
export function generateDemoOrders(): DemoOrder[] {
  const rand = rng(42);
  const now = new Date("2026-06-01");
  const orders: DemoOrder[] = [];

  for (let u = 0; u < 40; u++) {
    const userId = `user-${String(u + 1).padStart(3, "0")}`;
    const channel = (CHANNELS[Math.floor(rand() * CHANNELS.length)] ?? "meta") as string;
    orders.push(...generateOrdersForUser(u, userId, channel, rand, now));
  }

  return orders.sort((a, b) => a.date.getTime() - b.date.getTime());
}

export const DEMO_FUNNEL: DemoFunnelStage[] = [
  { stage: "Website Visit", users: 48200 },
  { stage: "Product View", users: 18700 },
  { stage: "Add to Cart", users: 6340 },
  { stage: "Checkout Started", users: 3210 },
  { stage: "Purchase", users: 1870 },
];

export const DEMO_PRICE_POINTS = [
  { price: 690, demand: 820 },
  { price: 790, demand: 670 },
  { price: 890, demand: 540 },
  { price: 990, demand: 420 },
  { price: 1090, demand: 310 },
  { price: 1190, demand: 240 },
  { price: 1290, demand: 185 },
  { price: 1490, demand: 120 },
];

export const DEMO_JOURNEYS = [
  ["meta", "google", "meta", "shopee"],
  ["tiktok", "meta", "google"],
  ["google", "google"],
  ["line_oa", "meta", "google", "shopee"],
  ["meta", "tiktok", "meta"],
  ["google", "line_oa", "google"],
  ["shopee", "meta", "google", "shopee"],
  ["tiktok", "google"],
  ["meta", "meta", "google"],
  ["line_oa", "shopee"],
];
