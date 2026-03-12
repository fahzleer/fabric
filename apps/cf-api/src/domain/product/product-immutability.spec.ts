import { describe, expect, it } from "bun:test";
import { Temporal } from "@js-temporal/polyfill";
import type { Product } from "./product.entity";
import {
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
  ],
  createdAt: Temporal.Now.instant(),
  updatedAt: Temporal.Now.instant(),
  ...overrides,
});

type RowWithRev = { product: Product; rev: number };

class InMemoryProductRepository {
  private readonly store = new Map<string, RowWithRev[]>();

  create(product: Product): { product: Product; rev: number } {
    const id = product.id.value;
    const row: RowWithRev = { product, rev: 1 };
    this.store.set(id, [row]);
    return row;
  }

  save(product: Product): { product: Product; rev: number } {
    const id = product.id.value;
    const history = this.store.get(id) ?? [];
    const maxRev = history.reduce((m, r) => Math.max(m, r.rev), 0);
    const nextRev = maxRev + 1;
    const row: RowWithRev = { product, rev: nextRev };
    this.store.set(id, [...history, row]);
    return row;
  }

  delete(id: string): { product: Product; rev: number } | null {
    const history = this.store.get(id);
    if (!history || history.length === 0) return null;
    const latest = history[history.length - 1];
    if (!latest) return null;
    const archived: Product = { ...latest.product, status: "archived" };
    return this.save(archived);
  }

  getHistory(id: string): RowWithRev[] {
    return this.store.get(id) ?? [];
  }

  findLatest(id: string): RowWithRev | null {
    const history = this.store.get(id) ?? [];
    return history[history.length - 1] ?? null;
  }
}

describe("product update must create new revision not mutate", () => {
  it("save() increments revision from 1 to 2", () => {
    const repo = new InMemoryProductRepository();
    const original = makeProduct();

    const created = repo.create(original);
    expect(created.rev).toBe(1);

    const updated: Product = {
      ...original,
      name: { __brand: "ProductName", value: "Updated Shirt" },
      updatedAt: Temporal.Now.instant(),
    };

    const saved = repo.save(updated);
    expect(saved.rev).toBe(2);
  });

  it("original entity object remains unchanged after save()", () => {
    const repo = new InMemoryProductRepository();
    const original = makeProduct();
    const originalName = original.name.value;

    repo.create(original);

    const updated: Product = {
      ...original,
      name: { __brand: "ProductName", value: "Updated Shirt" },
      updatedAt: Temporal.Now.instant(),
    };

    repo.save(updated);

    expect(original.name.value).toBe(originalName);
  });

  it("history grows by one row per save, old rows are preserved", () => {
    const repo = new InMemoryProductRepository();
    const original = makeProduct();

    repo.create(original);

    const v2: Product = {
      ...original,
      name: { __brand: "ProductName", value: "V2 Name" },
    };
    repo.save(v2);

    const v3: Product = {
      ...original,
      name: { __brand: "ProductName", value: "V3 Name" },
    };
    repo.save(v3);

    const history = repo.getHistory(original.id.value);
    expect(history).toHaveLength(3);
    expect(history[0]?.rev).toBe(1);
    expect(history[1]?.rev).toBe(2);
    expect(history[2]?.rev).toBe(3);
  });

  it("entity-level state transition returns NEW object, does not mutate source", () => {
    const original = makeProduct({ status: "draft" });

    const result = transitionProductStatus(original, "active");
    expect(result._tag).toBe("Ok");
    if (result._tag === "Ok") {
      expect(result.value.status).toBe("active");
      expect(original.status).toBe("draft");
      expect(result.value).not.toBe(original);
    }
  });

  it("entity-level reserveStock returns NEW object, does not mutate source", () => {
    const original = makeProduct();
    const result = reserveStock(original, "M", 3);
    expect(result._tag).toBe("Ok");
    if (result._tag === "Ok") {
      expect(result.value.stock.M?.value).toBe(7);
      expect(original.stock.M?.value).toBe(10);
    }
  });

  it("entity-level releaseStock returns NEW object, does not mutate source", () => {
    const original = makeProduct();
    const updated = releaseStock(original, "S", 3);

    expect(updated.stock.S?.value).toBe(8);
    expect(original.stock.S?.value).toBe(5);
    expect(updated).not.toBe(original);
  });
});

describe("product delete must archive not truly delete", () => {
  it("delete() inserts new revision with status='archived'", () => {
    const repo = new InMemoryProductRepository();
    const product = makeProduct({ status: "active" });
    repo.create(product);

    const result = repo.delete(product.id.value);
    expect(result).not.toBeNull();
    expect(result?.product.status).toBe("archived");
  });

  it("archived revision has the same product id as the original", () => {
    const repo = new InMemoryProductRepository();
    const product = makeProduct({ status: "active" });
    repo.create(product);

    const result = repo.delete(product.id.value);
    expect(result?.product.id.value).toBe(product.id.value);
  });

  it("archived revision is NOT undefined or null", () => {
    const repo = new InMemoryProductRepository();
    const product = makeProduct({ status: "active" });
    repo.create(product);

    const result = repo.delete(product.id.value);
    expect(result).toBeDefined();
    expect(result).not.toBeNull();
  });

  it("delete() creates a new revision row, not replace the old one", () => {
    const repo = new InMemoryProductRepository();
    const product = makeProduct({ status: "active" });
    repo.create(product);

    repo.delete(product.id.value);

    const history = repo.getHistory(product.id.value);

    expect(history).toHaveLength(2);
    expect(history[0]?.product.status).toBe("active");
    expect(history[1]?.product.status).toBe("archived");
  });

  it("delete() returns rev=2 when deleting a rev=1 product", () => {
    const repo = new InMemoryProductRepository();
    const product = makeProduct({ status: "active" });
    repo.create(product);

    const result = repo.delete(product.id.value);
    expect(result?.rev).toBe(2);
  });
});

describe("product create must start at rev=1", () => {
  it("create() assigns rev=1 to a brand-new product", () => {
    const repo = new InMemoryProductRepository();
    const product = makeProduct();

    const result = repo.create(product);
    expect(result.rev).toBe(1);
  });

  it("history contains exactly one row after create()", () => {
    const repo = new InMemoryProductRepository();
    const product = makeProduct();
    repo.create(product);

    expect(repo.getHistory(product.id.value)).toHaveLength(1);
  });

  it("new product starts as the caller-specified status (no forced draft)", () => {
    const repo = new InMemoryProductRepository();
    const product = makeProduct({ status: "draft" });
    const result = repo.create(product);

    expect(result.product.status).toBe("draft");
  });
});

describe("archived product must still exist (soft delete)", () => {
  it("archived product retains its original name", () => {
    const repo = new InMemoryProductRepository();
    const product = makeProduct();
    repo.create(product);
    const result = repo.delete(product.id.value);

    expect(result?.product.name.value).toBe(product.name.value);
  });

  it("archived product retains its original price", () => {
    const repo = new InMemoryProductRepository();
    const product = makeProduct();
    repo.create(product);
    const result = repo.delete(product.id.value);

    expect(result?.product.price.amount).toBe(product.price.amount);
    expect(result?.product.price.currency).toBe(product.price.currency);
  });

  it("archived product retains its original description", () => {
    const repo = new InMemoryProductRepository();
    const product = makeProduct();
    repo.create(product);
    const result = repo.delete(product.id.value);

    expect(result?.product.description).toBe(product.description);
  });

  it("archived product retains its original category", () => {
    const repo = new InMemoryProductRepository();
    const product = makeProduct();
    repo.create(product);
    const result = repo.delete(product.id.value);

    expect(result?.product.category).toBe(product.category);
  });

  it("archived product retains its original ownerId", () => {
    const repo = new InMemoryProductRepository();
    const product = makeProduct();
    repo.create(product);
    const result = repo.delete(product.id.value);

    expect(result?.product.ownerId).toBe(product.ownerId);
  });

  it("archived product retains its stock map", () => {
    const repo = new InMemoryProductRepository();
    const product = makeProduct();
    repo.create(product);
    const result = repo.delete(product.id.value);

    expect(result?.product.stock.S?.value).toBe(5);
    expect(result?.product.stock.M?.value).toBe(10);
    expect(result?.product.stock.L?.value).toBe(3);
  });

  it("archived product retains its images", () => {
    const repo = new InMemoryProductRepository();
    const product = makeProduct();
    repo.create(product);
    const result = repo.delete(product.id.value);

    expect(result?.product.images).toHaveLength(product.images.length);
    expect(result?.product.images[0]?.url).toBe(product.images[0]?.url);
  });

  it("toProductSummary on archived product shows isInStock=false", () => {
    const repo = new InMemoryProductRepository();
    const product = makeProduct();
    repo.create(product);
    const archivedRow = repo.delete(product.id.value);

    if (!archivedRow) throw new Error("Expected archived row");
    const summary = toProductSummary(archivedRow.product);

    expect(summary.status).toBe("archived");
    expect(summary.isInStock).toBe(false);

    expect(summary.id.value).toBe(product.id.value);
    expect(summary.name.value).toBe(product.name.value);
  });

  it("rev=1 row (active) is still readable after soft-delete", () => {
    const repo = new InMemoryProductRepository();
    const product = makeProduct({ status: "active" });
    repo.create(product);
    repo.delete(product.id.value);

    const history = repo.getHistory(product.id.value);
    const firstRevRow = history[0];
    expect(firstRevRow?.product.status).toBe("active");
    expect(firstRevRow?.rev).toBe(1);
  });
});
