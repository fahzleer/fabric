/**
 * k6 load test — Full checkout flow (end-to-end)
 *
 * Flow per VU:
 *   1. Search for a product
 *   2. GET product detail
 *   3. Apply promotion code (optional)
 *   4. Place order
 *   5. Create payment intent
 *   6. GET shipment tracking
 *
 * This is the "golden path" — simulates a real customer purchasing.
 *
 * Usage:
 *   k6 run tools/k6/scripts/checkout.js \
 *     -e BASE_URL=http://localhost:4000 \
 *     -e AUTH_TOKEN=<customer-token>
 */

import http   from "k6/http";
import { check, sleep, group } from "k6";
import { Rate, Trend, Counter } from "k6/metrics";

// ── Custom metrics ────────────────────────────────────────────────────────────
const checkoutErrors    = new Rate("checkout_errors");
const checkoutDuration  = new Trend("checkout_e2e_duration");
const checkoutsComplete = new Counter("checkouts_completed");

// ── Config ────────────────────────────────────────────────────────────────────
const BASE_URL   = __ENV.BASE_URL   || "http://localhost:4000";
const AUTH_TOKEN = __ENV.AUTH_TOKEN || "";

export const options = {
  scenarios: {
    checkout_flow: {
      executor:  "ramping-vus",
      startVUs:  0,
      stages: [
        { duration: "30s", target: 10 },
        { duration: "2m",  target: 30 },
        { duration: "30s", target: 10 },
        { duration: "10s", target: 0  },
      ],
      gracefulRampDown: "15s",
    },
  },
  thresholds: {
    http_req_failed:      ["rate<0.02"],
    checkout_errors:      ["rate<0.05"],    // < 5% full-flow failures
    checkout_e2e_duration: ["p(90)<5000"],  // 90th pct under 5s end-to-end
  },
};

const SEARCH_TERMS  = ["shirt", "laptop", "shoes", "book", "coffee"];
const PROMO_CODES   = ["SAVE10", "WELCOME20", "FLASH50"];
const CUSTOMER_IDS  = ["cust_001", "cust_002", "cust_003"];

function headers(contentType = true) {
  return {
    ...(contentType ? { "Content-Type": "application/json" } : {}),
    ...(AUTH_TOKEN  ? { Authorization: `Bearer ${AUTH_TOKEN}` } : {}),
  };
}

export default function () {
  const flowStart  = Date.now();
  let   flowFailed = false;
  let   productId  = null;
  let   orderId    = null;

  // ── 1. Search ──────────────────────────────────────────────────────────────
  group("1_search", () => {
    const q   = SEARCH_TERMS[Math.floor(Math.random() * SEARCH_TERMS.length)];
    const res = http.get(`${BASE_URL}/api/search?q=${encodeURIComponent(q)}&limit=5`, {
      headers: headers(false),
    });

    const ok = check(res, { "search: 200": (r) => r.status === 200 });
    if (!ok) { flowFailed = true; return; }

    try {
      const results = JSON.parse(res.body);
      if (Array.isArray(results) && results.length > 0) {
        productId = results[0].id ?? results[0].productId ?? "prod_001";
      } else {
        productId = "prod_001"; // fallback
      }
    } catch {
      productId = "prod_001";
    }
  });

  if (flowFailed) {
    checkoutErrors.add(1);
    return;
  }
  sleep(0.2);

  // ── 2. Product detail ──────────────────────────────────────────────────────
  group("2_product_detail", () => {
    const res = http.get(`${BASE_URL}/api/products/${productId}`, {
      headers: headers(false),
    });
    check(res, { "product: 200 or 404": (r) => r.status === 200 || r.status === 404 });
  });

  sleep(0.3);

  // ── 3. Validate promo code (50% of users) ─────────────────────────────────
  if (Math.random() < 0.5) {
    group("3_promo", () => {
      const code = PROMO_CODES[Math.floor(Math.random() * PROMO_CODES.length)];
      const res  = http.get(`${BASE_URL}/api/promotions/validate?code=${code}`, {
        headers: headers(false),
      });
      // 404 is fine — promo code just won't apply
      check(res, { "promo: not 5xx": (r) => r.status < 500 });
    });
    sleep(0.1);
  }

  // ── 4. Place order ─────────────────────────────────────────────────────────
  group("4_place_order", () => {
    const customerId = CUSTOMER_IDS[Math.floor(Math.random() * CUSTOMER_IDS.length)];
    const payload    = JSON.stringify({
      customerId,
      items: [{ productId, quantity: 1, unitPrice: 299 }],
    });

    const res = http.post(`${BASE_URL}/api/orders`, payload, { headers: headers() });
    const ok  = check(res, { "order: 201": (r) => r.status === 201 });

    if (!ok) { flowFailed = true; return; }

    try { orderId = JSON.parse(res.body).id; } catch { /* ignore */ }
  });

  if (flowFailed) {
    checkoutErrors.add(1);
    return;
  }
  sleep(0.2);

  // ── 5. Create payment ──────────────────────────────────────────────────────
  group("5_payment", () => {
    if (!orderId) return;
    const payload = JSON.stringify({
      orderId,
      method:   "card",
      provider: "omise",
      amount:   299,
      currency: "THB",
    });

    const res = http.post(`${BASE_URL}/api/payments`, payload, { headers: headers() });
    check(res, { "payment: 201 or 200": (r) => r.status === 201 || r.status === 200 });
  });

  sleep(0.2);

  // ── 6. Shipment tracking ───────────────────────────────────────────────────
  group("6_shipment", () => {
    if (!orderId) return;
    const res = http.get(`${BASE_URL}/api/shipments?orderId=${orderId}`, {
      headers: headers(false),
    });
    check(res, { "shipment: not 5xx": (r) => r.status < 500 });
  });

  // ── Record E2E metrics ─────────────────────────────────────────────────────
  checkoutDuration.add(Date.now() - flowStart);
  if (!flowFailed) checkoutsComplete.add(1);

  sleep(0.5);
}
