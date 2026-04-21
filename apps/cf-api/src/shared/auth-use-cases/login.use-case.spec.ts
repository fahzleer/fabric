import { beforeEach, describe, expect, mock, test } from "bun:test";
import { login } from "./login.use-case";
import type { LoginDeps } from "./login.use-case";

const mockVerifyPassword = mock(async (_password: string, _hash: string): Promise<boolean> => true);

mock.module("../../infrastructure/password/password.service", () => ({
  verifyPassword: mockVerifyPassword,
}));

const TOKEN_PAIR = { accessToken: "access-tok", refreshToken: "refresh-tok" };

const EXISTING_USER = {
  id: "user-123",
  email: "alice@example.com",
  role: "customer" as const,
  passwordHash: { _tag: "Some" as const, value: "$2b$12$hashedpw" },
};

const SOCIAL_USER = {
  ...EXISTING_USER,
  passwordHash: { _tag: "None" as const },
};

function makeDeps(
  overrides: {
    lockedSeconds?: number;
    findResult?: unknown;
    issueResult?: unknown;
    recordResult?: boolean;
  } = {}
): LoginDeps {
  const {
    lockedSeconds = 0,
    findResult = { _tag: "Ok", value: EXISTING_USER },
    issueResult = { _tag: "Ok", value: TOKEN_PAIR },
    recordResult = false,
  } = overrides;

  return {
    userReader: {
      findByEmail: mock(async () => findResult as never),
    },
    tokenService: {
      issue: mock(async () => issueResult as never),
    },
    lockoutStore: {
      isLocked: mock(async () => lockedSeconds),
      recordAttempt: mock(async () => recordResult),
      reset: mock(async () => undefined),
    },
  };
}

describe("login", () => {
  beforeEach(() => {
    mockVerifyPassword.mockImplementation(async () => true);
  });

  test("locked account: returns InvalidCredentialsError with remaining seconds, no DB call", async () => {
    const deps = makeDeps({ lockedSeconds: 42 });

    const result = await login({ email: "alice@example.com", password: "pw" }, deps);

    expect(result._tag).toBe("Err");
    if (result._tag === "Err") {
      expect(result.error._tag).toBe("InvalidCredentialsError");
      expect(result.error.message).toContain("42");
    }
    expect(deps.userReader.findByEmail).not.toHaveBeenCalled();
    expect(deps.lockoutStore.recordAttempt).not.toHaveBeenCalled();
    expect(deps.tokenService.issue).not.toHaveBeenCalled();
  });

  test("user not found: recordAttempt called, Err(InvalidCredentialsError)", async () => {
    const deps = makeDeps({
      findResult: { _tag: "Err", error: { _tag: "RepositoryError", message: "not found" } },
    });

    const result = await login({ email: "ghost@example.com", password: "pw" }, deps);

    expect(result._tag).toBe("Err");
    if (result._tag === "Err") {
      expect(result.error._tag).toBe("InvalidCredentialsError");
      expect(result.error.message).toBe("Invalid email or password");
    }
    expect(deps.lockoutStore.recordAttempt).toHaveBeenCalledWith("ghost@example.com");
    expect(deps.tokenService.issue).not.toHaveBeenCalled();
  });

  test('social-only account: recordAttempt called, Err with "does not support password login"', async () => {
    const deps = makeDeps({
      findResult: { _tag: "Ok", value: SOCIAL_USER },
    });

    const result = await login({ email: "alice@example.com", password: "pw" }, deps);

    expect(result._tag).toBe("Err");
    if (result._tag === "Err") {
      expect(result.error._tag).toBe("InvalidCredentialsError");
      expect(result.error.message).toContain("does not support password login");
    }
    expect(deps.lockoutStore.recordAttempt).toHaveBeenCalledWith("alice@example.com");
    expect(deps.tokenService.issue).not.toHaveBeenCalled();
  });

  test("wrong password: recordAttempt called, Err(InvalidCredentialsError)", async () => {
    mockVerifyPassword.mockImplementation(async () => false);

    const deps = makeDeps();

    const result = await login({ email: "alice@example.com", password: "wrong" }, deps);

    expect(result._tag).toBe("Err");
    if (result._tag === "Err") {
      expect(result.error._tag).toBe("InvalidCredentialsError");
      expect(result.error.message).toBe("Invalid email or password");
    }
    expect(deps.lockoutStore.recordAttempt).toHaveBeenCalledWith("alice@example.com");
    expect(deps.lockoutStore.reset).not.toHaveBeenCalled();
    expect(deps.tokenService.issue).not.toHaveBeenCalled();
  });

  test("correct password, token issuance fails: reset called, Err(TokenIssuanceError)", async () => {
    const deps = makeDeps({
      issueResult: {
        _tag: "Err",
        error: { _tag: "TokenIssuanceError", message: "PASETO key invalid" },
      },
    });

    const result = await login({ email: "alice@example.com", password: "correct" }, deps);

    expect(result._tag).toBe("Err");
    if (result._tag === "Err") {
      expect(result.error._tag).toBe("TokenIssuanceError");
    }
    expect(deps.lockoutStore.reset).toHaveBeenCalledWith("alice@example.com");
    expect(deps.lockoutStore.recordAttempt).not.toHaveBeenCalled();
  });

  test("correct password, token succeeds: reset called, returns Ok(TokenPair)", async () => {
    const deps = makeDeps();

    const result = await login({ email: "alice@example.com", password: "correct" }, deps);

    expect(result._tag).toBe("Ok");
    if (result._tag === "Ok") {
      expect(result.value).toEqual(TOKEN_PAIR);
    }
    expect(deps.lockoutStore.reset).toHaveBeenCalledWith("alice@example.com");
    expect(deps.lockoutStore.recordAttempt).not.toHaveBeenCalled();
    expect(deps.tokenService.issue).toHaveBeenCalledWith(
      EXISTING_USER.id,
      EXISTING_USER.email,
      EXISTING_USER.role
    );
  });

  test("isLocked is called with the exact input email", async () => {
    const deps = makeDeps();

    await login({ email: "bob@example.com", password: "pw" }, deps);

    expect(deps.lockoutStore.isLocked).toHaveBeenCalledWith("bob@example.com");
  });

  test("verifyPassword called with input password and stored hash", async () => {
    const deps = makeDeps();

    await login({ email: "alice@example.com", password: "my-secret" }, deps);

    expect(mockVerifyPassword).toHaveBeenCalledWith("my-secret", EXISTING_USER.passwordHash.value);
  });
});
