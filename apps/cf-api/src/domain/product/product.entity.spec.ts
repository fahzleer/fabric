import { describe, expect, it } from "bun:test";
import { Temporal } from "@js-temporal/polyfill";
import type { Product } from "./product.entity";
import {
  getAvailableSizes,
  getPrimaryImage,
  getStockForSize,
  isProductAvailable,
  isSizeAvailable,
  releaseStock,
  reserveStock,
  toProductSummary,
  transitionProductStatus,
} from "./product.entity";

const makeStock = (sizes: Partial<Record<"XS" | "S" | "M" | "L" | "XL", number>>) => {
  const stock: Record<string, { __brand: "StockQuantity"; value: number }> = {};
  for (const [size, qty] of Object.entries(sizes)) {
    stock[size] = { __brand: "StockQuantity", value: qty as number };
  }
  return stock as Product["stock"];
};

const makeProduct = (overrides: Partial<Product> = {}): Product => ({
  id: { __brand: "ProductId", value: "prod-1" },
  ownerId: "user-1",
  name: { __brand: "ProductName", value: "Test Shirt" },
  description: "A test product",
  price: { __brand: "ProductPrice", amount: 499, currency: "THB" },
  category: "basic",
  status: "active",
  stock: makeStock({ S: 5, M: 10, L: 3 }),
  images: [
    {
      url: "/img/main.jpg" as Product["images"][number]["url"],
      altText: "Main",
      isPrimary: true,
      order: 0,
    },
    {
      url: "/img/side.jpg" as Product["images"][number]["url"],
      altText: "Side",
      isPrimary: false,
      order: 1,
    },
  ],
  createdAt: Temporal.Now.instant(),
  updatedAt: Temporal.Now.instant(),
  ...overrides,
});

describe("getPrimaryImage", () => {
  it("returns the image with isPrimary=true", () => {
    const product = makeProduct();
    const img = getPrimaryImage(product);
    expect(img.isPrimary).toBe(true);
    expect(img.url).toBe("/img/main.jpg" as Product["images"][number]["url"]);
  });

  it("falls back to first image when no primary exists", () => {
    const product = makeProduct({
      images: [
        {
          url: "/img/a.jpg" as Product["images"][number]["url"],
          altText: "A",
          isPrimary: false,
          order: 0,
        },
        {
          url: "/img/b.jpg" as Product["images"][number]["url"],
          altText: "B",
          isPrimary: false,
          order: 1,
        },
      ],
    });
    const img = getPrimaryImage(product);
    expect(img.url).toBe("/img/a.jpg" as Product["images"][number]["url"]);
  });
});

describe("getStockForSize", () => {
  it("returns Some(qty) for a size that exists", () => {
    const product = makeProduct();
    const result = getStockForSize(product, "S");
    expect(result._tag).toBe("Some");
    if (result._tag === "Some") {
      expect(result.value.value).toBe(5);
    }
  });

  it("returns None for a size not in stock map", () => {
    const product = makeProduct();
    const result = getStockForSize(product, "XS");
    expect(result._tag).toBe("None");
  });
});

describe("getAvailableSizes", () => {
  it("returns only sizes with qty > 0", () => {
    const product = makeProduct({
      stock: makeStock({ S: 5, M: 0, L: 3 }),
    });
    const sizes = getAvailableSizes(product);
    expect(sizes).toContain("S");
    expect(sizes).toContain("L");
    expect(sizes).not.toContain("M");
    expect(sizes).not.toContain("XS");
  });

  it("returns empty array when all sizes are 0", () => {
    const product = makeProduct({
      stock: makeStock({ S: 0, M: 0 }),
    });
    expect(getAvailableSizes(product)).toHaveLength(0);
  });
});

describe("isProductAvailable", () => {
  it("returns true when status=active and has stock", () => {
    const product = makeProduct();
    expect(isProductAvailable(product)).toBe(true);
  });

  it("returns false when status=active but all stock is 0", () => {
    const product = makeProduct({ stock: makeStock({ S: 0 }) });
    expect(isProductAvailable(product)).toBe(false);
  });

  it("returns false when status=archived even if stock > 0", () => {
    const product = makeProduct({ status: "archived" });
    expect(isProductAvailable(product)).toBe(false);
  });

  it("returns false when status=draft even if stock > 0", () => {
    const product = makeProduct({ status: "draft" });
    expect(isProductAvailable(product)).toBe(false);
  });
});

describe("isSizeAvailable", () => {
  it("returns true when size exists and has enough stock", () => {
    const product = makeProduct();
    expect(isSizeAvailable(product, "S", 5)).toBe(true);
    expect(isSizeAvailable(product, "M", 1)).toBe(true);
  });

  it("returns false when requested qty exceeds available", () => {
    const product = makeProduct();
    expect(isSizeAvailable(product, "L", 4)).toBe(false);
  });

  it("returns false for a size not in stock map", () => {
    const product = makeProduct();
    expect(isSizeAvailable(product, "XS", 1)).toBe(false);
  });
});

describe("transitionProductStatus", () => {
  it("allows valid transition: draft → active", () => {
    const product = makeProduct({ status: "draft" });
    const result = transitionProductStatus(product, "active");
    expect(result._tag).toBe("Ok");
    if (result._tag === "Ok") {
      expect(result.value.status).toBe("active");
    }
  });

  it("allows valid transition: active → archived", () => {
    const product = makeProduct({ status: "active" });
    const result = transitionProductStatus(product, "archived");
    expect(result._tag).toBe("Ok");
    if (result._tag === "Ok") {
      expect(result.value.status).toBe("archived");
    }
  });

  it("rejects invalid transition: draft → archived (must go through active)", () => {
    const product = makeProduct({ status: "draft" });
    const result = transitionProductStatus(product, "archived");
    expect(result._tag).toBe("Err");
    if (result._tag === "Err") {
      expect(result.error._tag).toBe("InvalidStatusTransitionError");
    }
  });

  it("rejects any transition from archived (terminal state)", () => {
    const product = makeProduct({ status: "archived" });
    const result = transitionProductStatus(product, "active");
    expect(result._tag).toBe("Err");
    if (result._tag === "Err") {
      expect(result.error._tag).toBe("InvalidStatusTransitionError");
      expect(result.error.message).toContain("archived");
    }
  });

  it("updates updatedAt on successful transition", () => {
    const before = Temporal.Now.instant();
    const product = makeProduct({ status: "draft" });
    const result = transitionProductStatus(product, "active");
    if (result._tag === "Ok") {
      expect(Temporal.Instant.compare(result.value.updatedAt, before)).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("reserveStock", () => {
  it("reduces stock for the given size", () => {
    const product = makeProduct();
    const result = reserveStock(product, "M", 3);
    expect(result._tag).toBe("Ok");
    if (result._tag === "Ok") {
      const newStock = result.value.stock.M;
      expect(newStock?.value).toBe(7);
    }
  });

  it("does not auto-transition status when last unit reserved (stock and status are independent)", () => {
    const product = makeProduct({ stock: makeStock({ S: 2 }), status: "active" });
    const result = reserveStock(product, "S", 2);
    expect(result._tag).toBe("Ok");
    if (result._tag === "Ok") {
      expect(result.value.status).toBe("active");
      expect(result.value.stock.S?.value).toBe(0);
    }
  });

  it("returns ProductOutOfStockError when insufficient stock", () => {
    const product = makeProduct();
    const result = reserveStock(product, "L", 10);
    expect(result._tag).toBe("Err");
    if (result._tag === "Err") {
      expect(result.error._tag).toBe("ProductOutOfStockError");
      expect(result.error.message).toContain("10");
      expect(result.error.message).toContain("3");
    }
  });

  it("returns ProductOutOfStockError for a size not in stock map", () => {
    const product = makeProduct();
    const result = reserveStock(product, "XL", 1);
    expect(result._tag).toBe("Err");
    if (result._tag === "Err") {
      expect(result.error._tag).toBe("ProductOutOfStockError");
      expect(result.error.message).toContain("0");
    }
  });
});

describe("releaseStock", () => {
  it("increases stock for the given size", () => {
    const product = makeProduct();
    const updated = releaseStock(product, "S", 3);
    expect(updated.stock.S?.value).toBe(8);
  });

  it("creates stock entry if size was not in map", () => {
    const product = makeProduct({ stock: makeStock({ S: 5 }) });
    const updated = releaseStock(product, "XL", 2);
    expect(updated.stock.XL?.value).toBe(2);
  });

  it("does not auto-transition status (stock and status are independent)", () => {
    const active = makeProduct({ status: "active", stock: makeStock({ S: 0 }) });
    const updated = releaseStock(active, "S", 5);
    expect(updated.status).toBe("active");
    expect(updated.stock.S?.value).toBe(5);
  });

  it("does not change status for draft or archived products", () => {
    const draft = makeProduct({ status: "draft" });
    expect(releaseStock(draft, "S", 5).status).toBe("draft");

    const archived = makeProduct({ status: "archived" });
    expect(releaseStock(archived, "S", 5).status).toBe("archived");
  });
});

describe("toProductSummary", () => {
  it("produces summary with correct fields", () => {
    const product = makeProduct();
    const summary = toProductSummary(product);
    expect(summary.id).toEqual(product.id);
    expect(summary.name).toEqual(product.name);
    expect(summary.isInStock).toBe(true);
    expect(summary.primaryImage.isPrimary).toBe(true);
    expect(summary.availableSizes.length).toBeGreaterThan(0);
  });

  it("isInStock is false for archived product", () => {
    const product = makeProduct({ status: "archived" });
    const summary = toProductSummary(product);
    expect(summary.isInStock).toBe(false);
  });
});
