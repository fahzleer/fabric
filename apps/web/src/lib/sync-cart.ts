import type { CartItem } from "@/domain/cart/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3010";

export async function syncCartToServer(
  items: readonly CartItem[],
  authToken: string
): Promise<boolean> {
  try {
    await fetch(`${API_BASE}/api/cart`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${authToken}` },
    });

    for (const item of items) {
      const res = await fetch(`${API_BASE}/api/cart/items`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          productId: item.productId.value,
          size: item.size,
          quantity: item.quantity,
        }),
      });
      if (!res.ok) return false;
    }
    return true;
  } catch {
    return false;
  }
}
