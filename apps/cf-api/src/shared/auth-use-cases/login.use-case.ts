import type {
  InvalidCredentialsError,
  RepositoryError,
  Result,
  TokenIssuanceError,
  TokenPair,
  UserRole,
} from "@fabric/types";
import { Err, InvalidCredentialsError as makeInvalidCreds } from "@fabric/types";
import { verifyPassword } from "../../infrastructure/password/password.service";

export type LoginInput = {
  readonly email: string;
  readonly password: string;
};

export type LoginError = InvalidCredentialsError | RepositoryError | TokenIssuanceError;

export type LoginDeps = {
  readonly userReader: {
    findByEmail(email: string): Promise<
      Result<
        {
          id: { value: string };
          email: { value: string };
          role: UserRole;
          passwordHash: { _tag: "Some"; value: string } | { _tag: "None" };
        },
        RepositoryError
      >
    >;
  };
  readonly tokenService: {
    issue(
      userId: string,
      email: string,
      role: string
    ): Promise<Result<TokenPair, TokenIssuanceError>>;
  };
  readonly lockoutStore: {
    isLocked(email: string): Promise<number>;
    recordAttempt(email: string): Promise<boolean>;
    reset(email: string): Promise<void>;
  };
};

export const login = async (
  input: LoginInput,
  deps: LoginDeps
): Promise<Result<TokenPair, LoginError>> => {
  const lockoutSeconds = await deps.lockoutStore.isLocked(input.email);
  if (lockoutSeconds > 0) {
    return Err(
      makeInvalidCreds(`Account temporarily locked. Try again in ${lockoutSeconds} seconds.`)
    );
  }

  const userResult = await deps.userReader.findByEmail(input.email);
  if (userResult._tag === "Err") {
    await deps.lockoutStore.recordAttempt(input.email);
    return Err(makeInvalidCreds("Invalid email or password"));
  }

  const user = userResult.value;
  if (user.passwordHash._tag === "None") {
    await deps.lockoutStore.recordAttempt(input.email);
    return Err(makeInvalidCreds("This account does not support password login"));
  }

  const isValid = await verifyPassword(input.password, user.passwordHash.value);
  if (!isValid) {
    await deps.lockoutStore.recordAttempt(input.email);
    return Err(makeInvalidCreds("Invalid email or password"));
  }

  await deps.lockoutStore.reset(input.email);
  return deps.tokenService.issue(user.id.value, user.email.value, user.role);
};
