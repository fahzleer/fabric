import { describe, expect, mock, test } from "bun:test";
import { None, Some } from "@fabric/types";
import { Temporal } from "@js-temporal/polyfill";
import type { ActivityRepositoryPort } from "../../application/ports/activity.repository.port";
import type { CartRepositoryPort } from "../../application/ports/cart.repository.port";
import type { ProductRepositoryPort } from "../../application/ports/product.repository.port";
import type { Cart, CartItem } from "../../domain/cart/cart.entity";
import type { CartId, CartItemQuantity } from "../../domain/cart/cart.value-objects";
import type { Product } from "../../domain/product/product.entity";
import type { ProductId, ProductPrice } from "../../domain/product/product.value-objects";
import type { UserId } from "../../domain/user/user.value-objects";
import { CartService } from "./cart.service";

const REPO_ERR = { _tag: "RepositoryError" as const, message: "db failure" };
const USER_ID = { __brand: "UserId", value: "user-001" } as unknown as UserId;
const PRODUCT_ID = "prod-001";

const EMPTY_CART: Cart = {
  id: { __brand: "CartId", value: "cart-001" } as unknown as CartId,
  userId: Some(USER_ID),
  items: [],
  createdAt: Temporal.Now.instant(),
  updatedAt: Temporal.Now.instant(),
};

const CART_WITH_ITEM: Cart = {
  ...EMPTY_CART,
  items: [
    {
      productId: { __brand: "ProductId", value: PRODUCT_ID } as unknown as ProductId,
      productName: "Test Shirt",
      unitPrice: {
        __brand: "ProductPrice",
        cents: 1999,
        currency: "USD",
      } as unknown as ProductPrice,
      size: "M" as const,
      quantity: { __brand: "CartItemQuantity", value: 2 } as unknown as CartItemQuantity,
    } as CartItem,
  ],
};

const PRODUCT = {
  name: { value: "Test Shirt" },
  price: { __brand: "ProductPrice", cents: 1999, currency: "USD" },
} as unknown as Product;

type CartSaveFn = (cart: Cart) => ReturnType<CartRepositoryPort["save"]>;
type FindByUserIdFn = () => ReturnType<CartRepositoryPort["findByUserId"]>;
type ProductFindByIdFn = () => ReturnType<ProductRepositoryPort["findById"]>;

function makeDeps(
  overrides: {
    findByUserId?: FindByUserIdFn;
    cartSave?: CartSaveFn;
    productFindById?: ProductFindByIdFn;
  } = {}
) {
  const carts = {
    findByUserId: mock(
      overrides.findByUserId ?? (async () => ({ _tag: "Ok" as const, value: Some(EMPTY_CART) }))
    ),
    save: mock(overrides.cartSave ?? (async (c: Cart) => ({ _tag: "Ok" as const, value: c }))),
    findById: mock(async () => ({ _tag: "Ok" as const, value: EMPTY_CART })),
    delete: mock(async () => ({ _tag: "Ok" as const, value: { _tag: "Deleted" as const } })),
  } as unknown as CartRepositoryPort;
  const products = {
    findById: mock(
      overrides.productFindById ?? (async () => ({ _tag: "Ok" as const, value: PRODUCT }))
    ),
    findActive: mock(async () => ({
      _tag: "Ok" as const,
      value: { items: [], total: 0, page: 1, perPage: 20 },
    })),
    findActiveFiltered: mock(async () => ({
      _tag: "Ok" as const,
      value: { items: [], total: 0, page: 1, perPage: 20 },
    })),
    create: mock(async () => ({ _tag: "Ok" as const, value: PRODUCT })),
    save: mock(async () => ({ _tag: "Ok" as const, value: PRODUCT })),
    delete: mock(async () => ({ _tag: "Ok" as const, value: { _tag: "Deleted" as const } })),
    reserveStockAtomicUpdate: mock(async () => ({ _tag: "Ok" as const, value: PRODUCT })),
    reserveStockBatch: mock(async () => ({ _tag: "Ok" as const, value: [] })),
  } as unknown as ProductRepositoryPort;
  const activity = {
    track: mock(async () => ({ _tag: "Ok" as const, value: undefined })),
  } as unknown as ActivityRepositoryPort;
  return {
    svc: new CartService(carts, products, activity),
    carts,
    products,
    activity,
  };
}

describe("CartService.getOrCreateCart", () => {
  test("findByUserId Err → throws HTTPException", async () => {
    const { svc } = makeDeps({
      findByUserId: async () => ({ _tag: "Err", error: REPO_ERR }),
    });
    await expect(svc.getOrCreateCart(USER_ID)).rejects.toThrow();
  });

  test("findByUserId Ok(Some(cart)) → returns existing cart", async () => {
    const { svc } = makeDeps({
      findByUserId: async () => ({ _tag: "Ok", value: Some(EMPTY_CART) }),
    });
    const cart = await svc.getOrCreateCart(USER_ID);
    expect(cart).toBe(EMPTY_CART);
  });

  test("findByUserId Ok(None) + carts.save Err → throws HTTPException", async () => {
    const { svc } = makeDeps({
      findByUserId: async () => ({ _tag: "Ok", value: None() }),
      cartSave: async () => ({ _tag: "Err", error: REPO_ERR }),
    });
    await expect(svc.getOrCreateCart(USER_ID)).rejects.toThrow();
  });

  test("findByUserId Ok(None) + carts.save Ok → returns newly created cart", async () => {
    const { svc, carts } = makeDeps({
      findByUserId: async () => ({ _tag: "Ok", value: None() }),
    });
    const result = await svc.getOrCreateCart(USER_ID);
    expect(result.items).toEqual([]);
    expect(carts.save).toHaveBeenCalledTimes(1);
  });
});

describe("CartService.addItem", () => {
  test("getOrCreateCart throws → addItem propagates the exception", async () => {
    const { svc } = makeDeps({
      findByUserId: async () => ({ _tag: "Err", error: REPO_ERR }),
    });
    await expect(svc.addItem(USER_ID, PRODUCT_ID, "M", 1)).rejects.toThrow();
  });

  test("products.findById Err → throws HTTPException", async () => {
    const { svc } = makeDeps({
      productFindById: async () => ({ _tag: "Err", error: REPO_ERR }),
    });
    await expect(svc.addItem(USER_ID, PRODUCT_ID, "M", 1)).rejects.toThrow();
  });

  test("addItemToCart domain Err (invalid size) → throws HTTPException 422", async () => {
    const { svc } = makeDeps();
    await expect(svc.addItem(USER_ID, PRODUCT_ID, "INVALID", 1)).rejects.toThrow();
  });

  test("carts.save Err after addItemToCart succeeds → throws HTTPException", async () => {
    const { svc } = makeDeps({
      cartSave: async () => ({ _tag: "Err", error: REPO_ERR }),
    });
    await expect(svc.addItem(USER_ID, PRODUCT_ID, "M", 1)).rejects.toThrow();
  });

  test("success → returns updated cart; activity.track fired (fire-and-forget)", async () => {
    const { svc, activity } = makeDeps();
    const result = await svc.addItem(USER_ID, PRODUCT_ID, "M", 1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.productId.value).toBe(PRODUCT_ID);

    await Promise.resolve();
    expect(activity.track).toHaveBeenCalledTimes(1);
    expect(activity.track).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "cart_item_added" })
    );
  });
});

describe("CartService.removeItem", () => {
  test("getOrCreateCart throws → removeItem propagates the exception", async () => {
    const { svc } = makeDeps({
      findByUserId: async () => ({ _tag: "Err", error: REPO_ERR }),
    });
    await expect(svc.removeItem(USER_ID, PRODUCT_ID, "M")).rejects.toThrow();
  });

  test("item not in cart → removeItemFromCart Err → throws HTTPException", async () => {
    const { svc } = makeDeps({
      findByUserId: async () => ({ _tag: "Ok", value: Some(EMPTY_CART) }),
    });
    await expect(svc.removeItem(USER_ID, PRODUCT_ID, "M")).rejects.toThrow();
  });

  test("carts.save Err after removeItemFromCart succeeds → throws HTTPException", async () => {
    const { svc } = makeDeps({
      findByUserId: async () => ({ _tag: "Ok", value: Some(CART_WITH_ITEM) }),
      cartSave: async () => ({ _tag: "Err", error: REPO_ERR }),
    });
    await expect(svc.removeItem(USER_ID, PRODUCT_ID, "M")).rejects.toThrow();
  });

  test("success → returns cart without item; activity.track fired", async () => {
    const { svc, activity } = makeDeps({
      findByUserId: async () => ({ _tag: "Ok", value: Some(CART_WITH_ITEM) }),
    });
    const result = await svc.removeItem(USER_ID, PRODUCT_ID, "M");
    expect(result.items).toHaveLength(0);
    await Promise.resolve();
    expect(activity.track).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "cart_item_removed" })
    );
  });
});

describe("CartService.updateItemQty", () => {
  test("getOrCreateCart throws → updateItemQty propagates the exception", async () => {
    const { svc } = makeDeps({
      findByUserId: async () => ({ _tag: "Err", error: REPO_ERR }),
    });
    await expect(svc.updateItemQty(USER_ID, PRODUCT_ID, "M", 3)).rejects.toThrow();
  });

  test("item not in cart → updateCartItemQuantity Err → throws HTTPException", async () => {
    const { svc } = makeDeps({
      findByUserId: async () => ({ _tag: "Ok", value: Some(EMPTY_CART) }),
    });
    await expect(svc.updateItemQty(USER_ID, PRODUCT_ID, "M", 3)).rejects.toThrow();
  });

  test("carts.save Err after updateCartItemQuantity succeeds → throws HTTPException", async () => {
    const { svc } = makeDeps({
      findByUserId: async () => ({ _tag: "Ok", value: Some(CART_WITH_ITEM) }),
      cartSave: async () => ({ _tag: "Err", error: REPO_ERR }),
    });
    await expect(svc.updateItemQty(USER_ID, PRODUCT_ID, "M", 5)).rejects.toThrow();
  });

  test("success → returns cart with updated quantity; activity.track fired", async () => {
    const { svc, activity } = makeDeps({
      findByUserId: async () => ({ _tag: "Ok", value: Some(CART_WITH_ITEM) }),
    });
    const result = await svc.updateItemQty(USER_ID, PRODUCT_ID, "M", 5);
    const item = result.items.find((i) => i.productId.value === PRODUCT_ID && i.size === "M");
    expect(item?.quantity.value).toBe(5);
    await Promise.resolve();
    expect(activity.track).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "cart_item_quantity_updated" })
    );
  });
});

describe("CartService.clearCart", () => {
  test("always saves a fresh empty cart with new UUID and returns {cleared:true}", async () => {
    const { svc, carts } = makeDeps({});
    const result = await svc.clearCart(USER_ID);
    expect(result).toEqual({ cleared: true });
    expect(carts.save).toHaveBeenCalledTimes(1);

    const savedCart = (carts.save as ReturnType<typeof mock>).mock.calls[0]?.[0] as Cart;
    expect(savedCart.items).toHaveLength(0);
    expect(savedCart.id.value).toBeTruthy();
  });

  test("fresh cart has a different UUID each call", async () => {
    const { svc } = makeDeps({});
    await svc.clearCart(USER_ID);
    await svc.clearCart(USER_ID);

    const { svc: svc2, carts: carts2 } = makeDeps({});
    await svc2.clearCart(USER_ID);
    await svc2.clearCart(USER_ID);
    const ids = (carts2.save as ReturnType<typeof mock>).mock.calls.map(
      (c) => (c[0] as Cart).id.value
    );
    expect(ids[0]).not.toBe(ids[1]);
  });
});
