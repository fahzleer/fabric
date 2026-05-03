/**
 * k6 load test — Order service
 *
 * Scenarios:
 *   1. place order  (POST /api/orders)
 *   2. get order    (GET  /api/orders/:id)
 *   3. list orders  (GET  /api/orders)
 *
 * Usage:
 *   k6 run tools/k6/scripts/orders.js \
 *     -e BASE_URL=http://localhost:4000 \
 *     -e AUTH_TOKEN=<bearer-token>
 */

import http   from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend, Counter } from "k6/metrics";

// ── Custom metrics ────────────────────────────────────────────────────────────
const errorRate      = new Rate("order_errors");
const placeOrderTime = new Trend("order_place_duration");
const getOrderTime   = new Trend("order_get_duration");
const ordersPlaced   = new Counter("orders_placed_total");

// ── Config ────────────────────────────────────────────────────────────────────
const BASE_URL   = __ENV.BASE_URL   || "http://localhost:4000";
const AUTH_TOKEN = __ENV.AUTH_TOKEN || "";

export const options = {
  scenarios: {
    steady_orders: {
      executor:  "constant-arrival-rate",
      rate:      10,          // 10 iterations/second
      timeUnit:  "1s",
      duration:  "2m",
      preAllocatedVUs: 20,
      maxVUs:          50,
    },
    spike_orders: {
      executor:  "ramping-arrival-rate",
      startRate: 5,
      timeUnit:  "1s",
      stages: [
        { duration: "30s", target: 50  },
        { duration: "30s", target: 100 },
        { duration: "30s", target: 5   },
      ],
      preAllocatedVUs: 50,
      maxVUs:          200,
      startTime:       "2m",
    },
  },
  thresholds: {
    http_req_failed:       ["rate<0.02"],   // < 2% errors (account for conflicts)
    http_req_duration:     ["p(95)<1000"],  // 95th pct under 1s
    order_place_duration:  ["p(95)<800"],
    order_get_duration:    ["p(95)<200"],
  },
};

const CUSTOMER_IDS = [
  "cust_001", "cust_002", "cust_003", "cust_004", "cust_005",
];
const PRODUCT_IDS = [
  "prod_001", "prod_002", "prod_003",
];

function randomOrderPayload() {
  const customerId = CUSTOMER_IDS[Math.floor(Math.random() * CUSTOMER_IDS.length)];
  const items      = Array.from({ length: Math.ceil(Math.random() * 3) }, () => ({
    productId: PRODUCT_IDS[Math.floor(Math.random() * PRODUCT_IDS.length)],
    quantity:  Math.ceil(Math.random() * 5),
    unitPrice: 100 + Math.floor(Math.random() * 900),
  }));

  return JSON.stringify({ customerId, items });
}

export default function () {
  const headers = {
    "Content-Type": "application/json",
    ...(AUTH_TOKEN ? { Authorization: `Bearer ${AUTH_TOKEN}` } : {}),
  };

  // ── Place order ────────────────────────────────────────────────────────────
  let orderId = null;
  {
    const start = Date.now();
    const res   = http.post(
      `${BASE_URL}/api/orders`,
      randomOrderPayload(),
      { headers }
    );
    placeOrderTime.add(Date.now() - start);
    errorRate.add(res.status >= 500);

    const ok = check(res, {
      "place: status 201": (r) => r.status === 201,
    });

    if (ok) {
      ordersPlaced.add(1);
      try {
        orderId = JSON.parse(res.body).id;
      } catch { /* ignore */ }
    }
  }

  sleep(0.1);

  // ── Get the order we just placed ───────────────────────────────────────────
  if (orderId) {
    const start = Date.now();
    const res   = http.get(`${BASE_URL}/api/orders/${orderId}`, { headers });
    getOrderTime.add(Date.now() - start);

    check(res, {
      "get: status 200": (r) => r.status === 200,
    });
  }

  sleep(0.2);
}
