import type { Hono } from "hono";
import type { ShopeeAdapter } from "../../infrastructure/marketplace/shopee.adapter";
import { log } from "../../infrastructure/monitoring/logger";

export function registerShopeeRoutes(app: Hono, shopee: ShopeeAdapter): void {
  // Shopee sends order status updates here
  app.post("/webhooks/shopee/order", async (c) => {
    const rawBody = await c.req.text();
    const signature = c.req.header("authorization") ?? "";

    if (!shopee.verifyWebhookSignature(rawBody, signature)) {
      return c.json({ error: "Invalid signature" }, 403);
    }

    const payload = JSON.parse(rawBody) as {
      code: number;
      data?: { ordersn?: string; status?: string };
      shopid?: number;
    };

    log.info("Shopee webhook received", {
      code: payload.code,
      orderSn: payload.data?.ordersn,
      status: payload.data?.status,
    });

    // code 3 = order status update
    if (payload.code === 3 && payload.data?.ordersn) {
      const orderSn = payload.data.ordersn;
      const shopeeOrder = await shopee.getOrder(orderSn);
      if (shopeeOrder) {
        log.info("Shopee order synced", { orderSn, status: shopeeOrder.status });
        // TODO: upsert into Firebase orders node with source=shopee
      }
    }

    return c.json({ success: true });
  });

  // Push a Fabric product to Shopee listing
  app.post("/api/shopee/products/sync", async (c) => {
    const body = (await c.req.json()) as {
      name: string;
      description: string;
      price: number;
      stock: number;
      images: string[];
    };

    const itemId = await shopee.pushProduct({ ...body, shopId: 0 });
    if (!itemId) return c.json({ error: "Failed to push product to Shopee" }, 500);

    return c.json({ itemId }, 201);
  });
}
