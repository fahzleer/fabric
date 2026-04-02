import type { FirebaseLoginAttemptRecord } from "@fabric/firebase";
import { Temporal } from "@js-temporal/polyfill";
import type { Database } from "firebase-admin/database";

const MAX_ATTEMPTS = 5;
const WINDOW_SECONDS = 15 * 60;
const LOCKOUT_SECONDS = 15 * 60;

function emailToKey(email: string): string {
  return Buffer.from(email.toLowerCase()).toString("base64url").replace(/=/g, "");
}

export interface ILockoutStorePort {
  isLocked(email: string): Promise<number>;
  recordAttempt(email: string): Promise<boolean>;
  reset(email: string): Promise<void>;
}

export class FirebaseLockoutAdapter implements ILockoutStorePort {
  constructor(private readonly db: Database) {}

  async isLocked(email: string): Promise<number> {
    const key = emailToKey(email);
    const snap = await this.db.ref(`login_attempts/${key}`).once("value");
    if (!snap.exists()) return 0;

    const record = snap.val() as FirebaseLoginAttemptRecord;
    if (!record.lockedUntil) return 0;

    const lockedUntil = Temporal.Instant.from(record.lockedUntil);
    const now = Temporal.Now.instant();
    const remaining = now.until(lockedUntil).total("seconds");
    return remaining > 0 ? Math.ceil(remaining) : 0;
  }

  async recordAttempt(email: string): Promise<boolean> {
    const key = emailToKey(email);
    let nowLocked = false;

    await this.db
      .ref(`login_attempts/${key}`)
      .transaction((current: FirebaseLoginAttemptRecord | null) => {
        const now = Temporal.Now.instant();
        const nowStr = now.toString();

        if (current === null) {
          return {
            attemptCount: 1,
            firstAttemptAt: nowStr,
            lockedUntil: null,
            updatedAt: nowStr,
          } satisfies FirebaseLoginAttemptRecord;
        }

        const firstAttempt = Temporal.Instant.from(current.firstAttemptAt);
        const elapsed = firstAttempt.until(now).total("seconds");
        if (elapsed > WINDOW_SECONDS) {
          return {
            attemptCount: 1,
            firstAttemptAt: nowStr,
            lockedUntil: null,
            updatedAt: nowStr,
          } satisfies FirebaseLoginAttemptRecord;
        }

        const newCount = current.attemptCount + 1;
        const lockedUntil =
          newCount >= MAX_ATTEMPTS
            ? now.add({ seconds: LOCKOUT_SECONDS }).toString()
            : (current.lockedUntil ?? null);

        if (newCount >= MAX_ATTEMPTS) nowLocked = true;

        return {
          ...current,
          attemptCount: newCount,
          lockedUntil,
          updatedAt: nowStr,
        };
      });

    return nowLocked;
  }

  async reset(email: string): Promise<void> {
    const key = emailToKey(email);
    await this.db.ref(`login_attempts/${key}`).remove();
  }
}
