import { type } from "arktype";
import type { Hono } from "hono";
import type { UserId } from "../../domain/user/user.value-objects";
import type { PasetoVerifierService } from "../../infrastructure/auth/paseto-verifier.service";
import { requireAuth } from "../../infrastructure/guards/auth.middleware";
import type { CartService } from "./cart.service";

const AddItemBody = type({ productId: "string >= 1", size: "string >= 1", quantity: "number > 0" });
const UpdateQtyBody = type({ quantity: "number > 0" });

export function registerCartRoutes(
  app: Hono,
  service: CartService,
  verifier: PasetoVerifierService
): void {
  app.get("/api/cart", requireAuth(verifier), async (c) => {
    const userId = { __brand: "UserId" as const, value: c.get("userId") as string } as UserId;
    return c.json(await service.getOrCreateCart(userId));
  });

  app.post("/api/cart/items", requireAuth(verifier), async (c) => {
    const body = await c.req.json();
    const validated = AddItemBody(body);
    if (validated instanceof type.errors) return c.json({ error: validated.summary }, 400);
    const userId = { __brand: "UserId" as const, value: c.get("userId") as string } as UserId;
    return c.json(
      await service.addItem(userId, validated.productId, validated.size, validated.quantity)
    );
  });

  app.delete("/api/cart/items/:productId/:size", requireAuth(verifier), async (c) => {
    const userId = { __brand: "UserId" as const, value: c.get("userId") as string } as UserId;
    return c.json(await service.removeItem(userId, c.req.param("productId"), c.req.param("size")));
  });

  app.put("/api/cart/items/:productId/:size", requireAuth(verifier), async (c) => {
    const body = await c.req.json();
    const validated = UpdateQtyBody(body);
    if (validated instanceof type.errors) return c.json({ error: validated.summary }, 400);
    const userId = { __brand: "UserId" as const, value: c.get("userId") as string } as UserId;
    return c.json(
      await service.updateItemQty(
        userId,
        c.req.param("productId"),
        c.req.param("size"),
        validated.quantity
      )
    );
  });

  app.delete("/api/cart", requireAuth(verifier), async (c) => {
    const userId = { __brand: "UserId" as const, value: c.get("userId") as string } as UserId;
    return c.json(await service.clearCart(userId));
  });
}
