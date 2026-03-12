import { regex } from "arkregex";
import { type } from "arktype";
import type { DomainEvent } from "./events";
import type { TaggedError } from "./kernel";

export type UserId = { readonly __brand: "UserId"; readonly value: string };
export const makeUserId = (value: string): UserId => ({ __brand: "UserId", value });

const rEmail = regex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");

export interface EmailError extends TaggedError<"EmailError"> {}
export type Email = { readonly __brand: "Email"; readonly value: string };

export const makeEmail = (raw: string): Email | EmailError => {
  const trimmed = raw.trim().toLowerCase();
  if (!rEmail.test(trimmed)) {
    return { _tag: "EmailError", message: `Invalid email address: ${raw}` };
  }
  return { __brand: "Email", value: trimmed };
};

export const EmailSchema = type("string.email");

export interface DisplayNameError extends TaggedError<"DisplayNameError"> {}
export type DisplayName = { readonly __brand: "DisplayName"; readonly value: string };

export const makeDisplayName = (raw: string): DisplayName | DisplayNameError => {
  const trimmed = raw.trim();
  if (trimmed.length < 2 || trimmed.length > 50) {
    return {
      _tag: "DisplayNameError",
      message: "Display name must be between 2 and 50 characters",
    };
  }
  return { __brand: "DisplayName", value: trimmed };
};

export type UserRole = "customer" | "admin" | "store_owner";

export const UserRoleSchema = type("'customer' | 'admin' | 'store_owner'");

export const isValidUserRole = (role: string): role is UserRole =>
  role === "customer" || role === "admin" || role === "store_owner";

export interface ForbiddenError extends TaggedError<"ForbiddenError"> {}
export const ForbiddenError = (message: string): ForbiddenError => ({
  _tag: "ForbiddenError",
  message,
});

export interface UserNotFoundError extends TaggedError<"UserNotFoundError"> {}
export const UserNotFoundError = (userId: string): UserNotFoundError => ({
  _tag: "UserNotFoundError",
  message: `User not found: ${userId}`,
});

export interface DuplicateEmailError extends TaggedError<"DuplicateEmailError"> {}
export const DuplicateEmailError = (email: string): DuplicateEmailError => ({
  _tag: "DuplicateEmailError",
  message: `Email already registered: ${email}`,
});

export interface UnauthorizedError extends TaggedError<"UnauthorizedError"> {}
export const UnauthorizedError = (message: string): UnauthorizedError => ({
  _tag: "UnauthorizedError",
  message,
});

export interface PasswordHashError extends TaggedError<"PasswordHashError"> {}
export const PasswordHashError = (message: string): PasswordHashError => ({
  _tag: "PasswordHashError",
  message,
});

export interface PasswordComplexityError extends TaggedError<"PasswordComplexityError"> {}
export const PasswordComplexityError = (message: string): PasswordComplexityError => ({
  _tag: "PasswordComplexityError",
  message,
});

export interface InvalidCredentialsError extends TaggedError<"InvalidCredentialsError"> {}
export const InvalidCredentialsError = (message: string): InvalidCredentialsError => ({
  _tag: "InvalidCredentialsError",
  message,
});

export type UserError =
  | UserNotFoundError
  | DuplicateEmailError
  | UnauthorizedError
  | PasswordHashError
  | PasswordComplexityError
  | InvalidCredentialsError;

const makeUserEvent = <TType extends string, TPayload>(
  _type: TType,
  payload: TPayload
): DomainEvent<TType, TPayload> => ({
  _type,
  _version: 1,
  eventId: crypto.randomUUID(),
  occurredAt: new Date().toISOString(),
  payload,
});

export type AuthMethod = "email" | "facebook" | "google";

export type UserRegisteredPayload = {
  readonly userId: string;
  readonly email: string;
  readonly role: UserRole;
  readonly method: AuthMethod;
  readonly registeredAt: string;
};
export type UserRegistered = DomainEvent<"UserRegistered", UserRegisteredPayload>;
export const makeUserRegistered = (payload: UserRegisteredPayload): UserRegistered =>
  makeUserEvent("UserRegistered", payload);

export type UserLoggedInPayload = {
  readonly userId: string;
  readonly email: string;
  readonly role: UserRole;
  readonly method: AuthMethod;
  readonly ipAddress: string;
  readonly userAgent: string;
  readonly loggedInAt: string;
};
export type UserLoggedIn = DomainEvent<"UserLoggedIn", UserLoggedInPayload>;
export const makeUserLoggedIn = (payload: UserLoggedInPayload): UserLoggedIn =>
  makeUserEvent("UserLoggedIn", payload);

export type UserLoggedOutPayload = {
  readonly userId: string;
  readonly loggedOutAt: string;
};
export type UserLoggedOut = DomainEvent<"UserLoggedOut", UserLoggedOutPayload>;
export const makeUserLoggedOut = (payload: UserLoggedOutPayload): UserLoggedOut =>
  makeUserEvent("UserLoggedOut", payload);

export type UserLoginFailedPayload = {
  readonly email: string;
  readonly reason: string;
  readonly ipAddress: string;
  readonly failedAt: string;
};
export type UserLoginFailed = DomainEvent<"UserLoginFailed", UserLoginFailedPayload>;
export const makeUserLoginFailed = (payload: UserLoginFailedPayload): UserLoginFailed =>
  makeUserEvent("UserLoginFailed", payload);

export type UserDomainEvent = UserRegistered | UserLoggedIn | UserLoggedOut | UserLoginFailed;
