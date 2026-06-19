import { describe, expect, mock, test } from "bun:test";
import { createSecretKey } from "node:crypto";
import { Err, None, Ok, Some } from "@fabric/types";
import { Hono } from "hono";
import { V3 } from "paseto";
import type { MerchantRepositoryPort } from "../../application/ports/merchant.repository.port";
import type { Merchant } from "../../domain/billing/billing.value-objects";
import { registerProductRoutes } from "./product.handlers";
import type { ProductService } from "./product.service";

const TEST_KEY_HEX = "a".repeat(64);
process.env.PASETO_KEY = TEST_KEY_HEX;

import { PasetoVerifierService } from "../../infrastructure/auth/paseto-verifier.service";

const secretKey = createSecretKey(Buffer.from(TEST_KEY_HEX, "hex"));

async function issueToken(
  sub: string,
  role: "admin" | "store_owner" | "customer",
  email = "user@test.com"
): Promise<string> {
  return V3.encrypt({ sub, email, role }, secretKey, { expiresIn: "15 minutes" });
}

async function authHeader(
  sub: string,
  role: "admin" | "store_owner" | "customer"
): Promise<string> {
  return `Bearer ${await issueToken(sub, role)}`;
}

const MOCK_TIMESTAMP = { toString: () => "2024-01-01T00:00:00Z" };

const MOCK_PRODUCT = {
  id: { value: "prod-123" },
  ownerId: "owner-001",
  name: { value: "Test T-Shirt" },
  description: "A test shirt",
  price: { amount: 29.99, currency: "THB" },
  category: "basic",
  status: "active",
  stock: {},
  images: [],
  createdAt: MOCK_TIMESTAMP,
  updatedAt: MOCK_TIMESTAMP,
};

const MOCK_PAGINATED = {
  items: [MOCK_PRODUCT],
  total: 1,
  page: 1,
  perPage: 20,
};

const MERCHANT_ACTIVE: Merchant = {
  userId: "owner-001",
  storeName: "Test Store",
  email: "owner@test.com",
  plan: "starter",
  planStatus: "active",
  stripeCustomerId: Some("cus_test"),
  stripeSubscriptionId: Some("sub_test"),
  productCount: 0,
  completedOrderCount: 0,
  totalRevenueCents: 0,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
  planExpiresAt: None<string>(),
  storeSlug: None<string>(),
};

function makeProductService(overrides: Partial<ProductService> = {}): ProductService {
  return {
    getActiveProducts: mock(async () => MOCK_PAGINATED),
    getProduct: mock(async () => MOCK_PRODUCT),
    createProduct: mock(async () => ({ ...MOCK_PRODUCT, id: { value: "new-prod" } })),
    updateProduct: mock(async () => MOCK_PRODUCT),
    deleteProduct: mock(async () => ({ deleted: true })),
    ...overrides,
  } as unknown as ProductService;
}

function makeMerchantRepo(overrides: Partial<MerchantRepositoryPort> = {}): MerchantRepositoryPort {
  return {
    findByUserId: mock(async () => Ok(MERCHANT_ACTIVE)),
    save: mock(async () => Ok(MERCHANT_ACTIVE)),
    create: mock(async () => Ok(MERCHANT_ACTIVE)),
    incrementProductCount: mock(async () => Ok(undefined)),
    decrementProductCount: mock(async () => Ok(undefined)),
    updatePlan: mock(async () => Ok(undefined)),
    ...overrides,
  } as unknown as MerchantRepositoryPort;
}

function makeApp(
  serviceOverrides: Partial<ProductService> = {},
  merchantOverrides: Partial<MerchantRepositoryPort> = {}
): {
  app: Hono;
  verifier: PasetoVerifierService;
  service: ProductService;
  merchantRepo: MerchantRepositoryPort;
} {
  const app = new Hono();
  const verifier = new PasetoVerifierService();
  const service = makeProductService(serviceOverrides);
  const merchantRepo = makeMerchantRepo(merchantOverrides);

  registerProductRoutes(app, service, verifier, merchantRepo);

  return { app, verifier, service, merchantRepo };
}

describe("GET /api/products — public listing", () => {
  test("1. returns paginated product list without auth", async () => {
    const { app } = makeApp();

    const res = await app.fetch(new Request("http://localhost/api/products"));
    const body = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(200);
    expect(body.items).toBeDefined();
    expect(body.total).toBe(1);
  });

  test("2. passes page + perPage query params to service", async () => {
    const { app, service } = makeApp();

    await app.fetch(new Request("http://localhost/api/products?page=2&perPage=5"));

    const call = (service.getActiveProducts as ReturnType<typeof mock>).mock.calls[0];
    expect(call?.[0].page).toBe(2);
    expect(call?.[0].perPage).toBe(5);
  });

  test("3. passes category filter to service", async () => {
    const { app, service } = makeApp();

    await app.fetch(new Request("http://localhost/api/products?category=premium"));

    const call = (service.getActiveProducts as ReturnType<typeof mock>).mock.calls[0];
    expect(call?.[1].category).toBe("premium");
  });

  test("4. caps perPage at 100", async () => {
    const { app, service } = makeApp();

    await app.fetch(new Request("http://localhost/api/products?perPage=9999"));

    const call = (service.getActiveProducts as ReturnType<typeof mock>).mock.calls[0];
    expect(call?.[0].perPage).toBe(100);
  });
});

describe("GET /api/products/:id — public detail", () => {
  test("5. returns product without auth", async () => {
    const { app } = makeApp();

    const res = await app.fetch(new Request("http://localhost/api/products/prod-123"));
    const body = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(200);
    expect(body.name).toBe("Test T-Shirt");
  });

  test("6. passes product ID to service", async () => {
    const { app, service } = makeApp();

    await app.fetch(new Request("http://localhost/api/products/my-product-id"));

    const call = (service.getProduct as ReturnType<typeof mock>).mock.calls[0];
    expect(call?.[0].value).toBe("my-product-id");
  });
});

const VALID_BODY = {
  name: "New T-Shirt",
  price: 29.99,
  category: "basic",
  stock: { M: 10 },
  images: [{ url: "https://cdn.example.com/img.jpg", alt: "front", isPrimary: true, order: 0 }],
};

describe("POST /api/products — auth and validation", () => {
  test("7. no auth → 401", async () => {
    const { app } = makeApp();

    const res = await app.fetch(
      new Request("http://localhost/api/products", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(VALID_BODY),
      })
    );

    expect(res.status).toBe(401);
  });

  test("8. customer role → 403", async () => {
    const { app } = makeApp();

    const res = await app.fetch(
      new Request("http://localhost/api/products", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: await authHeader("user-1", "customer"),
        },
        body: JSON.stringify(VALID_BODY),
      })
    );

    expect(res.status).toBe(403);
  });

  test("9. invalid body (missing name) → 400", async () => {
    const { app } = makeApp();

    const res = await app.fetch(
      new Request("http://localhost/api/products", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: await authHeader("admin-1", "admin"),
        },
        body: JSON.stringify({ priceInCents: 2999, category: "basic", stock: {}, images: [] }),
      })
    );

    expect(res.status).toBe(400);
  });

  test("10. invalid body (price = 0) → 400", async () => {
    const { app } = makeApp();

    const res = await app.fetch(
      new Request("http://localhost/api/products", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: await authHeader("admin-1", "admin"),
        },
        body: JSON.stringify({ ...VALID_BODY, price: 0 }),
      })
    );

    expect(res.status).toBe(400);
  });

  test("11. admin → 201 created (no plan check)", async () => {
    const { app } = makeApp();

    const res = await app.fetch(
      new Request("http://localhost/api/products", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: await authHeader("admin-1", "admin"),
        },
        body: JSON.stringify(VALID_BODY),
      })
    );

    expect(res.status).toBe(201);
  });

  test("12. store_owner with active plan + capacity → 201", async () => {
    const { app } = makeApp({}, { findByUserId: mock(async () => Ok(MERCHANT_ACTIVE)) });

    const res = await app.fetch(
      new Request("http://localhost/api/products", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: await authHeader("owner-001", "store_owner"),
        },
        body: JSON.stringify(VALID_BODY),
      })
    );

    expect(res.status).toBe(201);
  });

  test("13. store_owner: merchant not found → 402", async () => {
    const { app } = makeApp(
      {},
      {
        findByUserId: mock(async () =>
          Err({ _tag: "MerchantNotFoundError" as const, userId: "owner-001", message: "not found" })
        ),
      }
    );

    const res = await app.fetch(
      new Request("http://localhost/api/products", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: await authHeader("owner-001", "store_owner"),
        },
        body: JSON.stringify(VALID_BODY),
      })
    );

    expect(res.status).toBe(402);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body._tag).toBe("MerchantNotFound");
  });

  test("14. store_owner: subscription inactive (past_due) → 402", async () => {
    const { app } = makeApp(
      {},
      {
        findByUserId: mock(async () =>
          Ok({
            ...MERCHANT_ACTIVE,
            planStatus: "past_due",
          } as Merchant)
        ),
      }
    );

    const res = await app.fetch(
      new Request("http://localhost/api/products", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: await authHeader("owner-001", "store_owner"),
        },
        body: JSON.stringify(VALID_BODY),
      })
    );

    expect(res.status).toBe(402);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body._tag).toBe("SubscriptionInactive");
  });

  test("15. store_owner: product limit reached → 402", async () => {
    const { app } = makeApp(
      {},
      {
        findByUserId: mock(async () =>
          Ok({
            ...MERCHANT_ACTIVE,
            plan: "free",
            productCount: 5,
          } as Merchant)
        ),
      }
    );

    const res = await app.fetch(
      new Request("http://localhost/api/products", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: await authHeader("owner-001", "store_owner"),
        },
        body: JSON.stringify(VALID_BODY),
      })
    );

    expect(res.status).toBe(402);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body._tag).toBe("PlanLimitExceeded");
  });

  test("16. store_owner create → increments product count (fire-and-forget)", async () => {
    const { app, merchantRepo } = makeApp();

    await app.fetch(
      new Request("http://localhost/api/products", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: await authHeader("owner-001", "store_owner"),
        },
        body: JSON.stringify(VALID_BODY),
      })
    );

    await new Promise((r) => setTimeout(r, 0));
    expect((merchantRepo.incrementProductCount as ReturnType<typeof mock>).mock.calls.length).toBe(
      1
    );
  });
});

describe("PUT /api/products/:id — update", () => {
  test("17. no auth → 401", async () => {
    const { app } = makeApp();

    const res = await app.fetch(
      new Request("http://localhost/api/products/prod-123", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Updated" }),
      })
    );

    expect(res.status).toBe(401);
  });

  test("18. customer role → 403", async () => {
    const { app } = makeApp();

    const res = await app.fetch(
      new Request("http://localhost/api/products/prod-123", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          authorization: await authHeader("user-1", "customer"),
        },
        body: JSON.stringify({ name: "Updated" }),
      })
    );

    expect(res.status).toBe(403);
  });

  test("19. invalid body (price = 0) → 400", async () => {
    const { app } = makeApp();

    const res = await app.fetch(
      new Request("http://localhost/api/products/prod-123", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          authorization: await authHeader("admin-1", "admin"),
        },
        body: JSON.stringify({ price: 0 }),
      })
    );

    expect(res.status).toBe(400);
  });

  test("20. admin → 200", async () => {
    const { app } = makeApp();

    const res = await app.fetch(
      new Request("http://localhost/api/products/prod-123", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          authorization: await authHeader("admin-1", "admin"),
        },
        body: JSON.stringify({ name: "Updated Name" }),
      })
    );

    expect(res.status).toBe(200);
  });

  test("21. store_owner → 200 (owner check done in service layer)", async () => {
    const { app } = makeApp();

    const res = await app.fetch(
      new Request("http://localhost/api/products/prod-123", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          authorization: await authHeader("owner-001", "store_owner"),
        },
        body: JSON.stringify({ name: "My Update" }),
      })
    );

    expect(res.status).toBe(200);
  });

  test("22. passes userId and role to service.updateProduct", async () => {
    const { app, service } = makeApp();

    await app.fetch(
      new Request("http://localhost/api/products/prod-456", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          authorization: await authHeader("owner-999", "store_owner"),
        },
        body: JSON.stringify({ description: "Updated description" }),
      })
    );

    const call = (service.updateProduct as ReturnType<typeof mock>).mock.calls[0];
    expect(call?.[2]).toBe("owner-999");
    expect(call?.[3]).toBe("store_owner");
  });
});

describe("DELETE /api/products/:id — admin only", () => {
  test("23. no auth → 401", async () => {
    const { app } = makeApp();

    const res = await app.fetch(
      new Request("http://localhost/api/products/prod-123", { method: "DELETE" })
    );

    expect(res.status).toBe(401);
  });

  test("24. store_owner role → 403", async () => {
    const { app } = makeApp();

    const res = await app.fetch(
      new Request("http://localhost/api/products/prod-123", {
        method: "DELETE",
        headers: { authorization: await authHeader("owner-1", "store_owner") },
      })
    );

    expect(res.status).toBe(403);
  });

  test("25. admin → 200, returns { deleted: true }", async () => {
    const { app } = makeApp();

    const res = await app.fetch(
      new Request("http://localhost/api/products/prod-123", {
        method: "DELETE",
        headers: { authorization: await authHeader("admin-1", "admin") },
      })
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.deleted).toBe(true);
  });

  test("26. passes product ID to service", async () => {
    const { app, service } = makeApp();

    await app.fetch(
      new Request("http://localhost/api/products/the-product-id", {
        method: "DELETE",
        headers: { authorization: await authHeader("admin-1", "admin") },
      })
    );

    const call = (service.deleteProduct as ReturnType<typeof mock>).mock.calls[0];
    expect(call?.[0].value).toBe("the-product-id");
  });
});
