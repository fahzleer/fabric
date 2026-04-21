import { describe, expect, test } from "bun:test";
import { makeProduct } from "./constructors";

const VALID_DATA = {
  id: "prod-1",
  name: "Test Shirt",
  slug: "test-shirt",
  description: "A quality test shirt",
  tagline: "Great choice",
  priceInDollars: 10_000,
  currency: "THB" as const,
  category: "basic" as const,
  status: "active" as const,
  images: [
    { url: "/img1.jpg", alt: "front", isPrimary: true, order: 0 },
    { url: "/img2.jpg", alt: "back", isPrimary: false, order: 1 },
  ],
  stock: [
    { size: "M" as const, quantity: 10, reserved: 2 },
    { size: "L" as const, quantity: 5, reserved: 0 },
  ],
  material: "100% Cotton",
  care: "Machine wash cold",
};

describe("makeProduct", () => {
  test("returns Ok with a valid Product on success", () => {
    const result = makeProduct(VALID_DATA);
    expect(result._tag).toBe("Ok");
    if (result._tag === "Ok") {
      expect(result.value.id).toBe("prod-1");
      expect(result.value.name).toBe("Test Shirt");
      expect(result.value.stock).toHaveLength(2);
      expect(result.value.images).toHaveLength(2);
    }
  });

  test("returns Err(ProductConstructionError) for invalid product name (too short)", () => {
    const result = makeProduct({ ...VALID_DATA, name: "X" });
    expect(result._tag).toBe("Err");
    if (result._tag === "Err") {
      expect(result.error._tag).toBe("ProductConstructionError");
    }
  });

  test("returns Err(ProductConstructionError) for invalid product name (too long, 121 chars)", () => {
    const result = makeProduct({ ...VALID_DATA, name: "A".repeat(121) });
    expect(result._tag).toBe("Err");
    if (result._tag === "Err") {
      expect(result.error._tag).toBe("ProductConstructionError");
    }
  });

  test("returns Err(ProductConstructionError) for negative price", () => {
    const result = makeProduct({ ...VALID_DATA, priceInDollars: -1 });
    expect(result._tag).toBe("Err");
    if (result._tag === "Err") {
      expect(result.error._tag).toBe("ProductConstructionError");
    }
  });

  test("returns Err(ProductConstructionError) for invalid image URL", () => {
    const result = makeProduct({
      ...VALID_DATA,
      images: [{ url: "invalid-url", alt: "img", isPrimary: true, order: 0 }],
    });
    expect(result._tag).toBe("Err");
    if (result._tag === "Err") {
      expect(result.error._tag).toBe("ProductConstructionError");
    }
  });

  test("returns Err when images array is empty (after filtering invalid)", () => {
    const result = makeProduct({
      ...VALID_DATA,
      images: [{ url: "bad", alt: "", isPrimary: true, order: 0 }],
    });
    expect(result._tag).toBe("Err");
  });

  test("sets metadata with createdAt and updatedAt", () => {
    const result = makeProduct(VALID_DATA);
    if (result._tag === "Ok") {
      expect(typeof result.value.metadata.createdAt).toBe("string");
      expect(typeof result.value.metadata.updatedAt).toBe("string");
      expect(result.value.metadata.viewCount).toBe(0);
      expect(result.value.metadata.salesCount).toBe(0);
    }
  });

  test("accepts https image URL", () => {
    const result = makeProduct({
      ...VALID_DATA,
      images: [{ url: "https://cdn.example.com/img.jpg", alt: "img", isPrimary: true, order: 0 }],
    });
    expect(result._tag).toBe("Ok");
  });
});
