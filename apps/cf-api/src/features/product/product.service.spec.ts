import { describe, expect, mock, test } from "bun:test";
import { Err, Ok } from "@fabric/types";
import type { ActivityRepositoryPort } from "../../application/ports/activity.repository.port";
import type { EventPublisherPort } from "../../application/ports/event-publisher.port";
import type {
  PaginatedResult,
  ProductRepositoryPort,
} from "../../application/ports/product.repository.port";
import type { Product, ProductSummary } from "../../domain/product/product.entity";
import { makeProductId } from "../../domain/product/product.value-objects";
import { ProductService } from "./product.service";

function makeProductRepo(overrides: Partial<ProductRepositoryPort> = {}): ProductRepositoryPort {
  return {
    findById: mock(async () => Ok(MOCK_PRODUCT)),
    findActive: mock(async () => Ok({ items: [], total: 0, page: 1, perPage: 20 })),
    findActiveFiltered: mock(async () => Ok({ items: [], total: 0, page: 1, perPage: 20 })),
    create: mock(async () => Ok(MOCK_PRODUCT)),
    save: mock(async () => Ok(MOCK_PRODUCT)),
    delete: mock(async () => Ok({ _tag: "Deleted" as const })),
    reserveStockAtomicUpdate: mock(async () => Ok(MOCK_PRODUCT)),
    reserveStockBatch: mock(async () => Ok([MOCK_PRODUCT])),
    findByOwner: mock(async () => Ok({ items: [], total: 0, page: 1, perPage: 20 })),
    ...overrides,
  };
}

function makeEventPublisher(): EventPublisherPort {
  return {
    publish: mock(async () => undefined),
  };
}

function makeActivityRepo(): ActivityRepositoryPort {
  return {
    track: mock(async () => Ok(undefined)),
  };
}

function makeService(
  productOverrides: Partial<ProductRepositoryPort> = {},
  eventPublisher?: EventPublisherPort,
  activityRepo?: ActivityRepositoryPort
): {
  service: ProductService;
  productRepo: ProductRepositoryPort;
  publisher: EventPublisherPort;
  activity: ActivityRepositoryPort;
} {
  const productRepo = makeProductRepo(productOverrides);
  const publisher = eventPublisher ?? makeEventPublisher();
  const activity = activityRepo ?? makeActivityRepo();
  const service = new ProductService(productRepo, publisher, activity);
  return { service, productRepo, publisher, activity };
}

const PRODUCT_ID = makeProductId("prod-abc-123");

const MOCK_PRODUCT: Product = {
  id: PRODUCT_ID,
  ownerId: "owner-001",
  name: { __brand: "ProductName" as const, value: "Test T-Shirt" },
  description: "A great t-shirt",
  price: { amount: 29.99, currency: "THB" as const, __brand: "ProductPrice" as const },
  category: "basic",
  status: "draft",
  stock: {},
  images: [
    {
      url: "https://cdn.example.com/img.jpg",
      alt: "front view",
      isPrimary: true,
      order: 0,
      __brand: "ProductImage" as const,
    },
  ] as unknown as Product["images"],
  createdAt: { epochMilliseconds: 1700000000000n } as unknown as Product["createdAt"],
  updatedAt: { epochMilliseconds: 1700000000000n } as unknown as Product["updatedAt"],
};

const VALID_CREATE_INPUT = {
  ownerId: "owner-001",
  name: "Cool T-Shirt",
  description: "A stylish t-shirt",
  price: 29.99,
  priceCurrency: "THB",
  category: "basic" as const,
  stock: { M: 10, L: 5 },
  images: [{ url: "https://cdn.example.com/img.jpg", alt: "front", isPrimary: true, order: 0 }],
};

describe("ProductService.getActiveProducts", () => {
  test("1. success → returns paginated result from repository", async () => {
    const expected = { items: [{ id: "prod-1" }], total: 1, page: 1, perPage: 20 };
    const { service } = makeService({
      findActiveFiltered: mock(async () =>
        Ok(expected as unknown as PaginatedResult<ProductSummary>)
      ),
    });

    const result = await service.getActiveProducts({ page: 1, perPage: 20 }, {});

    expect(result as unknown).toEqual(expected);
  });

  test("2. repository error → throws (presentDomainError)", async () => {
    const { service } = makeService({
      findActiveFiltered: mock(async () =>
        Err({ _tag: "RepositoryError" as const, message: "DB failure" })
      ),
    });

    await expect(service.getActiveProducts({ page: 1, perPage: 20 }, {})).rejects.toThrow();
  });

  test("3. passes filter and pagination to repository", async () => {
    const { service, productRepo } = makeService();

    await service.getActiveProducts(
      { page: 2, perPage: 10 },
      { category: "premium", minPrice: 1000 }
    );

    expect((productRepo.findActiveFiltered as ReturnType<typeof mock>).mock.calls[0]?.[0]).toEqual({
      page: 2,
      perPage: 10,
    });
    expect(
      (productRepo.findActiveFiltered as ReturnType<typeof mock>).mock.calls[0]?.[1]
    ).toMatchObject({ category: "premium", minPrice: 1000 });
  });
});

describe("ProductService.getProduct", () => {
  test("4. success → returns product", async () => {
    const { service } = makeService({ findById: mock(async () => Ok(MOCK_PRODUCT)) });

    const result = await service.getProduct(PRODUCT_ID);

    expect(result).toEqual(MOCK_PRODUCT);
  });

  test("5. product not found → throws 404", async () => {
    const { service } = makeService({
      findById: mock(async () =>
        Err({ _tag: "ProductNotFoundError" as const, message: "Product not found" })
      ),
    });

    await expect(service.getProduct(PRODUCT_ID)).rejects.toThrow();
  });

  test("6. repository error → throws 500", async () => {
    const { service } = makeService({
      findById: mock(async () => Err({ _tag: "RepositoryError" as const, message: "DB error" })),
    });

    await expect(service.getProduct(PRODUCT_ID)).rejects.toThrow();
  });
});

describe("ProductService.createProduct", () => {
  test("7. valid input → returns created product", async () => {
    const { service } = makeService({ create: mock(async () => Ok(MOCK_PRODUCT)) });

    const result = await service.createProduct(VALID_CREATE_INPUT);

    expect(result).toEqual(MOCK_PRODUCT);
  });

  test("8. empty name → throws ValidationError (via makeProductName)", async () => {
    const { service } = makeService();

    await expect(service.createProduct({ ...VALID_CREATE_INPUT, name: "" })).rejects.toThrow();
  });

  test("9. empty images array → throws ValidationError", async () => {
    const { service } = makeService();

    await expect(service.createProduct({ ...VALID_CREATE_INPUT, images: [] })).rejects.toThrow();
  });

  test("10. invalid image URL (empty) → throws ValidationError", async () => {
    const { service } = makeService();

    await expect(
      service.createProduct({
        ...VALID_CREATE_INPUT,
        images: [{ url: "", alt: "alt", isPrimary: true, order: 0 }],
      })
    ).rejects.toThrow();
  });

  test("11. repository create error → throws", async () => {
    const { service } = makeService({
      create: mock(async () => Err({ _tag: "RepositoryError" as const, message: "write failed" })),
    });

    await expect(service.createProduct(VALID_CREATE_INPUT)).rejects.toThrow();
  });

  test("12. publishes ProductCreated event (fire-and-forget)", async () => {
    const publisher = makeEventPublisher();
    const { service } = makeService({ create: mock(async () => Ok(MOCK_PRODUCT)) }, publisher);

    await service.createProduct(VALID_CREATE_INPUT);

    await new Promise((r) => setTimeout(r, 0));

    expect((publisher.publish as ReturnType<typeof mock>).mock.calls.length).toBe(1);
    const event = (publisher.publish as ReturnType<typeof mock>).mock.calls[0]?.[0];
    expect(event.event_type).toBe("ProductCreated");
    expect(event.schema_version).toBe(1);
  });

  test("13. records activity log (fire-and-forget)", async () => {
    const activity = makeActivityRepo();
    const { service } = makeService(
      { create: mock(async () => Ok(MOCK_PRODUCT)) },
      undefined,
      activity
    );

    await service.createProduct(VALID_CREATE_INPUT);

    await new Promise((r) => setTimeout(r, 0));

    expect((activity.track as ReturnType<typeof mock>).mock.calls.length).toBe(1);
    const tracked = (activity.track as ReturnType<typeof mock>).mock.calls[0]?.[0];
    expect(tracked.eventType).toBe("product_created");
  });
});

describe("ProductService.updateProduct", () => {
  test("14. admin caller → skips owner check, saves updated product", async () => {
    const { service } = makeService({
      findById: mock(async () => Ok(MOCK_PRODUCT)),
      save: mock(async () => Ok({ ...MOCK_PRODUCT, description: "Updated" })),
    });

    const result = await service.updateProduct(
      PRODUCT_ID,
      { description: "Updated" },
      "different-admin",
      "admin"
    );

    expect(result).toMatchObject({ description: "Updated" });
  });

  test("15. store_owner caller with matching ownerId → succeeds", async () => {
    const { service } = makeService({
      findById: mock(async () => Ok(MOCK_PRODUCT)),
      save: mock(async () => Ok(MOCK_PRODUCT)),
    });

    const result = await service.updateProduct(
      PRODUCT_ID,
      { description: "My update" },
      "owner-001",
      "store_owner"
    );

    expect(result).toEqual(MOCK_PRODUCT);
  });

  test("16. store_owner caller with different ownerId → throws ForbiddenError", async () => {
    const { service } = makeService({
      findById: mock(async () => Ok(MOCK_PRODUCT)),
    });

    await expect(
      service.updateProduct(PRODUCT_ID, { name: "Hacked" }, "different-owner", "store_owner")
    ).rejects.toThrow();
  });

  test("17. product not found during update → throws", async () => {
    const { service } = makeService({
      findById: mock(async () =>
        Err({ _tag: "ProductNotFoundError" as const, message: "not found" })
      ),
    });

    await expect(service.updateProduct(PRODUCT_ID, { name: "x" })).rejects.toThrow();
  });

  test("18. save error → throws", async () => {
    const { service } = makeService({
      findById: mock(async () => Ok(MOCK_PRODUCT)),
      save: mock(async () => Err({ _tag: "RepositoryError" as const, message: "write failed" })),
    });

    await expect(service.updateProduct(PRODUCT_ID, { description: "x" })).rejects.toThrow();
  });

  test("19. name update: valid new name → applied", async () => {
    let savedProduct: Product | undefined;
    const { service } = makeService({
      findById: mock(async () => Ok(MOCK_PRODUCT)),
      save: mock(async (p: Product) => {
        savedProduct = p;
        return Ok(p);
      }),
    });

    await service.updateProduct(PRODUCT_ID, { name: "New Name" });

    expect(savedProduct?.name.value).toBe("New Name");
  });

  test("20. publishes ProductUpdated event (fire-and-forget)", async () => {
    const publisher = makeEventPublisher();
    const { service } = makeService(
      {
        findById: mock(async () => Ok(MOCK_PRODUCT)),
        save: mock(async () => Ok(MOCK_PRODUCT)),
      },
      publisher
    );

    await service.updateProduct(PRODUCT_ID, { description: "Updated" });
    await new Promise((r) => setTimeout(r, 0));

    expect((publisher.publish as ReturnType<typeof mock>).mock.calls.length).toBe(1);
    expect((publisher.publish as ReturnType<typeof mock>).mock.calls[0]?.[0].event_type).toBe(
      "ProductUpdated"
    );
  });
});

describe("ProductService.deleteProduct", () => {
  test("21. success → returns { deleted: true }", async () => {
    const { service } = makeService({
      findById: mock(async () => Ok(MOCK_PRODUCT)),
      delete: mock(async () => Ok({ _tag: "Deleted" as const })),
    });

    const result = await service.deleteProduct(PRODUCT_ID, "admin-001");

    expect(result).toEqual({ deleted: true });
  });

  test("22. product not found → throws", async () => {
    const { service } = makeService({
      findById: mock(async () =>
        Err({ _tag: "ProductNotFoundError" as const, message: "not found" })
      ),
    });

    await expect(service.deleteProduct(PRODUCT_ID)).rejects.toThrow();
  });

  test("23. delete repository error → throws", async () => {
    const { service } = makeService({
      findById: mock(async () => Ok(MOCK_PRODUCT)),
      delete: mock(async () => Err({ _tag: "RepositoryError" as const, message: "delete failed" })),
    });

    await expect(service.deleteProduct(PRODUCT_ID)).rejects.toThrow();
  });

  test("24. publishes ProductArchived event (fire-and-forget)", async () => {
    const publisher = makeEventPublisher();
    const { service } = makeService(
      {
        findById: mock(async () => Ok(MOCK_PRODUCT)),
        delete: mock(async () => Ok({ _tag: "Deleted" as const })),
      },
      publisher
    );

    await service.deleteProduct(PRODUCT_ID, "admin-001");
    await new Promise((r) => setTimeout(r, 0));

    const call = (publisher.publish as ReturnType<typeof mock>).mock.calls[0];
    expect(call?.[0].event_type).toBe("ProductArchived");
    expect(call?.[0].aggregate_id).toBe(PRODUCT_ID.value);
  });

  test("25. records product_deleted activity (fire-and-forget)", async () => {
    const activity = makeActivityRepo();
    const { service } = makeService(
      {
        findById: mock(async () => Ok(MOCK_PRODUCT)),
        delete: mock(async () => Ok({ _tag: "Deleted" as const })),
      },
      undefined,
      activity
    );

    await service.deleteProduct(PRODUCT_ID, "admin-001");
    await new Promise((r) => setTimeout(r, 0));

    expect((activity.track as ReturnType<typeof mock>).mock.calls[0]?.[0].eventType).toBe(
      "product_deleted"
    );
  });
});
