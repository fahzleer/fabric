import { describe, expect, test } from "bun:test";
import { createSecretKey } from "node:crypto";
import { Hono } from "hono";
import { V3 } from "paseto";
import { registerInternalRoutes } from "./internal.handlers";

const TEST_KEY_HEX = "a".repeat(64);
const INVALID_KEY_HEX = "aa";
const SECRET = "a".repeat(32);
const WRONG_SECRET_SAME_LEN = "b".repeat(32);
const SHORT_SECRET = "short";
const VALID_BODY = {
  userId: "user-abc-123",
  email: "alice@example.com",
  role: "store_owner" as const,
};

function makeApp(pasetoKey = TEST_KEY_HEX, secret = SECRET) {
  const app = new Hono();
  registerInternalRoutes(app, pasetoKey, secret);
  return app;
}

function makeRequest(
  body: unknown,
  secretHeader: string = SECRET,
  contentType = "application/json"
): Request {
  const headers: Record<string, string> = {
    "x-internal-secret": secretHeader,
  };
  if (contentType) headers["Content-Type"] = contentType;

  return new Request("http://localhost/internal/issue-token", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /internal/issue-token — auth bridge", () => {
  test("1. valid secret + valid body → 200 { accessToken }", async () => {
    const app = makeApp();
    const res = await app.fetch(makeRequest(VALID_BODY));

    expect(res.status).toBe(200);
    const json = (await res.json()) as { accessToken?: string };
    expect(typeof json.accessToken).toBe("string");
    expect(json.accessToken?.length).toBeGreaterThan(20);
  });

  test("2. wrong-length secret → 401 Unauthorized", async () => {
    const app = makeApp();
    const res = await app.fetch(makeRequest(VALID_BODY, SHORT_SECRET));

    expect(res.status).toBe(401);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("Unauthorized");
  });

  test("3. same-length wrong secret → 401 Unauthorized", async () => {
    const app = makeApp();
    const res = await app.fetch(makeRequest(VALID_BODY, WRONG_SECRET_SAME_LEN));

    expect(res.status).toBe(401);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("Unauthorized");
  });

  test("4. invalid role → 400 validation error", async () => {
    const app = makeApp();
    const res = await app.fetch(makeRequest({ ...VALID_BODY, role: "superuser" }));

    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(typeof json.error).toBe("string");
    expect(json.error.length).toBeGreaterThan(0);
  });

  test("5a. missing email → 400 validation error", async () => {
    const app = makeApp();
    const { email: _email, ...bodyWithoutEmail } = VALID_BODY;
    const res = await app.fetch(makeRequest(bodyWithoutEmail));

    expect(res.status).toBe(400);
  });

  test("5b. missing userId → 400 validation error", async () => {
    const app = makeApp();
    const { userId: _userId, ...bodyWithoutUserId } = VALID_BODY;
    const res = await app.fetch(makeRequest(bodyWithoutUserId));

    expect(res.status).toBe(400);
  });

  test("5c. empty userId (zero-length string) → 400 validation error", async () => {
    const app = makeApp();
    const res = await app.fetch(makeRequest({ ...VALID_BODY, userId: "" }));

    expect(res.status).toBe(400);
  });

  test("6. non-JSON body → 400", async () => {
    const app = makeApp();
    const res = await app.fetch(makeRequest("not-json-at-all", SECRET, "text/plain"));

    expect(res.status).toBe(400);
  });

  test("7. invalid pasetoKey triggers encryptToken Err → 500 Token issuance failed", async () => {
    const app = makeApp(INVALID_KEY_HEX);
    const res = await app.fetch(makeRequest(VALID_BODY));

    expect(res.status).toBe(500);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("Token issuance failed");
  });

  test("8. returned accessToken has correct payload: sub, email, role, jti (UUID)", async () => {
    const app = makeApp();
    const res = await app.fetch(makeRequest(VALID_BODY));

    expect(res.status).toBe(200);
    const { accessToken } = (await res.json()) as { accessToken: string };

    const key = createSecretKey(Buffer.from(TEST_KEY_HEX, "hex"));
    const payload = (await V3.decrypt(accessToken, key)) as Record<string, unknown>;

    expect(payload.sub).toBe(VALID_BODY.userId);
    expect(payload.email).toBe(VALID_BODY.email);
    expect(payload.role).toBe(VALID_BODY.role);
    expect(typeof payload.jti).toBe("string");
    expect(payload.jti as string).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });

  test("9. each call produces a unique accessToken (unique jti)", async () => {
    const app = makeApp();

    const [res1, res2] = await Promise.all([
      app.fetch(makeRequest(VALID_BODY)),
      app.fetch(makeRequest(VALID_BODY)),
    ]);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);

    const { accessToken: token1 } = (await res1.json()) as { accessToken: string };
    const { accessToken: token2 } = (await res2.json()) as { accessToken: string };

    expect(token1).not.toBe(token2);
  });

  test('10. role "customer" is accepted', async () => {
    const app = makeApp();
    const res = await app.fetch(makeRequest({ ...VALID_BODY, role: "customer" }));
    expect(res.status).toBe(200);
  });

  test('10b. role "admin" is accepted', async () => {
    const app = makeApp();
    const res = await app.fetch(makeRequest({ ...VALID_BODY, role: "admin" }));
    expect(res.status).toBe(200);
  });
});
