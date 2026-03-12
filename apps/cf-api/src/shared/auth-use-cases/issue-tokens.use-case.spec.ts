import { describe, expect, mock, test } from "bun:test";
import { Err, None, Ok } from "@fabric/types";
import type { RepositoryError, Result, TokenIssuanceError } from "@fabric/types";

const mockEncryptToken = mock(
  async (
    _payload: unknown,
    _key: string,
    _ttl: number
  ): Promise<{ _tag: "Ok"; value: string } | { _tag: "Err"; error: TokenIssuanceError }> =>
    Ok("mock-token")
);

import type { StoredRefreshToken } from "../../infrastructure/firebase/firebase-token.repository";
import { issueTokens } from "./issue-tokens.use-case";
import type { EncryptTokenFn, IssueTokensDeps } from "./issue-tokens.use-case";

const BASE_INPUT = {
  userId: "user-abc",
  email: "alice@example.com",
  role: "customer" as const,
};

const BASE_DEPS = (
  overrides: {
    saveResult?: unknown;
  } = {}
): IssueTokensDeps => ({
  tokenRepo: {
    save: mock(async () => overrides.saveResult ?? (Ok(undefined) as never)) as unknown as (
      token: StoredRefreshToken
    ) => Promise<Result<void, RepositoryError>>,
    findByJti: mock(async () => null) as unknown as (
      jti: string
    ) => Promise<Result<StoredRefreshToken | null, RepositoryError>>,
    revokeFamily: mock(async () => Ok(undefined) as never),
    isBlacklisted: mock(async () => false),
    blacklist: mock(async () => Ok(undefined) as never),
  },
  pasetoKey: "a".repeat(64),
  accessTokenTtlSeconds: 900,
  refreshTokenTtlSeconds: 604800,
  encryptToken: mockEncryptToken as EncryptTokenFn,
});

describe("issueTokens", () => {
  test("access token encryption fails: returns Err(TokenIssuanceError)", async () => {
    let callCount = 0;
    mockEncryptToken.mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return Err({ _tag: "TokenIssuanceError" as const, message: "PASETO key too short" });
      }
      return Ok("should-not-reach");
    });

    const deps = BASE_DEPS();
    const result = await issueTokens(BASE_INPUT, deps);

    expect(result._tag).toBe("Err");
    if (result._tag === "Err") {
      expect(result.error._tag).toBe("TokenIssuanceError");
    }
    expect(deps.tokenRepo.save).not.toHaveBeenCalled();
  });

  test("refresh token encryption fails: returns Err(TokenIssuanceError)", async () => {
    let callCount = 0;
    mockEncryptToken.mockImplementation(async () => {
      callCount++;
      if (callCount === 1) return Ok("access-token-ok");
      return Err({ _tag: "TokenIssuanceError" as const, message: "refresh encrypt failed" });
    });

    const deps = BASE_DEPS();
    const result = await issueTokens(BASE_INPUT, deps);

    expect(result._tag).toBe("Err");
    if (result._tag === "Err") {
      expect(result.error._tag).toBe("TokenIssuanceError");
    }
    expect(deps.tokenRepo.save).not.toHaveBeenCalled();
  });

  test('tokenRepo.save fails: returns Err(TokenIssuanceError) with "persist" in message', async () => {
    mockEncryptToken.mockImplementation(async (_p, _k, _t) => Ok("any-token"));

    const deps = BASE_DEPS({
      saveResult: Err({ _tag: "TokenIssuanceError" as const, message: "Firebase write failed" }),
    });

    const result = await issueTokens(BASE_INPUT, deps);

    expect(result._tag).toBe("Err");
    if (result._tag === "Err") {
      expect(result.error._tag).toBe("TokenIssuanceError");
      expect(result.error.message).toContain("persist");
    }
  });

  test("happy path: returns Ok({ accessToken, refreshToken })", async () => {
    mockEncryptToken.mockImplementation(async (_p, _k, _ttl) => {
      const payload = _p as Record<string, unknown>;
      const token = "jti" in payload && payload.jti ? `token-for-${payload.jti}` : "token";
      return Ok(token);
    });

    const deps = BASE_DEPS();
    const result = await issueTokens(BASE_INPUT, deps);

    expect(result._tag).toBe("Ok");
    if (result._tag === "Ok") {
      expect(result.value.accessToken).toContain("token-for-");
      expect(result.value.refreshToken).toContain("token-for-");
    }
    expect(deps.tokenRepo.save).toHaveBeenCalledTimes(1);
  });

  test("stored token has correct shape: id, userId, tokenFamily, tokenHash, expiresAt, revokedAt", async () => {
    mockEncryptToken.mockImplementation(async () => Ok("mock-refresh-token"));

    let capturedToken: StoredRefreshToken | undefined;
    const deps = BASE_DEPS();
    (deps.tokenRepo.save as ReturnType<typeof mock>).mockImplementation(
      async (token: StoredRefreshToken) => {
        capturedToken = token;
        return Ok(undefined);
      }
    );

    await issueTokens(BASE_INPUT, deps);

    expect(capturedToken).toBeDefined();
    if (capturedToken) {
      expect(typeof capturedToken.id).toBe("string");
      expect(capturedToken.userId).toBe(BASE_INPUT.userId);
      expect(typeof capturedToken.tokenFamily).toBe("string");
      expect(typeof capturedToken.tokenHash).toBe("string");
      expect(capturedToken.tokenHash).not.toBe("mock-refresh-token");
      expect(capturedToken.tokenHash).toMatch(/^[0-9a-f]{64}$/);
      expect(capturedToken.revokedAt).toEqual(None());
      expect(typeof capturedToken.expiresAt).toBe("object");
    }
  });

  test("expiresAt is approximately refreshTokenTtlSeconds from now", async () => {
    mockEncryptToken.mockImplementation(async () => Ok("mock-token"));

    let capturedToken: StoredRefreshToken | undefined;
    const deps = BASE_DEPS();
    (deps.tokenRepo.save as ReturnType<typeof mock>).mockImplementation(
      async (token: StoredRefreshToken) => {
        capturedToken = token;
        return Ok(undefined);
      }
    );

    const before = Date.now();
    await issueTokens({ ...BASE_INPUT }, { ...deps, refreshTokenTtlSeconds: 604800 });
    const after = Date.now();

    if (capturedToken) {
      const expiresMs = Number(capturedToken.expiresAt.epochMilliseconds);
      const expectedMs = (before + after) / 2 + 604800 * 1000;
      expect(expiresMs).toBeGreaterThan(before + 604800 * 1000 - 5000);
      expect(expiresMs).toBeLessThan(after + 604800 * 1000 + 5000);
      expect(expectedMs).toBeGreaterThan(0);
    }
  });
});
