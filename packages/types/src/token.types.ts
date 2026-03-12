import type { TaggedError } from "./kernel";
import type { UserRole } from "./user.types";

export interface AccessTokenPayload {
  readonly sub: string;
  readonly role: UserRole;
  readonly email: string;
  readonly iat: string;
  readonly exp: string;
}

export interface RefreshTokenPayload {
  readonly sub: string;
  readonly jti: string;
  readonly iat: string;
  readonly exp: string;
}

export interface TokenPair {
  readonly accessToken: string;
  readonly refreshToken: string;
}

export interface TokenIssuanceError extends TaggedError<"TokenIssuanceError"> {}
export const TokenIssuanceError = (message: string): TokenIssuanceError => ({
  _tag: "TokenIssuanceError",
  message,
});

export interface InvalidTokenError extends TaggedError<"InvalidTokenError"> {}
export const InvalidTokenError = (message: string): InvalidTokenError => ({
  _tag: "InvalidTokenError",
  message,
});

export interface TokenExpiredError extends TaggedError<"TokenExpiredError"> {}
export const TokenExpiredError = (message: string): TokenExpiredError => ({
  _tag: "TokenExpiredError",
  message,
});

export interface TokenRevokedError extends TaggedError<"TokenRevokedError"> {}
export const TokenRevokedError = (message: string): TokenRevokedError => ({
  _tag: "TokenRevokedError",
  message,
});

export type TokenError =
  | TokenIssuanceError
  | InvalidTokenError
  | TokenExpiredError
  | TokenRevokedError;
