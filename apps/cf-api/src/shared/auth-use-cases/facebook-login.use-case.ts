import type {
  RepositoryError,
  Result,
  TokenIssuanceError,
  TokenPair,
  UserRole,
} from "@fabric/types";
import { Err } from "@fabric/types";

export interface InvalidFacebookTokenError {
  readonly _tag: "InvalidFacebookToken";
  readonly message: string;
}

export interface EmailNotProvidedError {
  readonly _tag: "EmailNotProvided";
  readonly message: string;
}

export type FacebookLoginError =
  | InvalidFacebookTokenError
  | EmailNotProvidedError
  | RepositoryError
  | TokenIssuanceError;

export interface FacebookProfile {
  readonly id: string;
  readonly email?: string;
  readonly name: string;
}

export interface FacebookLoginDeps {
  readonly verifyFacebookToken: (
    accessToken: string
  ) => Promise<Result<FacebookProfile, InvalidFacebookTokenError>>;

  readonly userAdapter: {
    findByEmail: (
      email: string
    ) => Promise<
      Result<
        { id: { value: string }; email: { value: string }; role: UserRole } | null,
        RepositoryError
      >
    >;

    createUser: (input: {
      id: string;
      email: string;
      passwordHash: string;
      role: UserRole;
      displayName: string;
    }) => Promise<Result<void, RepositoryError>>;
  };

  readonly tokenService: {
    issue: (
      userId: string,
      email: string,
      role: string
    ) => Promise<Result<TokenPair, TokenIssuanceError>>;
  };
}

export const loginWithFacebook = async (
  accessToken: string,
  deps: FacebookLoginDeps
): Promise<Result<TokenPair, FacebookLoginError>> => {
  const profileResult = await deps.verifyFacebookToken(accessToken);
  if (profileResult._tag === "Err") return profileResult;

  const profile = profileResult.value;

  if (!profile.email) {
    return Err<EmailNotProvidedError>({
      _tag: "EmailNotProvided",
      message:
        "Facebook account must grant email permission. Please re-authorise and allow email access.",
    });
  }

  const email = profile.email.toLowerCase();

  const findResult = await deps.userAdapter.findByEmail(email);
  if (findResult._tag === "Err") return findResult;

  let userId: string;
  let userRole: UserRole;

  if (findResult.value !== null) {
    userId = findResult.value.id.value;
    userRole = findResult.value.role;
  } else {
    const newId = crypto.randomUUID();
    const createResult = await deps.userAdapter.createUser({
      id: newId,
      email,
      passwordHash: "",
      role: "customer",
      displayName: profile.name,
    });
    if (createResult._tag === "Err") return createResult;
    userId = newId;
    userRole = "customer";
  }

  return deps.tokenService.issue(userId, email, userRole);
};
