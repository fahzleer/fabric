import { describe, expect, mock, test } from "bun:test";
import { loginWithFacebook } from "./facebook-login.use-case";
import type { FacebookLoginDeps } from "./facebook-login.use-case";

const VALID_FB_PROFILE = { id: "fb-123", email: "alice@example.com", name: "Alice" };
const TOKEN_PAIR = { accessToken: "access-tok", refreshToken: "refresh-tok" };
const EXISTING_USER = {
  id: { value: "user-123" },
  email: { value: "alice@example.com" },
  role: "customer" as const,
};

function makeDeps(
  overrides: {
    verifyResult?: unknown;
    findResult?: unknown;
    createResult?: unknown;
    issueResult?: unknown;
  } = {}
): FacebookLoginDeps {
  const {
    verifyResult = { _tag: "Ok", value: VALID_FB_PROFILE },
    findResult = { _tag: "Ok", value: EXISTING_USER },
    createResult = { _tag: "Ok", value: undefined },
    issueResult = { _tag: "Ok", value: TOKEN_PAIR },
  } = overrides;

  return {
    verifyFacebookToken: mock(async () => verifyResult as never),
    userAdapter: {
      findByEmail: mock(async () => findResult as never),
      createUser: mock(async () => createResult as never),
    },
    tokenService: {
      issue: mock(async () => issueResult as never),
    },
  };
}

describe("loginWithFacebook", () => {
  test("existing user: valid FB token returns PASETO token pair", async () => {
    const deps = makeDeps();
    const result = await loginWithFacebook("valid-fb-token", deps);

    expect(result._tag).toBe("Ok");
    if (result._tag === "Ok") {
      expect(result.value).toEqual(TOKEN_PAIR);
    }
    expect(deps.userAdapter.createUser).not.toHaveBeenCalled();
    expect(deps.userAdapter.findByEmail).toHaveBeenCalledWith("alice@example.com");
  });

  test("new user (null from findByEmail): auto-registers as customer and returns token pair", async () => {
    const deps = makeDeps({
      findResult: { _tag: "Ok", value: null },
    });

    const result = await loginWithFacebook("valid-fb-token-new", deps);

    expect(result._tag).toBe("Ok");
    if (result._tag === "Ok") {
      expect(result.value).toEqual(TOKEN_PAIR);
    }

    expect(deps.userAdapter.createUser).toHaveBeenCalledTimes(1);
    const [createArg] = (deps.userAdapter.createUser as ReturnType<typeof mock>).mock.calls[0] as [
      { email: string; role: string; displayName: string; passwordHash: string },
    ];
    expect(createArg.email).toBe("alice@example.com");
    expect(createArg.role).toBe("customer");
    expect(createArg.displayName).toBe("Alice");
    expect(createArg.passwordHash).toBe("");
  });

  test("invalid FB token: returns InvalidFacebookToken error, no DB calls", async () => {
    const deps = makeDeps({
      verifyResult: {
        _tag: "Err",
        error: { _tag: "InvalidFacebookToken", message: "Bad or expired token" },
      },
    });

    const result = await loginWithFacebook("bad-token", deps);

    expect(result._tag).toBe("Err");
    if (result._tag === "Err") {
      expect(result.error._tag).toBe("InvalidFacebookToken");
    }
    expect(deps.userAdapter.findByEmail).not.toHaveBeenCalled();
    expect(deps.userAdapter.createUser).not.toHaveBeenCalled();
    expect(deps.tokenService.issue).not.toHaveBeenCalled();
  });

  test("FB profile without email: returns EmailNotProvided error", async () => {
    const deps = makeDeps({
      verifyResult: {
        _tag: "Ok",
        value: { id: "fb-789", name: "No Email User" },
      },
    });

    const result = await loginWithFacebook("token-no-email", deps);

    expect(result._tag).toBe("Err");
    if (result._tag === "Err") {
      expect(result.error._tag).toBe("EmailNotProvided");
    }
    expect(deps.userAdapter.findByEmail).not.toHaveBeenCalled();
  });

  test("DB error on findByEmail: propagates RepositoryError", async () => {
    const deps = makeDeps({
      findResult: {
        _tag: "Err",
        error: { _tag: "RepositoryError", message: "DB connection refused" },
      },
    });

    const result = await loginWithFacebook("valid-fb-token", deps);

    expect(result._tag).toBe("Err");
    if (result._tag === "Err") {
      expect(result.error._tag).toBe("RepositoryError");
    }
    expect(deps.userAdapter.createUser).not.toHaveBeenCalled();
  });

  test("createUser failure: propagates RepositoryError", async () => {
    const deps = makeDeps({
      findResult: { _tag: "Ok", value: null },
      createResult: {
        _tag: "Err",
        error: { _tag: "RepositoryError", message: "DB write failed" },
      },
    });

    const result = await loginWithFacebook("valid-fb-token", deps);

    expect(result._tag).toBe("Err");
    if (result._tag === "Err") {
      expect(result.error._tag).toBe("RepositoryError");
    }
    expect(deps.tokenService.issue).not.toHaveBeenCalled();
  });

  test("token issuance failure: propagates TokenIssuanceError", async () => {
    const deps = makeDeps({
      issueResult: {
        _tag: "Err",
        error: { _tag: "TokenIssuanceError", message: "PASETO encryption failed" },
      },
    });

    const result = await loginWithFacebook("valid-fb-token", deps);

    expect(result._tag).toBe("Err");
    if (result._tag === "Err") {
      expect(result.error._tag).toBe("TokenIssuanceError");
    }
  });

  test("email from FB profile is normalised to lowercase before lookup", async () => {
    const deps = makeDeps({
      verifyResult: {
        _tag: "Ok",
        value: { id: "fb-123", email: "Alice@EXAMPLE.COM", name: "Alice" },
      },
    });

    const result = await loginWithFacebook("valid-fb-token", deps);

    expect(result._tag).toBe("Ok");
    expect(deps.userAdapter.findByEmail).toHaveBeenCalledWith("alice@example.com");
  });
});
