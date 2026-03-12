import { describe, expect, it } from "bun:test";
import {
  type GetProductInput,
  type ListProductsInput,
  type PaginatedProductsDto,
  type ProductDetailDto,
  type ProductSortField,
  type ProductSummaryDto,
  VALID_SORT_FIELDS,
} from "./index";

describe("VALID_SORT_FIELDS values are all strings", () => {
  it("every entry is typeof string", () => {
    for (const field of VALID_SORT_FIELDS) {
      expect(typeof field).toBe("string");
    }
  });

  it("no entry is undefined", () => {
    for (const field of VALID_SORT_FIELDS) {
      expect(field).not.toBeUndefined();
    }
  });

  it("no entry is null", () => {
    for (const field of VALID_SORT_FIELDS) {
      expect(field).not.toBeNull();
    }
  });

  it("no entry is an empty string", () => {
    for (const field of VALID_SORT_FIELDS) {
      expect(field.length).toBeGreaterThan(0);
    }
  });

  it("all 5 sort fields are present", () => {
    const expected: ProductSortField[] = [
      "price_asc",
      "price_desc",
      "name_asc",
      "name_desc",
      "created_desc",
    ];
    for (const field of expected) {
      expect(VALID_SORT_FIELDS.has(field)).toBe(true);
    }
  });
});

describe("ListProductsInput schema", () => {
  it("accepts an object with page and perPage as numbers", () => {
    const input: ListProductsInput = { page: 1, perPage: 20 };
    expect(input.page).toBe(1);
    expect(input.perPage).toBe(20);
  });

  it("accepts an empty object — page and perPage are optional", () => {
    const input: ListProductsInput = {};
    expect(input.page).toBeUndefined();
    expect(input.perPage).toBeUndefined();
  });

  it("page field, when provided, is a number", () => {
    const input: ListProductsInput = { page: 3, perPage: 10 };
    expect(typeof input.page).toBe("number");
  });

  it("perPage field, when provided, is a number", () => {
    const input: ListProductsInput = { page: 1, perPage: 50 };
    expect(typeof input.perPage).toBe("number");
  });

  it("category field is optional and accepts a string", () => {
    const input: ListProductsInput = { category: "basic" };
    expect(input.category).toBe("basic");
  });

  it("sort field is optional and accepts a valid ProductSortField", () => {
    const input: ListProductsInput = { sort: "price_asc" };
    expect(VALID_SORT_FIELDS.has(input.sort as ProductSortField)).toBe(true);
  });

  it("minPrice and maxPrice are optional numbers", () => {
    const input: ListProductsInput = { minPrice: 1000, maxPrice: 50000 };
    expect(typeof input.minPrice).toBe("number");
    expect(typeof input.maxPrice).toBe("number");
  });
});

describe("ProductSummaryDto has all required fields", () => {
  const makeSummaryDto = (overrides: Partial<ProductSummaryDto> = {}): ProductSummaryDto => ({
    id: "prod-1",
    name: "Test Shirt",
    price: 499,
    priceCurrency: "THB",
    category: "basic",
    status: "active",
    primaryImage: {
      url: "/img/main.jpg",
      altText: "Main",
      isPrimary: true,
      order: 0,
    },
    availableSizes: ["S", "M", "L"],
    ...overrides,
  });

  it("id field is a non-empty string", () => {
    const dto = makeSummaryDto();
    expect(typeof dto.id).toBe("string");
    expect(dto.id.length).toBeGreaterThan(0);
  });

  it("name field is a non-empty string", () => {
    const dto = makeSummaryDto();
    expect(typeof dto.name).toBe("string");
    expect(dto.name.length).toBeGreaterThan(0);
  });

  it("price field is a positive number", () => {
    const dto = makeSummaryDto();
    expect(typeof dto.price).toBe("number");
    expect(dto.price).toBeGreaterThan(0);
  });

  it("priceCurrency field is a non-empty string", () => {
    const dto = makeSummaryDto();
    expect(typeof dto.priceCurrency).toBe("string");
    expect(dto.priceCurrency.length).toBeGreaterThan(0);
  });

  it("status field is a valid ProductStatus string", () => {
    const dto = makeSummaryDto();
    const validStatuses = ["draft", "active", "archived"];
    expect(validStatuses).toContain(dto.status);
  });

  it("category field is a non-empty string", () => {
    const dto = makeSummaryDto();
    expect(typeof dto.category).toBe("string");
    expect(dto.category.length).toBeGreaterThan(0);
  });

  it("availableSizes field is an array", () => {
    const dto = makeSummaryDto();
    expect(Array.isArray(dto.availableSizes)).toBe(true);
  });

  it("primaryImage can be null (product with no images configured)", () => {
    const dto = makeSummaryDto({ primaryImage: null });
    expect(dto.primaryImage).toBeNull();
  });

  it("primaryImage, when present, has url, altText, isPrimary, order", () => {
    const dto = makeSummaryDto();
    const img = dto.primaryImage;
    expect(img).not.toBeNull();
    if (img !== null) {
      expect(typeof img.url).toBe("string");
      expect(typeof img.altText).toBe("string");
      expect(typeof img.isPrimary).toBe("boolean");
      expect(typeof img.order).toBe("number");
    }
  });

  it("ProductDetailDto extends ProductSummaryDto with description, images, timestamps", () => {
    const detail: ProductDetailDto = {
      id: "prod-1",
      name: "Test Shirt",
      price: 499,
      priceCurrency: "THB",
      category: "basic",
      status: "active",
      primaryImage: null,
      availableSizes: [],
      description: "A test product",
      images: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    expect(typeof detail.description).toBe("string");
    expect(Array.isArray(detail.images)).toBe(true);
    expect(typeof detail.createdAt).toBe("string");
    expect(typeof detail.updatedAt).toBe("string");
    expect(detail.id).toBe("prod-1");
    expect(detail.name).toBe("Test Shirt");
  });
});

describe("contract types produce no undefined escapes", () => {
  it("VALID_SORT_FIELDS iteration never yields undefined", () => {
    const entries = [...VALID_SORT_FIELDS];
    for (const entry of entries) {
      expect(entry).toBeDefined();
    }
    expect(entries.length).toBe(5);
  });

  it("PaginatedProductsDto shapes have defined items, total, page, perPage", () => {
    const paginated: PaginatedProductsDto = {
      items: [],
      total: 0,
      page: 1,
      perPage: 20,
    };

    expect(Array.isArray(paginated.items)).toBe(true);
    expect(typeof paginated.total).toBe("number");
    expect(typeof paginated.page).toBe("number");
    expect(typeof paginated.perPage).toBe("number");
  });

  it("GetProductInput id is a string", () => {
    const input: GetProductInput = { id: "prod-123" };
    expect(typeof input.id).toBe("string");
    expect(input.id).toBe("prod-123");
  });

  it("VALID_SORT_FIELDS Set contains no duplicate entries (Set guarantees uniqueness)", () => {
    const asArray = [...VALID_SORT_FIELDS];
    const asSet = new Set(asArray);
    expect(asSet.size).toBe(asArray.length);
  });
});
