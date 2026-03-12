import type { FirebaseRefreshTokenRecord, FirebaseTokenBlacklistRecord } from "@fabric/firebase";
import { None, Some } from "@fabric/types";
import type { RepositoryError, Result } from "@fabric/types";
import { Temporal } from "@js-temporal/polyfill";
import type { Database } from "firebase-admin/database";
import { makeRepositoryError } from "../../application/ports/product.repository.port";

export interface StoredRefreshToken {
  readonly id: string;
  readonly userId: string;
  readonly tokenFamily: string;
  readonly tokenHash: string;
  readonly expiresAt: Temporal.Instant;
  readonly revokedAt: { _tag: "None" } | { _tag: "Some"; value: Temporal.Instant };
  readonly createdAt: Temporal.Instant;
}

export interface ITokenRepositoryPort {
  save(token: StoredRefreshToken): Promise<Result<void, RepositoryError>>;
  findByJti(jti: string): Promise<Result<StoredRefreshToken | null, RepositoryError>>;
  revokeFamily(tokenFamily: string): Promise<Result<void, RepositoryError>>;
  isBlacklisted(jti: string): Promise<boolean>;
  blacklist(jti: string, expiresAt: Temporal.Instant): Promise<Result<void, RepositoryError>>;
}

export class FirebaseTokenRepository implements ITokenRepositoryPort {
  constructor(private readonly db: Database) {}

  async save(token: StoredRefreshToken): Promise<Result<void, RepositoryError>> {
    try {
      const record: FirebaseRefreshTokenRecord = {
        userId: token.userId,
        tokenFamily: token.tokenFamily,
        tokenHash: token.tokenHash,
        expiresAt: token.expiresAt.toString(),
        revokedAt: token.revokedAt._tag === "Some" ? token.revokedAt.value.toString() : null,
        createdAt: token.createdAt.toString(),
      };
      await this.db.ref(`refresh_tokens/${token.id}`).set(record);
      return { _tag: "Ok", value: undefined };
    } catch (cause) {
      return { _tag: "Err", error: makeRepositoryError("Failed to save refresh token", cause) };
    }
  }

  async findByJti(jti: string): Promise<Result<StoredRefreshToken | null, RepositoryError>> {
    try {
      const snap = await this.db.ref(`refresh_tokens/${jti}`).once("value");
      if (!snap.exists()) return { _tag: "Ok", value: null };
      const record = snap.val() as FirebaseRefreshTokenRecord;
      return {
        _tag: "Ok",
        value: {
          id: jti,
          userId: record.userId,
          tokenFamily: record.tokenFamily,
          tokenHash: record.tokenHash,
          expiresAt: Temporal.Instant.from(record.expiresAt),
          revokedAt: record.revokedAt ? Some(Temporal.Instant.from(record.revokedAt)) : None(),
          createdAt: Temporal.Instant.from(record.createdAt),
        },
      };
    } catch (cause) {
      return {
        _tag: "Err",
        error: makeRepositoryError(`Failed to find refresh token ${jti}`, cause),
      };
    }
  }

  async revokeFamily(tokenFamily: string): Promise<Result<void, RepositoryError>> {
    try {
      const snap = await this.db
        .ref("refresh_tokens")
        .orderByChild("tokenFamily")
        .equalTo(tokenFamily)
        .once("value");

      const now = Temporal.Now.instant().toString();
      const updates: Record<string, string> = {};
      snap.forEach((child) => {
        updates[`refresh_tokens/${child.key}/revokedAt`] = now;
      });

      if (Object.keys(updates).length > 0) {
        await this.db.ref().update(updates);
      }
      return { _tag: "Ok", value: undefined };
    } catch (cause) {
      return {
        _tag: "Err",
        error: makeRepositoryError(`Failed to revoke token family ${tokenFamily}`, cause),
      };
    }
  }

  async isBlacklisted(jti: string): Promise<boolean> {
    const snap = await this.db.ref(`token_blacklist/${jti}`).once("value");
    return snap.exists();
  }

  async blacklist(
    jti: string,
    expiresAt: Temporal.Instant
  ): Promise<Result<void, RepositoryError>> {
    try {
      const record: FirebaseTokenBlacklistRecord = {
        expiresAt: expiresAt.toString(),
        revokedAt: Temporal.Now.instant().toString(),
      };
      await this.db.ref(`token_blacklist/${jti}`).set(record);
      return { _tag: "Ok", value: undefined };
    } catch (cause) {
      return { _tag: "Err", error: makeRepositoryError(`Failed to blacklist token ${jti}`, cause) };
    }
  }
}
