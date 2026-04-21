import { describe, expect, mock, test } from "bun:test";
import { createSecretKey } from "node:crypto";
import type { MemcachedAdapter } from "@fabric/cache";
import { Err, Ok } from "@fabric/types";
import { Hono } from "hono";
import { V3 } from "paseto";
import type { FirebaseActivityRepository } from "../../infrastructure/firebase/firebase-activity.repository";
import type { FirebaseLockoutAdapter } from "../../infrastructure/firebase/firebase-lockout.adapter";
import type { FirebaseTokenRepository } from "../../infrastructure/firebase/firebase-token.repository";
import type { FirebaseUserAdapter } from "../../infrastructure/firebase/firebase-user.adapter";
import { type AuthConfig, registerAuthRoutes } from "./auth.handlers";

const TEST_KEY_HEX = "a".repeat(64);
process.env.PASETO_KEY = TEST_KEY_HEX;

import { PasetoVerifierService } from "../../infrastructure/auth/paseto-verifier.service";

const secretKey = createSecretKey(Buffer.from(TEST_KEY_HEX, "hex"));

async function issueRefreshToken(
  sub: string,
  role = "customer",
  family = "family-001",
  jti = "jti-001",
  ttlSeconds = 604800
): Promise<string> {
  return V3.encrypt({ sub, email: `${sub}@example.com`, role, jti, fam: family }, secretKey, {
    expiresIn: `${ttlSeconds} seconds`,
  });
}

async function issueExpiredRefreshToken(sub = "user-001"): Promise<string> {
  return V3.encrypt(
    { sub, email: `${sub}@example.com`, role: "customer", jti: "expired-jti", fam: "fam-expired" },
    secretKey,
    { expiresIn: "1 second" }
  );
}

const STORED_ACTIVE_TOKEN = {
  revokedAt: { _tag: "None" as const },
};

const STORED_REVOKED_TOKEN = {
  revokedAt: { _tag: "Some" as const, value: "2024-01-01T00:00:00Z" },
};

function makeUserAdapter(): FirebaseUserAdapter {
  return {
    findByEmail: mock(async () => Ok(null)),
    findById: mock(async () => Ok(null)),
    createUser: mock(async () => Ok(undefined)),
    softDeleteUser: mock(async () => Ok(undefined)),
  } as unknown as FirebaseUserAdapter;
}

function makeTokenRepo(overrides: Partial<FirebaseTokenRepository> = {}): FirebaseTokenRepository {
  return {
    save: mock(async () => Ok(undefined)),
    findByJti: mock(async () => Ok(STORED_ACTIVE_TOKEN)),
    revokeFamily: mock(async () => Ok(undefined)),
    isBlacklisted: mock(async () => false),
    blacklist: mock(async () => Ok(undefined)),
    ...overrides,
  } as unknown as FirebaseTokenRepository;
}

function makeLockoutAdapter(): FirebaseLockoutAdapter {
  return {
    isLocked: mock(async () => 0),
    recordAttempt: mock(async () => Ok(undefined)),
    reset: mock(async () => Ok(undefined)),
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

const TEST_AUTH_CONFIG: AuthConfig = {
  pasetoKey: TEST_KEY_HEX,
  accessTokenTtlSeconds: 900,
  refreshTokenTtlSeconds: 604800,
  bcryptRounds: 4,
  googleClientId: "",
};

function makeApp(tokenOverrides: Partial<FirebaseTokenRepository> = {}): {
  app: Hono;
  tokenRepo: FirebaseTokenRepository;
} {
  const app = new Hono();
  const verifier = new PasetoVerifierService(process.env.PASETO_KEY as string);
  const userAdapter = makeUserAdapter();
  const tokenRepo = makeTokenRepo(tokenOverrides);
  const lockoutStore = makeLockoutAdapter();
  const activityRepo = makeActivityRepo();

  registerAuthRoutes(
    app,
    userAdapter,
    tokenRepo,
    lockoutStore,
    verifier,
    activityRepo,
    makeMemcached(),
    TEST_AUTH_CONFIG
  );
  return { app, tokenRepo };
}

async function postRefresh(app: Hono, refreshToken: string): Promise<Response> {
  return app.fetch(
    new Request("http://localhost/auth/refresh", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    })
  );
}

describe("POST /auth/refresh — token rotation", () => {
  test("1. valid refresh token → 200 with new accessToken + refreshToken", async () => {
    const { app } = makeApp();
    const token = await issueRefreshToken("user-001");

    const res = await postRefresh(app, token);

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(typeof body.accessToken).toBe("string");
    expect(typeof body.refreshToken).toBe("string");
    expect(body.refreshToken).not.toBe(token);
  });

  test("2. new tokens are valid PASETO tokens", async () => {
    const { app } = makeApp();
    const verifier = new PasetoVerifierService(process.env.PASETO_KEY as string);
    const token = await issueRefreshToken("user-123");

    const res = await postRefresh(app, token);
    const body = (await res.json()) as Record<string, unknown>;

    const accessVerify = await verifier.verify(body.accessToken as string);
    expect(accessVerify._tag).toBe("Ok");
    if (accessVerify._tag === "Ok") {
      expect(accessVerify.value.sub).toBe("user-123");
      expect(accessVerify.value.role).toBe("customer");
    }
  });

  test("3. rotation calls revokeFamily on old token family", async () => {
    const { app, tokenRepo } = makeApp();
    const token = await issueRefreshToken("user-001", "customer", "family-xyz");

    await postRefresh(app, token);

    expect(
      (tokenRepo.revokeFamily as ReturnType<typeof mock>).mock.calls.length
    ).toBeGreaterThanOrEqual(1);
    const revokedFamily = ((tokenRepo.revokeFamily as ReturnType<typeof mock>).mock.calls.at(0) ??
      [])[0];
    expect(revokedFamily).toBe("family-xyz");
  });

  test("4. rotation calls blacklist on old jti", async () => {
    const { app, tokenRepo } = makeApp();
    const token = await issueRefreshToken("user-001", "customer", "family-001", "jti-to-blacklist");

    await postRefresh(app, token);

    expect(
      (tokenRepo.blacklist as ReturnType<typeof mock>).mock.calls.length
    ).toBeGreaterThanOrEqual(1);
    const blacklistedJti = ((tokenRepo.blacklist as ReturnType<typeof mock>).mock.calls.at(0) ??
      [])[0];
    expect(blacklistedJti).toBe("jti-to-blacklist");
  });

  test("5. new tokens are saved to tokenRepo", async () => {
    const { app, tokenRepo } = makeApp();
    const token = await issueRefreshToken("user-001");

    await postRefresh(app, token);

    expect((tokenRepo.save as ReturnType<typeof mock>).mock.calls.length).toBeGreaterThanOrEqual(1);
  });
});

describe("POST /auth/refresh — token theft detection", () => {
  test("6. blacklisted token (replayed) → 401 + full family revocation", async () => {
    const { app, tokenRepo } = makeApp({
      isBlacklisted: mock(async () => true),
    });
    const token = await issueRefreshToken("user-001", "customer", "stolen-family");

    const res = await postRefresh(app, token);

    expect(res.status).toBe(401);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBeDefined();

    const revokeCalls = (tokenRepo.revokeFamily as ReturnType<typeof mock>).mock.calls;
    expect(revokeCalls.length).toBeGreaterThanOrEqual(1);
    expect(revokeCalls.some((call) => call[0] === "stolen-family")).toBe(true);
  });

  test("7. revoked token (already used) → 401 + family revoked", async () => {
    const { app, tokenRepo } = makeApp({
      isBlacklisted: mock(async () => false),
      findByJti: mock(async () =>
        Ok(
          STORED_REVOKED_TOKEN as unknown as import(
            "../../infrastructure/firebase/firebase-token.repository"
          ).StoredRefreshToken
        )
      ),
    });
    const token = await issueRefreshToken("user-001", "customer", "revoked-family");

    const res = await postRefresh(app, token);

    expect(res.status).toBe(401);

    const revokeCalls = (tokenRepo.revokeFamily as ReturnType<typeof mock>).mock.calls;
    expect(revokeCalls.some((call) => call[0] === "revoked-family")).toBe(true);
  });

  test("8. token not found in repo → 401", async () => {
    const { app } = makeApp({
      isBlacklisted: mock(async () => false),
      findByJti: mock(async () => Ok(null)),
    });
    const token = await issueRefreshToken("user-001");

    const res = await postRefresh(app, token);

    expect(res.status).toBe(401);
  });
});

describe("POST /auth/refresh — input validation", () => {
  test("9. missing refreshToken field → 400", async () => {
    const { app } = makeApp();

    const res = await app.fetch(
      new Request("http://localhost/auth/refresh", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      })
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBeDefined();
  });

  test("10. non-JSON body → 400", async () => {
    const { app } = makeApp();

    const res = await app.fetch(
      new Request("http://localhost/auth/refresh", {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: "not-json",
      })
    );

    expect(res.status).toBe(400);
  });

  test("11. forged / tampered PASETO token → 401", async () => {
    const { app } = makeApp();
    const forgery = `v3.local.${Buffer.from("tampered-garbage-refresh").toString("base64url")}`;

    const res = await postRefresh(app, forgery);

    expect(res.status).toBe(401);
  });

  test("12. expired refresh token → 401", async () => {
    const { app } = makeApp();
    const expired = await issueExpiredRefreshToken();
    await new Promise((r) => setTimeout(r, 1100));

    const res = await postRefresh(app, expired);

    expect(res.status).toBe(401);
  });

  test("13. refreshToken is not a string → 400", async () => {
    const { app } = makeApp();

    const res = await app.fetch(
      new Request("http://localhost/auth/refresh", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refreshToken: 42 }),
      })
    );

    expect(res.status).toBe(400);
  });
});

describe("POST /auth/refresh — repository error handling", () => {
  test("14. tokenRepo.findByJti returns Err → 401", async () => {
    const { app } = makeApp({
      isBlacklisted: mock(async () => false),
      findByJti: mock(async () => Err({ _tag: "RepositoryError" as const, message: "DB error" })),
    });
    const token = await issueRefreshToken("user-001");

    const res = await postRefresh(app, token);

    expect(res.status).toBe(401);
  });
});
