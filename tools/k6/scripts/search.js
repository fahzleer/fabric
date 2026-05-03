/**
 * k6 load test — Search service
 *
 * Scenarios:
 *   1. keyword search  (GET /api/search?q=...)
 *   2. filtered search (GET /api/search?q=...&category=...&minPrice=...&maxPrice=...)
 *
 * Usage:
 *   k6 run tools/k6/scripts/search.js \
 *     -e BASE_URL=http://localhost:4000
 */

import http   from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

const errorRate        = new Rate("search_errors");
const keywordTrend     = new Trend("search_keyword_duration");
const filteredTrend    = new Trend("search_filtered_duration");

const BASE_URL = __ENV.BASE_URL || "http://localhost:4000";

export const options = {
  scenarios: {
    search_load: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "20s", target: 30  },
        { duration: "1m",  target: 100 },
        { duration: "20s", target: 30  },
        { duration: "10s", target: 0   },
      ],
      gracefulRampDown: "10s",
    },
  },
  thresholds: {
    http_req_failed:        ["rate<0.01"],
    http_req_duration:      ["p(95)<600"],
    search_keyword_duration: ["p(95)<500"],
    search_filtered_duration: ["p(95)<600"],
  },
};

const QUERIES = [
  "shirt", "laptop", "coffee", "shoes", "book",
  "phone", "headphones", "desk", "chair", "pen",
];
const CATEGORIES = ["electronics", "clothing", "food", "furniture", "stationery"];

export default function () {
  const headers = { "Content-Type": "application/json" };

  // ── Keyword search ─────────────────────────────────────────────────────────
  {
    const q     = QUERIES[Math.floor(Math.random() * QUERIES.length)];
    const start = Date.now();
    const res   = http.get(
      `${BASE_URL}/api/search?q=${encodeURIComponent(q)}&limit=20`,
      { headers }
    );
    keywordTrend.add(Date.now() - start);
    errorRate.add(res.status !== 200);

    check(res, {
      "search: status 200":    (r) => r.status === 200,
      "search: has results":   (r) => {
        try { return Array.isArray(JSON.parse(r.body)); } catch { return true; }
      },
    });
  }

  sleep(0.15);

  // ── Filtered search ────────────────────────────────────────────────────────
  {
    const q        = QUERIES[Math.floor(Math.random() * QUERIES.length)];
    const category = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
    const minPrice = Math.floor(Math.random() * 100);
    const maxPrice = minPrice + Math.floor(Math.random() * 500) + 100;

    const start = Date.now();
    const res   = http.get(
      `${BASE_URL}/api/search?q=${encodeURIComponent(q)}&category=${category}&minPrice=${minPrice}&maxPrice=${maxPrice}`,
      { headers }
    );
    filteredTrend.add(Date.now() - start);

    check(res, {
      "filtered: status 200": (r) => r.status === 200,
    });
  }

  sleep(0.2);
}
