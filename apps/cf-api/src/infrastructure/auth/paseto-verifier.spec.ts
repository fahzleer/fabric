import { beforeAll, describe, expect, test } from "bun:test";
import { createSecretKey } from "node:crypto";
import type { AccessTokenPayload } from "@fabric/types";
import type { Context } from "hono";
import { V3 } from "paseto";

const TEST_KEY_HEX = "a".repeat(64);

process.env.PASETO_KEY = TEST_KEY_HEX;

import { requireAuth, requireRole } from "../guards/auth.middleware";
import { PasetoVerifierService } from "./paseto-verifier.service";

const key = createSecretKey(Buffer.from(TEST_KEY_HEX, "hex"));

async function issueToken(
  overrides: Partial<AccessTokenPayload> & Record<string, unknown> = {},
  expiresInSeconds = 900
): Promise<string> {
  const payload = {
    sub: "user-001",
    email: "alice@example.com",
    role: "customer",
    ...overrides,
  } as unknown as Record<PropertyKey, unknown>;
  return V3.encrypt(payload, key, { expiresIn: `${expiresInSeconds} seconds` });
}

async function issueExpiredToken(): Promise<string> {
  const token = await V3.encrypt(
    { sub: "user-001", email: "x@x.com", role: "customer" } as unknown as Record<
      PropertyKey,
      unknown
    >,
    key,
    { expiresIn: "1 second" }
  );

  await new Promise((r) => setTimeout(r, 1100));
  return token;
}

function makeCtx(opts: { authHeader?: string; userRole?: string } = {}) {
  const headers: Record<string, string | undefined> = {};
  if (opts.authHeader !== undefined) headers.authorization = opts.authHeader;
  const store: Record<string, unknown> = {};
  if (opts.userRole !== undefined) store.userRole = opts.userRole;

  let jsonCalled: { data: unknown; status: number } | undefined;
  const ctx = {
    req: { header: (name: string) => headers[name.toLowerCase()] },
    set: (k: string, v: unknown) => {
      store[k] = v;
    },
    get: (k: string) => store[k],
    json: (data: unknown, status: number) => {
      jsonCalled = { data, status };
      return jsonCalled as unknown as Response;
    },
    _store: store,
    _jsonResult: () => jsonCalled,
  };
  return ctx as unknown as Context & {
    _store: Record<string, unknown>;
    _jsonResult: () => { data: unknown; status: number } | undefined;
  };
}

let verifier: PasetoVerifierService;

beforeAll(() => {
  verifier = new PasetoVerifierService(process.env.PASETO_KEY as string);
});

describe("PasetoVerifierService.verify — token security", () => {
  test("1. valid token → Ok with correct userId and role", async () => {
    const token = await issueToken({ sub: "user-42", role: "admin" });
    const result = await verifier.verify(token);

    expect(result._tag).toBe("Ok");
    if (result._tag === "Ok") {
      expect(result.value.sub).toBe("user-42");
      expect(result.value.role).toBe("admin");
    }
  });

  test("2. forged token (random base64) → Err(InvalidTokenError)", async () => {
    const forgery = `v3.local.${Buffer.from("tampered-garbage").toString("base64url")}`;
    const result = await verifier.verify(forgery);

    expect(result._tag).toBe("Err");
    if (result._tag === "Err") {
      expect(result.error._tag).toBe("InvalidTokenError");
    }
  });

  test("3. expired token → Err(TokenExpiredError)", async () => {
    const expired = await issueExpiredToken();
    const result = await verifier.verify(expired);

    expect(result._tag).toBe("Err");
    if (result._tag === "Err") {
      expect(result.error._tag).toBe("TokenExpiredError");
    }
  });

  test("4. empty Bearer header → Err(InvalidTokenError)", () => {
    const result = verifier.extractBearerToken(undefined);
    expect(result._tag).toBe("Err");
    if (result._tag === "Err") {
      expect(result.error._tag).toBe("InvalidTokenError");
    }
  });

  test("4b. malformed header (no Bearer prefix) → Err(InvalidTokenError)", () => {
    const result = verifier.extractBearerToken("just-a-token-no-bearer");
    expect(result._tag).toBe("Err");
    if (result._tag === "Err") {
      expect(result.error._tag).toBe("InvalidTokenError");
    }
  });
});

describe("requireRole middleware — role escalation prevention", () => {
  test("5. customer tries admin route → 403 Forbidden", async () => {
    const ctx = makeCtx({ userRole: "customer" });
    const middleware = requireRole("admin");

    await middleware(ctx, async () => undefined);

    const json = ctx._jsonResult();
    expect(json?.status).toBe(403);
    expect((json?.data as { _tag: string })?._tag).toBe("InsufficientRole");
  });

  test("5b. store_owner tries admin route → 403 Forbidden", async () => {
    const ctx = makeCtx({ userRole: "store_owner" });
    const middleware = requireRole("admin");

    await middleware(ctx, async () => undefined);

    expect(ctx._jsonResult()?.status).toBe(403);
  });

  test("6. admin on admin route → next() called (no 403)", async () => {
    const ctx = makeCtx({ userRole: "admin" });
    let nextCalled = false;
    const middleware = requireRole("admin");

    await middleware(ctx, async () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
    expect(ctx._jsonResult()).toBeUndefined();
  });

  test("6b. store_owner on store_owner+admin route → next() called", async () => {
    const ctx = makeCtx({ userRole: "store_owner" });
    let nextCalled = false;
    const middleware = requireRole("admin", "store_owner");

    await middleware(ctx, async () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
  });
});

describe("requireAuth middleware — token enforcement", () => {
  test("7. missing Authorization header → 401 Unauthorized", async () => {
    const ctx = makeCtx({});
    const middleware = requireAuth(verifier);

    await middleware(ctx, async () => undefined);

    expect(ctx._jsonResult()?.status).toBe(401);
  });

  test("8. forged token in Authorization → 401 Unauthorized", async () => {
    const forgery = `v3.local.${Buffer.from("forged").toString("base64url")}`;
    const ctx = makeCtx({ authHeader: `Bearer ${forgery}` });
    const middleware = requireAuth(verifier);

    await middleware(ctx, async () => undefined);

    expect(ctx._jsonResult()?.status).toBe(401);
  });

  test("8b. valid token → userId/role set in context, next() called", async () => {
    const token = await issueToken({ sub: "user-99", role: "customer" });
    const ctx = makeCtx({ authHeader: `Bearer ${token}` });
    let nextCalled = false;
    const middleware = requireAuth(verifier);

    await middleware(ctx, async () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
    expect(ctx._store.userId).toBe("user-99");
    expect(ctx._store.userRole).toBe("customer");
  });
});
