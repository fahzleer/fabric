import type { RepositoryError, Result, TokenIssuanceError, UserRole } from "@fabric/types";
import type { issueTokens } from "./issue-tokens.use-case";

export type GoogleProfile = {
  readonly sub: string;
  readonly email?: string;
  readonly name: string;
};

export type InvalidGoogleTokenError = {
  readonly _tag: "InvalidGoogleToken";
  readonly message: string;
};

export type EmailNotProvidedError = {
  readonly _tag: "EmailNotProvided";
  readonly message: string;
};

export type GoogleLoginError =
  | InvalidGoogleTokenError
  | EmailNotProvidedError
  | RepositoryError
  | TokenIssuanceError;

export type GoogleLoginDeps = {
  readonly verifyGoogleToken: (
    idToken: string
  ) => Promise<Result<GoogleProfile, InvalidGoogleTokenError>>;
  readonly userAdapter: {
    readonly findByEmail: (
      email: string
    ) => Promise<
      Result<
        { id: { value: string }; email: { value: string }; role: UserRole } | null,
        RepositoryError
      >
    >;
    readonly createUser: (input: {
      id: string;
      email: string;
      passwordHash: string;
      role: UserRole;
      displayName: string;
    }) => Promise<Result<unknown, RepositoryError>>;
  };
  readonly tokenService: {
    readonly issue: (userId: string, email: string, role: string) => ReturnType<typeof issueTokens>;
  };
};

export type GoogleLoginResult = {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly userId: string;
};

export async function loginWithGoogle(
  idToken: string,
  deps: GoogleLoginDeps
): Promise<Result<GoogleLoginResult, GoogleLoginError>> {
  const profileResult = await deps.verifyGoogleToken(idToken);
  if (profileResult._tag === "Err") return profileResult;

  const profile = profileResult.value;

  if (!profile.email) {
    return {
      _tag: "Err",
      error: {
        _tag: "EmailNotProvided",
        message: "Google account did not provide an email address. Please grant email permission.",
      },
    };
  }

  const email = profile.email.toLowerCase();

  const existingResult = await deps.userAdapter.findByEmail(email);
  if (existingResult._tag === "Err") return existingResult;

  let userId: string;
  let userRole: UserRole = "customer";

  if (existingResult.value !== null) {
    userId = existingResult.value.id.value;
    userRole = existingResult.value.role;
  } else {
    userId = crypto.randomUUID();
    const createResult = await deps.userAdapter.createUser({
      id: userId,
      email,
      passwordHash: "",
      role: "customer",
      displayName: profile.name,
    });
    if (createResult._tag === "Err") return createResult;
    userRole = "customer";
  }

  const tokenResult = await deps.tokenService.issue(userId, email, userRole);
  if (tokenResult._tag === "Err") return tokenResult;

  return {
    _tag: "Ok",
    value: {
      accessToken: tokenResult.value.accessToken,
      refreshToken: tokenResult.value.refreshToken,
      userId,
    },
  };
}
