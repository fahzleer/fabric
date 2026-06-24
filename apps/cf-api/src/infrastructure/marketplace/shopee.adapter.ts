import { createHmac } from "node:crypto";
import { log } from "../monitoring/logger";

export interface ShopeeProduct {
  shopId: number;
  itemId?: number;
  name: string;
  description: string;
  price: number;
  stock: number;
  images: string[];
}

export interface ShopeeOrder {
  orderSn: string;
  shopId: number;
  buyerUsername: string;
  totalAmount: number;
  currency: string;
  status: string;
  items: { itemId: number; name: string; quantity: number; price: number }[];
  shippingAddress: {
    name: string;
    phone: string;
    address: string;
    city: string;
    state: string;
    zipcode: string;
    country: string;
  };
}

// Shopee Open Platform — https://open.shopee.com/
export class ShopeeAdapter {
  private readonly baseUrl: string;

  constructor(
    private readonly partnerId: number,
    private readonly partnerKey: string,
    private readonly shopId: number,
    private readonly accessToken: string,
    private readonly isSandbox: boolean = false
  ) {
    this.baseUrl = isSandbox
      ? "https://partner.test-stable.shopeemobile.com"
      : "https://partner.shopeemobile.com";
  }

  private sign(path: string, timestamp: number): string {
    const baseStr = `${this.partnerId}${path}${timestamp}${this.accessToken}${this.shopId}`;
    return createHmac("sha256", this.partnerKey).update(baseStr).digest("hex");
  }

  private buildUrl(path: string): { url: string; timestamp: number; sign: string } {
    const timestamp = Math.floor(Date.now() / 1000);
    const sign = this.sign(path, timestamp);
    const url =
      `${this.baseUrl}${path}` +
      `?partner_id=${this.partnerId}&shop_id=${this.shopId}` +
      `&timestamp=${timestamp}&access_token=${this.accessToken}&sign=${sign}`;
    return { url, timestamp, sign };
  }

  async pushProduct(product: ShopeeProduct): Promise<string | undefined> {
    const path = "/api/v2/product/add_item";
    const { url } = this.buildUrl(path);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          original_shop_id: this.shopId,
          item_name: product.name,
          description: product.description,
          normal_stock: product.stock,
          original_price: product.price,
          image: { image_url_list: product.images },
        }),
      });

      if (!res.ok) {
        log.warn("Shopee: pushProduct failed", { status: res.status });
        return undefined;
      }

      const data = (await res.json()) as { response?: { item_id?: number } };
      return data.response?.item_id?.toString();
    } catch (err) {
      log.warn("Shopee: pushProduct error", { error: String(err) });
      return undefined;
    }
  }

  async getOrder(orderSn: string): Promise<ShopeeOrder | undefined> {
    const path = "/api/v2/order/get_order_detail";
    const { url } = this.buildUrl(path);

    try {
      const res = await fetch(`${url}&order_sn_list=${orderSn}&response_optional_fields=item_list`);
      if (!res.ok) return undefined;

      const data = (await res.json()) as {
        response?: { order_list?: unknown[] };
      };
      const raw = data.response?.order_list?.[0];
      if (!raw) return undefined;

      return raw as unknown as ShopeeOrder;
    } catch (err) {
      log.warn("Shopee: getOrder error", { orderSn, error: String(err) });
      return undefined;
    }
  }

  verifyWebhookSignature(rawBody: string, receivedSignature: string): boolean {
    const expected = createHmac("sha256", this.partnerKey)
      .update(`${this.partnerId}${rawBody}`)
      .digest("hex");
    return expected === receivedSignature;
  }
}
