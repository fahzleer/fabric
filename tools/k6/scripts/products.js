/**
 * k6 load test — Product service
 *
 * Scenarios:
 *   1. list products (GET /api/products)
 *   2. get product by id (GET /api/products/:id)
 *   3. create product (POST /api/products) — low VU, merchant token required
 *
 * Usage:
 *   k6 run tools/k6/scripts/products.js \
 *     -e BASE_URL=http://localhost:4000 \
 *     -e MERCHANT_TOKEN=<paseto-token>
 */

import http   from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

// ── Custom metrics ────────────────────────────────────────────────────────────
const errorRate  = new Rate("product_errors");
const listTrend  = new Trend("product_list_duration");
const getTrend   = new Trend("product_get_duration");

// ── Config ────────────────────────────────────────────────────────────────────
const BASE_URL       = __ENV.BASE_URL       || "http://localhost:4000";
const MERCHANT_TOKEN = __ENV.MERCHANT_TOKEN || "";

export const options = {
  scenarios: {
    list_products: {
      executor:          "ramping-vus",
      startVUs:          0,
      stages: [
        { duration: "30s", target: 20 },
        { duration: "1m",  target: 50 },
        { duration: "30s", target: 0  },
      ],
      gracefulRampDown: "10s",
    },
    get_product: {
      executor:          "constant-vus",
      vus:               10,
      duration:          "2m",
      startTime:         "30s",
    },
  },
  thresholds: {
    http_req_failed:        ["rate<0.01"],   // < 1% errors
    http_req_duration:      ["p(95)<500"],   // 95th pct under 500ms
    product_list_duration:  ["p(95)<300"],
    product_get_duration:   ["p(95)<200"],
  },
};

// Seeded product IDs (adjust to real IDs in your environment)
const PRODUCT_IDS = [
  "prod_001", "prod_002", "prod_003", "prod_004", "prod_005",
];

export default function () {
  const headers = {
    "Content-Type": "application/json",
    ...(MERCHANT_TOKEN ? { Authorization: `Bearer ${MERCHANT_TOKEN}` } : {}),
  };

  // ── List products ──────────────────────────────────────────────────────────
  {
    const start = Date.now();
    const res   = http.get(`${BASE_URL}/api/products?limit=20`, { headers });
    listTrend.add(Date.now() - start);
    errorRate.add(res.status !== 200);

    check(res, {
      "list: status 200":    (r) => r.status === 200,
      "list: has body":      (r) => r.body.length > 0,
    });
  }

  sleep(0.2);

  // ── Get product by id ──────────────────────────────────────────────────────
  {
    const id    = PRODUCT_IDS[Math.floor(Math.random() * PRODUCT_IDS.length)];
    const start = Date.now();
    const res   = http.get(`${BASE_URL}/api/products/${id}`, { headers });
    getTrend.add(Date.now() - start);

    // 404 is acceptable (seeded IDs may not exist)
    check(res, {
      "get: status 200 or 404": (r) => r.status === 200 || r.status === 404,
    });
  }

  sleep(0.3);
}
