import type { FirebaseUserRecord } from "@fabric/firebase";
import { None, Some } from "@fabric/types";
import type { RepositoryError, Result } from "@fabric/types";
import type { Email, UserId } from "@fabric/types";
import type { Maybe } from "@fabric/types";
import { Temporal } from "@js-temporal/polyfill";
import type { Database } from "firebase-admin/database";
import { makeRepositoryError } from "../../application/ports/product.repository.port";

export interface AuthUser {
  readonly id: UserId;
  readonly email: Email;
  readonly role: import("@fabric/types").UserRole;
  readonly passwordHash: Maybe<string>;
}

export interface IUserReaderPort {
  findByEmail(email: string): Promise<Result<AuthUser, RepositoryError>>;
  findById(id: string): Promise<Result<AuthUser, RepositoryError>>;
}

function recordToAuthUser(record: FirebaseUserRecord): AuthUser {
  return {
    id: record.id as UserId,
    email: record.email as Email,
    role: record.role,
    passwordHash: record.passwordHash ? Some(record.passwordHash) : None<string>(),
  };
}

export class FirebaseUserAdapter implements IUserReaderPort {
  constructor(private readonly db: Database) {}

  async findByEmail(email: string): Promise<Result<AuthUser, RepositoryError>> {
    try {
      const emailKey = Buffer.from(email.toLowerCase()).toString("base64url").replace(/=/g, "");
      const snap = await this.db.ref(`users_by_email/${emailKey}`).once("value");
      if (!snap.exists()) {
        return { _tag: "Err", error: makeRepositoryError(`User not found: ${email}`, null) };
      }
      const userId = snap.val() as string;
      return this.findById(userId);
    } catch (cause) {
      return { _tag: "Err", error: makeRepositoryError("Failed to find user by email", cause) };
    }
  }

  async findById(id: string): Promise<Result<AuthUser, RepositoryError>> {
    try {
      const snap = await this.db.ref(`users/${id}`).once("value");
      if (!snap.exists()) {
        return { _tag: "Err", error: makeRepositoryError(`User not found: ${id}`, null) };
      }
      const record = snap.val() as FirebaseUserRecord & { deletedAt?: string | null };
      if (record.deletedAt) {
        return { _tag: "Err", error: makeRepositoryError(`User not found: ${id}`, null) };
      }
      return { _tag: "Ok", value: recordToAuthUser(record) };
    } catch (cause) {
      return { _tag: "Err", error: makeRepositoryError(`Failed to find user ${id}`, cause) };
    }
  }

  async softDeleteUser(id: string): Promise<Result<void, RepositoryError>> {
    try {
      const snap = await this.db.ref(`users/${id}`).once("value");
      if (!snap.exists()) {
        return { _tag: "Err", error: makeRepositoryError(`User not found: ${id}`, null) };
      }
      const record = snap.val() as FirebaseUserRecord & { deletedAt?: string | null };
      if (record.deletedAt) {
        return { _tag: "Ok", value: undefined };
      }
      const now = Temporal.Now.instant().toString();
      await this.db.ref(`users/${id}`).update({ deletedAt: now, updatedAt: now });
      return { _tag: "Ok", value: undefined };
    } catch (cause) {
      return { _tag: "Err", error: makeRepositoryError(`Failed to soft-delete user ${id}`, cause) };
    }
  }

  async createUser(input: {
    id: string;
    email: string;
    passwordHash: string;
    role: FirebaseUserRecord["role"];
    displayName: string;
  }): Promise<Result<void, RepositoryError>> {
    try {
      const now = Temporal.Now.instant().toString();
      const record: FirebaseUserRecord = {
        ...input,
        emailVerifiedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      const emailKey = Buffer.from(input.email.toLowerCase())
        .toString("base64url")
        .replace(/=/g, "");

      const existingSnap = await this.db.ref(`users_by_email/${emailKey}`).once("value");
      if (existingSnap.exists()) {
        return {
          _tag: "Err",
          error: makeRepositoryError(`Email already registered: ${input.email}`, null),
        };
      }

      await this.db.ref().update({
        [`users/${input.id}`]: record,
        [`users_by_email/${emailKey}`]: input.id,
      });
      return { _tag: "Ok", value: undefined };
    } catch (cause) {
      return { _tag: "Err", error: makeRepositoryError("Failed to create user", cause) };
    }
  }
}
