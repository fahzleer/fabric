import { describe, expect, test } from "bun:test";
import { makeProductId, makeProductPriceFromCents } from "@fabric/types";
import type { Product } from "./types";
import {
  getProductAvailableSizes,
  getProductPrimaryImage,
  getProductStockForSize,
  getStockAvailable,
  isProductAvailable,
  isProductSizeAvailable,
  isStockInStock,
  makeStockInfo,
  toProductSummary,
} from "./types";

const makeName = (v: string) => ({ __brand: "ProductName" as const, value: v });
const makeImage = (isPrimary: boolean, order = 0) => ({
  url: `/img-${order}.jpg`,
  altText: "alt",
  isPrimary,
  order,
});

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: makeProductId("prod-1"),
    name: makeName("Test Shirt") as Product["name"],
    slug: "test-shirt",
    description: "A test shirt",
    tagline: "Great shirt",
    price: makeProductPriceFromCents(10_000, "THB"),
    category: "basic",
    status: "active",
    images: [makeImage(true, 0)] as unknown as Product["images"],
    stock: [makeStockInfo("M", 10, 2), makeStockInfo("L", 0, 0)],
    material: "Cotton",
    care: "Machine wash",
    metadata: {
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
      viewCount: 0,
      salesCount: 0,
    },
    ...overrides,
  };
}

describe("makeStockInfo", () => {
  test("creates a StockInfo with correct fields", () => {
    const s = makeStockInfo("M", 10, 3);
    expect(s.size).toBe("M");
    expect(s.quantity).toBe(10);
    expect(s.reserved).toBe(3);
  });
});

describe("getStockAvailable", () => {
  test("returns quantity minus reserved", () => {
    expect(getStockAvailable(makeStockInfo("M", 10, 3))).toBe(7);
  });

  test("returns 0 when fully reserved", () => {
    expect(getStockAvailable(makeStockInfo("M", 5, 5))).toBe(0);
  });
});

describe("isStockInStock", () => {
  test("returns true when available > 0", () => {
    expect(isStockInStock(makeStockInfo("M", 5, 2))).toBe(true);
  });

  test("returns false when available is 0", () => {
    expect(isStockInStock(makeStockInfo("M", 5, 5))).toBe(false);
  });

  test("returns false when quantity = 0", () => {
    expect(isStockInStock(makeStockInfo("L", 0, 0))).toBe(false);
  });
});

describe("getProductPrimaryImage", () => {
  test("returns the image marked isPrimary = true", () => {
    const product = makeProduct({
      images: [makeImage(false, 0), makeImage(true, 1)] as unknown as Product["images"],
    });
    const img = getProductPrimaryImage(product);
    expect(img.isPrimary).toBe(true);
    expect(img.order).toBe(1);
  });

  test("returns first image when no primary is set", () => {
    const product = makeProduct({
      images: [makeImage(false, 0), makeImage(false, 1)] as unknown as Product["images"],
    });
    const img = getProductPrimaryImage(product);
    expect(img.order).toBe(0);
  });
});

describe("isProductAvailable", () => {
  test("returns true for active product with stock", () => {
    const product = makeProduct({ status: "active" });
    expect(isProductAvailable(product)).toBe(true);
  });

  test("returns false for draft product even with stock", () => {
    const product = makeProduct({ status: "draft" });
    expect(isProductAvailable(product)).toBe(false);
  });

  test("returns false for archived product", () => {
    const product = makeProduct({ status: "archived" });
    expect(isProductAvailable(product)).toBe(false);
  });

  test("returns false when active but all stock 0", () => {
    const product = makeProduct({
      status: "active",
      stock: [makeStockInfo("M", 0, 0), makeStockInfo("L", 0, 0)],
    });
    expect(isProductAvailable(product)).toBe(false);
  });
});

describe("getProductStockForSize", () => {
  test("returns Some(stockInfo) when size is found", () => {
    const product = makeProduct();
    const result = getProductStockForSize(product, "M");
    expect(result._tag).toBe("Some");
    if (result._tag === "Some") {
      expect(result.value.size).toBe("M");
    }
  });

  test("returns None when size is not in stock list", () => {
    const product = makeProduct();
    const result = getProductStockForSize(product, "XS");
    expect(result._tag).toBe("None");
  });
});

describe("isProductSizeAvailable", () => {
  test("returns true for size with available stock", () => {
    const product = makeProduct({
      stock: [makeStockInfo("M", 10, 2)],
    });
    expect(isProductSizeAvailable(product, "M")).toBe(true);
  });

  test("returns false for size with no stock", () => {
    const product = makeProduct();
    expect(isProductSizeAvailable(product, "L")).toBe(false);
  });

  test("returns false for size not in stock list", () => {
    const product = makeProduct();
    expect(isProductSizeAvailable(product, "XXL")).toBe(false);
  });
});

describe("getProductAvailableSizes", () => {
  test("returns only sizes with available stock", () => {
    const product = makeProduct({
      stock: [makeStockInfo("M", 10, 2), makeStockInfo("L", 0, 0), makeStockInfo("XL", 5, 1)],
    });
    const sizes = getProductAvailableSizes(product);
    expect(sizes).toContain("M");
    expect(sizes).toContain("XL");
    expect(sizes).not.toContain("L");
  });

  test("returns empty array when all stock is 0", () => {
    const product = makeProduct({
      stock: [makeStockInfo("M", 0, 0)],
    });
    expect(getProductAvailableSizes(product)).toHaveLength(0);
  });
});

describe("toProductSummary", () => {
  test("creates a ProductSummary with correct fields", () => {
    const product = makeProduct({ status: "active" });
    const summary = toProductSummary(product);

    expect(summary.id.value).toBe("prod-1");
    expect(summary.name.value).toBe("Test Shirt");
    expect(summary.category).toBe("basic");
    expect(summary.status).toBe("active");
    expect(summary.inStock).toBe(true);
  });

  test("sets inStock to false for unavailable product", () => {
    const product = makeProduct({
      status: "draft",
      stock: [makeStockInfo("M", 0, 0)],
    });
    const summary = toProductSummary(product);
    expect(summary.inStock).toBe(false);
  });
});
