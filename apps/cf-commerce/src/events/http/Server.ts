import { Option } from "effect";
import type { Hono } from "hono";
import type { ProductAgg } from "../aggregator/ProductAgg.ts";
import { fromJson } from "../domain/Event.ts";
import type { Hub } from "../notification/Hub.ts";
import type { Router } from "../router/Router.ts";

export interface ServerConfig {
  readonly router: Router;
  readonly aggregator: ProductAgg;
  readonly hub: Hub;
}

export const registerEventsRoutes = (app: Hono, config: ServerConfig): void => {
  app.get("/health", (c) => c.json({ status: "ok" }));

  app.post("/events", async (c) => {
    let raw: string;
    try {
      const body = await c.req.json();
      raw = typeof body === "string" ? body : JSON.stringify(body);
    } catch {
      return c.json({ error: "Invalid JSON" }, 400);
    }

    const result = fromJson(raw);
    if (!result.ok) {
      return c.json({ error: `Invalid event JSON: ${result.error}` }, 400);
    }

    config.router.route(result.value).catch(() => undefined);
    return c.json({ accepted: true }, 202);
  });

  app.get("/products", (c) => {
    const products = config.aggregator.getAllProducts();
    return c.json(
      products.map((p) => ({
        product_id: p.productId,
        owner_id: p.ownerId,
        name: p.name,
        price: p.price,
        currency: p.currency,
        category: p.category,
        status: p.status,
        rev: p.rev,
        last_event_at: p.lastEventAt,
      }))
    );
  });

  app.get("/products/:id", (c) => {
    const maybeState = config.aggregator.getProduct(c.req.param("id"));
    if (Option.isNone(maybeState)) return c.json({ error: "not found" }, 404);
    const p = maybeState.value;
    return c.json({
      product_id: p.productId,
      owner_id: p.ownerId,
      name: p.name,
      price: p.price,
      currency: p.currency,
      category: p.category,
      status: p.status,
      rev: p.rev,
      last_event_at: p.lastEventAt,
    });
  });

  app.get("/sse/:userId", (c) => {
    const userId = c.req.param("userId");

    const stream = new ReadableStream({
      start(controller) {
        config.hub.register(userId, (msg: string) => {
          try {
            controller.enqueue(`data: ${msg}\n\n`);
          } catch {
            config.hub.deregister(userId);
          }
        });
        controller.enqueue(": connected\n\n");
      },
      cancel() {
        config.hub.deregister(userId);
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    }) as unknown as Response;
  });
};
