import type { ShoppingCart } from "@/domain/cart/types";

export type GuestOrderItem = {
  productId: string;
  size: string;
  quantity: number;
};

/** Cart items in the shape cf-api's guest-checkout path resolves against product data itself. */
export function buildGuestOrderItems(cart: ShoppingCart): GuestOrderItem[] {
  return cart.items.map((item) => ({
    productId: item.productId.value,
    size: item.size,
    quantity: item.quantity,
  }));
}

const GUEST_EMAIL_COOKIE = "fabric_guest_email";

/** Lets the confirmation page (a Server Component) prove guest order ownership without a session. */
export function setGuestEmailCookie(email: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${GUEST_EMAIL_COOKIE}=${encodeURIComponent(email)}; path=/; max-age=3600; samesite=lax`;
}
