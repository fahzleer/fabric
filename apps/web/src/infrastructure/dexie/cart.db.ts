import type { CartItem, ShoppingCart } from "@/domain/cart/types";
import type { ProductId, ProductName, ProductSize } from "@/domain/product/types";
import Dexie, { type Table } from "dexie";

export interface DexieCartItem {
  id: string;
  productId: string;
  size: string;
  quantity: number;
  unitPriceCents: number;
  currency: string;
  productName: string;
  productImageUrl: string;
  addedAt: string;
}

export class CartDatabase extends Dexie {
  cartItems!: Table<DexieCartItem, string>;

  constructor() {
    super("fabric-cart");
    this.version(1).stores({
      cartItems: "id, productId, size",
    });
  }
}

export const cartDb = new CartDatabase();

export function dexieItemsToCart(items: DexieCartItem[]): ShoppingCart {
  const cartItems = items.map(
    (item) =>
      ({
        productId: item.productId as unknown as ProductId,
        size: item.size as ProductSize,
        quantity: item.quantity,
        productSnapshot: {
          name: item.productName as unknown as ProductName,
          price: {
            __brand: "ProductPrice",
            displayAmount: item.unitPriceCents / 100,
            cents: item.unitPriceCents,
            currency: item.currency,
          } as CartItem["productSnapshot"]["price"],
          image: {
            url: item.productImageUrl,
            altText: item.productName,
            isPrimary: true,
            order: 0,
          } as CartItem["productSnapshot"]["image"],
        },
      }) satisfies CartItem
  );

  return {
    id: "local",
    items: cartItems,
    updatedAt: new Date().toISOString(),
  };
}
