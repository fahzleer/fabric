import { type } from "arktype";
import type { Hono } from "hono";
import { analyzeABTest } from "./ab-test";
import { fitMMM } from "./marketing-mix";
import { eitherToResponse } from "./ml.errors";

const abTestSchema = type({
  control_conversions: "number >= 0",
  control_visitors: "number > 0",
  variant_conversions: "number >= 0",
  variant_visitors: "number > 0",
  "confidence_level?": "0.9 | 0.95 | 0.99",
});

const mmmSchema = type({
  spend: "Record<string, number[]>",
  sales: "number[]",
});

export function registerMlRoutes(app: Hono): void {
  app.post("/api/ml/ab-test", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = abTestSchema(body);
    if (parsed instanceof type.errors) {
      return c.json({ error: parsed.summary }, 400);
    }

    const { status, body: resBody } = eitherToResponse(analyzeABTest(parsed));
    return c.json(resBody, status as 200 | 400 | 422);
  });

  app.post("/api/ml/mmm", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = mmmSchema(body);
    if (parsed instanceof type.errors) {
      return c.json({ error: parsed.summary }, 400);
    }

    const { status, body: resBody } = eitherToResponse(fitMMM(parsed.spend, parsed.sales));
    return c.json(resBody, status as 200 | 400 | 422);
  });

  app.get("/api/ml/health", (c) => c.json({ status: "ok", service: "ml" }));
}
