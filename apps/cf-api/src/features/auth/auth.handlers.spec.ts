import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { createSecretKey } from "node:crypto";
import type { MemcachedAdapter } from "@fabric/cache";
import { Err, Ok } from "@fabric/types";
import { Hono } from "hono";
import { V3 } from "paseto";
import type { FirebaseActivityRepository } from "../../infrastructure/firebase/firebase-activity.repository";
import type { FirebaseLockoutAdapter } from "../../infrastructure/firebase/firebase-lockout.adapter";
import type { FirebaseTokenRepository } from "../../infrastructure/firebase/firebase-token.repository";
import type {
  AuthUser,
  FirebaseUserAdapter,
} from "../../infrastructure/firebase/firebase-user.adapter";
import { registerAuthRoutes } from "./auth.handlers";

const TEST_KEY_HEX = "a".repeat(64);
process.env.PASETO_KEY = TEST_KEY_HEX;

import { PasetoVerifierService } from "../../infrastructure/auth/paseto-verifier.service";

const secretKey = createSecretKey(Buffer.from(TEST_KEY_HEX, "hex"));

async function issueToken(sub: string, role: string, jti = "jti-test-001"): Promise<string> {
  return V3.encrypt({ sub, email: `${sub}@example.com`, role, jti }, secretKey, {
    expiresIn: "15 minutes",
  });
}

const MOCK_USER = {
  id: { value: "user-001" },
  email: { value: "alice@example.com" },
  role: "customer" as const,
  passwordHash: { _tag: "Some" as const, value: "$argon2id$v=19$..." },
  displayName: "Alice",
};

function makeUserAdapter(overrides: Partial<FirebaseUserAdapter> = {}): FirebaseUserAdapter {
  return {
    findByEmail: mock(async () => Ok(MOCK_USER as unknown as AuthUser)),
    findById: mock(async () => Ok(MOCK_USER as unknown as AuthUser)),
    createUser: mock(async () => Ok(undefined)),
    softDeleteUser: mock(async () => Ok(undefined)),
    ...overrides,
  } as unknown as FirebaseUserAdapter;
}

function makeTokenRepo(overrides: Partial<FirebaseTokenRepository> = {}): FirebaseTokenRepository {
  return {
    save: mock(async () => Ok(undefined)),
    findByJti: mock(async () => Ok({ revokedAt: { _tag: "None" as const } })),
    revokeFamily: mock(async () => Ok(undefined)),
    isBlacklisted: mock(async () => false),
    blacklist: mock(async () => Ok(undefined)),
    ...overrides,
  } as unknown as FirebaseTokenRepository;
}

function makeLockoutAdapter(
  overrides: Partial<FirebaseLockoutAdapter> = {}
): FirebaseLockoutAdapter {
  return {
    isLocked: mock(async () => 0),
    recordAttempt: mock(async () => Ok(undefined)),
    reset: mock(async () => Ok(undefined)),
    ...overrides,
  } as unknown as FirebaseLockoutAdapter;
}

function makeActivityRepo(): FirebaseActivityRepository {
  return {
    track: mock(async () => Ok(undefined)),
  } as unknown as FirebaseActivityRepository;
}

function makeMemcached(): MemcachedAdapter {
  return {
    increment: mock(async () => 1),
    get: mock(async () => null),
    set: mock(async () => undefined),
    del: mock(async () => undefined),
    getOrSet: mock(async (_key: string, fetcher: () => Promise<unknown>) => fetcher()),
    delMulti: mock(async () => undefined),
    end: mock(() => undefined),
  } as unknown as MemcachedAdapter;
}

function makeApp(
  userOverrides: Partial<FirebaseUserAdapter> = {},
  tokenOverrides: Partial<FirebaseTokenRepository> = {},
  lockoutOverrides: Partial<FirebaseLockoutAdapter> = {}
) {
  const app = new Hono();
  const verifier = new PasetoVerifierService();
  const userAdapter = makeUserAdapter(userOverrides);
  const tokenRepo = makeTokenRepo(tokenOverrides);
  const lockoutStore = makeLockoutAdapter(lockoutOverrides);
  const activityRepo = makeActivityRepo();

  registerAuthRoutes(
    app,
    userAdapter,
    tokenRepo,
    lockoutStore,
    verifier,
    activityRepo,
    makeMemcached()
  );
  return { app, userAdapter, tokenRepo, lockoutStore, activityRepo, verifier };
}

describe("POST /auth/login — email/password login", () => {
  test("1. missing email → 400 validation error", async () => {
    const { app } = makeApp();

    const res = await app.fetch(
      new Request("http://localhost/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: "secret123" }),
      })
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBeDefined();
  });

  test("2. missing password → 400 validation error", async () => {
    const { app } = makeApp();

    const res = await app.fetch(
      new Request("http://localhost/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "user@example.com" }),
      })
    );

    expect(res.status).toBe(400);
  });

  test("3. email too short (< 3 chars) → 400", async () => {
    const { app } = makeApp();

    const res = await app.fetch(
      new Request("http://localhost/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "a@", password: "pass" }),
      })
    );

    expect(res.status).toBe(400);
  });

  test("4. user not found → 401 (login use case returns Err)", async () => {
    const { app } = makeApp({
      findByEmail: mock(async () =>
        Err({ _tag: "RepositoryError" as const, message: "User not found" })
      ),
    });

    const res = await app.fetch(
      new Request("http://localhost/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "nobody@example.com", password: "wrongpass" }),
      })
    );

    expect(res.status).toBe(401);
  });
});

describe("POST /auth/register — customer registration", () => {
  test("5. valid registration → 201 { registered: true }", async () => {
    const { app } = makeApp({
      createUser: mock(async () => Ok(undefined)),
    });

    const res = await app.fetch(
      new Request("http://localhost/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "newuser@example.com",
          password: "strongpass123",
          displayName: "New User",
        }),
      })
    );

    expect(res.status).toBe(201);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.registered).toBe(true);
  });

  test("6. password too short (< 8 chars) → 400", async () => {
    const { app } = makeApp();

    const res = await app.fetch(
      new Request("http://localhost/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "user@example.com",
          password: "short",
          displayName: "User",
        }),
      })
    );

    expect(res.status).toBe(400);
  });

  test("7. missing displayName → 400", async () => {
    const { app } = makeApp();

    const res = await app.fetch(
      new Request("http://localhost/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "user@example.com", password: "strongpass123" }),
      })
    );

    expect(res.status).toBe(400);
  });

  test("8. duplicate email → 409", async () => {
    const { app } = makeApp({
      createUser: mock(async () =>
        Err({ _tag: "RepositoryError" as const, message: "Email already registered" })
      ),
    });

    const res = await app.fetch(
      new Request("http://localhost/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "existing@example.com",
          password: "strongpass123",
          displayName: "Existing User",
        }),
      })
    );

    expect(res.status).toBe(409);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toContain("already registered");
  });

  test('9. defaults role to "customer" when no role specified', async () => {
    let capturedInput: unknown;
    const { app } = makeApp({
      createUser: mock(async (input: unknown) => {
        capturedInput = input;
        return Ok(undefined);
      }),
    });

    await app.fetch(
      new Request("http://localhost/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "user@example.com",
          password: "strongpass123",
          displayName: "Test User",
        }),
      })
    );

    expect((capturedInput as { role: string }).role).toBe("customer");
  });

  test("10. store_owner role in register body → allowed (uses provided role)", async () => {
    let capturedInput: unknown;
    const { app } = makeApp({
      createUser: mock(async (input: unknown) => {
        capturedInput = input;
        return Ok(undefined);
      }),
    });

    const res = await app.fetch(
      new Request("http://localhost/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "store@example.com",
          password: "strongpass123",
          displayName: "Store Owner",
          role: "store_owner",
        }),
      })
    );

    expect(res.status).toBe(201);
    expect((capturedInput as { role: string }).role).toBe("store_owner");
  });
});

describe("POST /auth/register/store — store owner registration", () => {
  test("11. valid registration → 201 with role=store_owner (forced)", async () => {
    let capturedInput: unknown;
    const { app } = makeApp({
      createUser: mock(async (input: unknown) => {
        capturedInput = input;
        return Ok(undefined);
      }),
    });

    const res = await app.fetch(
      new Request("http://localhost/auth/register/store", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "newstore@example.com",
          password: "strongpass123",
          displayName: "Store Name",
        }),
      })
    );

    expect(res.status).toBe(201);
    expect((capturedInput as { role: string }).role).toBe("store_owner");
  });

  test("12. duplicate store email → 409", async () => {
    const { app } = makeApp({
      createUser: mock(async () =>
        Err({ _tag: "RepositoryError" as const, message: "Email already registered" })
      ),
    });

    const res = await app.fetch(
      new Request("http://localhost/auth/register/store", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "existing@example.com",
          password: "strongpass123",
          displayName: "Store",
        }),
      })
    );

    expect(res.status).toBe(409);
  });

  test("13. invalid body (short password) → 400", async () => {
    const { app } = makeApp();

    const res = await app.fetch(
      new Request("http://localhost/auth/register/store", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "store@example.com",
          password: "short",
          displayName: "My Store",
        }),
      })
    );

    expect(res.status).toBe(400);
  });
});

describe("POST /auth/logout", () => {
  test("14. valid auth token → 200 { loggedOut: true }", async () => {
    const token = await issueToken("user-001", "customer");
    const { app } = makeApp();

    const res = await app.fetch(
      new Request("http://localhost/auth/logout", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
      })
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.loggedOut).toBe(true);
  });

  test("15. no auth header → 401", async () => {
    const { app } = makeApp();

    const res = await app.fetch(new Request("http://localhost/auth/logout", { method: "POST" }));

    expect(res.status).toBe(401);
  });

  test("16. logout still returns 200 even when blacklist call is attempted (best-effort, no throw)", async () => {
    const token = await issueToken("user-001", "customer", "jti-to-blacklist");

    const { app } = makeApp(
      {},
      {
        blacklist: mock(async () => {
          throw new Error("cache unavailable");
        }),
      }
    );

    const res = await app.fetch(
      new Request("http://localhost/auth/logout", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
      })
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.loggedOut).toBe(true);
  });
});

let savedFetch: typeof globalThis.fetch;

describe("POST /auth/login/facebook — Facebook SSO", () => {
  beforeEach(() => {
    savedFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = savedFetch;
  });

  test("17. missing access_token body field → 400", async () => {
    const { app } = makeApp();

    const res = await app.fetch(
      new Request("http://localhost/auth/login/facebook", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      })
    );

    expect(res.status).toBe(400);
  });

  test("18. Facebook API returns error → 401", async () => {
    const { app } = makeApp();
    globalThis.fetch = mock(
      async () =>
        new Response(JSON.stringify({ error: { message: "Invalid OAuth access token." } }), {
          status: 400,
          headers: { "content-type": "application/json" },
        })
    ) as unknown as typeof globalThis.fetch;

    const res = await app.fetch(
      new Request("http://localhost/auth/login/facebook", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ access_token: "bad-fb-token" }),
      })
    );

    expect(res.status).toBe(401);
  });

  test("19. valid Facebook token → returns accessToken + refreshToken", async () => {
    const { app } = makeApp({
      findByEmail: mock(async () =>
        Ok({
          id: { value: "fb-user-001" },
          email: { value: "fb@example.com" },
          role: "customer" as const,
          passwordHash: { _tag: "None" as const },
        } as unknown as AuthUser)
      ),
    });
    globalThis.fetch = mock(
      async () =>
        new Response(JSON.stringify({ id: "fb-123", email: "fb@example.com", name: "FB User" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
    ) as unknown as typeof globalThis.fetch;

    const res = await app.fetch(
      new Request("http://localhost/auth/login/facebook", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ access_token: "valid-fb-token" }),
      })
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(typeof body.accessToken).toBe("string");
    expect(typeof body.refreshToken).toBe("string");
  });
});

describe("POST /auth/login/google — Google SSO", () => {
  beforeEach(() => {
    savedFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = savedFetch;
  });

  test("20. missing id_token body field → 400", async () => {
    const { app } = makeApp();

    const res = await app.fetch(
      new Request("http://localhost/auth/login/google", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      })
    );

    expect(res.status).toBe(400);
  });

  test("21. Google API returns error → 401", async () => {
    const { app } = makeApp();
    globalThis.fetch = mock(
      async () =>
        new Response(JSON.stringify({ error_description: "Invalid Value" }), {
          status: 400,
          headers: { "content-type": "application/json" },
        })
    ) as unknown as typeof globalThis.fetch;

    const res = await app.fetch(
      new Request("http://localhost/auth/login/google", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id_token: "bad-google-token" }),
      })
    );

    expect(res.status).toBe(401);
  });

  test("22. valid Google token → returns accessToken + refreshToken", async () => {
    const { app } = makeApp({
      findByEmail: mock(async () =>
        Ok({
          id: { value: "g-user-001" },
          email: { value: "guser@gmail.com" },
          role: "customer" as const,
          passwordHash: { _tag: "None" as const },
        } as unknown as AuthUser)
      ),
    });
    globalThis.fetch = mock(
      async () =>
        new Response(
          JSON.stringify({
            sub: "google-123",
            email: "guser@gmail.com",
            name: "Google User",
            email_verified: "true",
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          }
        )
    ) as unknown as typeof globalThis.fetch;

    const res = await app.fetch(
      new Request("http://localhost/auth/login/google", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id_token: "valid-google-token" }),
      })
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(typeof body.accessToken).toBe("string");
    expect(typeof body.refreshToken).toBe("string");
  });
});
