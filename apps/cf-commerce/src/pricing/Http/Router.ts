import { Either, pipe } from "effect";
import type { Hono } from "hono";
import { checkoutFlow } from "../Pipeline/Checkout.ts";
import { reserveStock } from "../Pipeline/Inventory.ts";
import { validatePricing } from "../Pipeline/Pricing.ts";
import { calculateOrder } from "../Pipeline/TShirtDiscount.ts";
import { applyVoucher } from "../Pipeline/Voucher.ts";
import {
  decodeCheckoutRequest,
  decodeInventoryRequest,
  decodePricingRequest,
  decodeVoucherApplyRequest,
  encodeCheckoutResult,
  encodeInventoryResult,
  encodePricingResult,
  encodeResult,
  encodeVoucherResult,
} from "./Codec.ts";

export const registerPricingRoutes = (app: Hono): void => {
  app.post("/checkout/calculate", async (c) => {
    const body = await c.req.json();
    const result = pipe(decodeCheckoutRequest(body), Either.flatMap(checkoutFlow));
    return c.json(encodeResult(result, encodeCheckoutResult));
  });

  app.post("/pricing/validate", async (c) => {
    const body = await c.req.json();
    const result = pipe(decodePricingRequest(body), Either.flatMap(validatePricing));
    return c.json(encodeResult(result, encodePricingResult));
  });

  app.post("/inventory/reserve", async (c) => {
    const body = await c.req.json();
    const result = pipe(decodeInventoryRequest(body), Either.flatMap(reserveStock));
    return c.json(encodeResult(result, encodeInventoryResult));
  });

  app.post("/voucher/apply", async (c) => {
    const body = await c.req.json();
    const result = pipe(
      decodeVoucherApplyRequest(body),
      Either.flatMap(({ voucher, subtotalCents }) => applyVoucher(voucher)(subtotalCents))
    );
    return c.json(encodeResult(result, encodeVoucherResult));
  });

  app.post("/pos/calculate", async (c) => {
    try {
      const { lines } = (await c.req.json()) as { lines: Parameters<typeof calculateOrder>[0] };
      const result = calculateOrder(lines);
      return c.json({ ok: true, value: result });
    } catch {
      return c.json({
        ok: false,
        error: { tag: "ParseError", message: "Invalid /pos/calculate body" },
      });
    }
  });
};
