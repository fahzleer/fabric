import { describe, expect, mock, test } from "bun:test";
import type { FirebaseLoginAttemptRecord } from "@fabric/firebase";
import { Temporal } from "@js-temporal/polyfill";
import type { Database } from "firebase-admin/database";
import { FirebaseLockoutAdapter } from "./firebase-lockout.adapter";

const NOW = Temporal.Now.instant();
const nowStr = NOW.toString();
const fiveMinutesAgo = NOW.subtract({ seconds: 5 * 60 }).toString();
const twentyMinutesAgo = NOW.subtract({ seconds: 20 * 60 }).toString();

function makeDbForIsLocked(snapExists: boolean, snapVal: FirebaseLoginAttemptRecord | null) {
  const mockOnce = mock(async () => ({
    exists: () => snapExists,
    val: () => snapVal,
  }));
  const mockRef = mock(() => ({ once: mockOnce }));
  return {
    db: { ref: mockRef } as unknown as Database,
    mockRef,
    mockOnce,
  };
}

function makeDbForRecordAttempt(transactionCurrent: FirebaseLoginAttemptRecord | null) {
  const mockTransaction = mock(
    async (callback: (c: FirebaseLoginAttemptRecord | null) => unknown) => {
      callback(transactionCurrent);
      return { committed: true };
    }
  );
  const mockRef = mock(() => ({ transaction: mockTransaction }));
  return {
    db: { ref: mockRef } as unknown as Database,
    mockRef,
    mockTransaction,
  };
}

function makeDbForReset() {
  const mockRemove = mock(async () => undefined);
  const mockRef = mock(() => ({ remove: mockRemove }));
  return {
    db: { ref: mockRef } as unknown as Database,
    mockRef,
    mockRemove,
  };
}

describe("FirebaseLockoutAdapter.isLocked", () => {
  test("snap does not exist → returns 0", async () => {
    const { db } = makeDbForIsLocked(false, null);
    const adapter = new FirebaseLockoutAdapter(db);
    expect(await adapter.isLocked("alice@example.com")).toBe(0);
  });

  test("snap exists, lockedUntil is null → returns 0", async () => {
    const { db } = makeDbForIsLocked(true, {
      attemptCount: 2,
      firstAttemptAt: fiveMinutesAgo,
      lockedUntil: null,
      updatedAt: nowStr,
    });
    const adapter = new FirebaseLockoutAdapter(db);
    expect(await adapter.isLocked("alice@example.com")).toBe(0);
  });

  test("snap exists, lockedUntil in the past → returns 0", async () => {
    const pastLock = NOW.subtract({ seconds: 1 }).toString();
    const { db } = makeDbForIsLocked(true, {
      attemptCount: 5,
      firstAttemptAt: fiveMinutesAgo,
      lockedUntil: pastLock,
      updatedAt: nowStr,
    });
    const adapter = new FirebaseLockoutAdapter(db);
    expect(await adapter.isLocked("alice@example.com")).toBe(0);
  });

  test("snap exists, lockedUntil 42 s in the future → returns ceil(42)", async () => {
    const futureLock = NOW.add({ seconds: 42 }).toString();
    const { db } = makeDbForIsLocked(true, {
      attemptCount: 5,
      firstAttemptAt: fiveMinutesAgo,
      lockedUntil: futureLock,
      updatedAt: nowStr,
    });
    const adapter = new FirebaseLockoutAdapter(db);
    const result = await adapter.isLocked("alice@example.com");

    expect(result).toBeGreaterThanOrEqual(41);
    expect(result).toBeLessThanOrEqual(43);
  });
});

describe("FirebaseLockoutAdapter.recordAttempt", () => {
  test("no existing record (null) → creates count=1, returns false", async () => {
    const { db } = makeDbForRecordAttempt(null);
    const adapter = new FirebaseLockoutAdapter(db);
    const locked = await adapter.recordAttempt("alice@example.com");
    expect(locked).toBe(false);
  });

  test("existing record, first attempt > 15 min ago → resets window, returns false", async () => {
    const { db } = makeDbForRecordAttempt({
      attemptCount: 3,
      firstAttemptAt: twentyMinutesAgo,
      lockedUntil: null,
      updatedAt: nowStr,
    });
    const adapter = new FirebaseLockoutAdapter(db);
    const locked = await adapter.recordAttempt("alice@example.com");
    expect(locked).toBe(false);
  });

  test("within window, count < MAX_ATTEMPTS → increments count, returns false", async () => {
    const { db } = makeDbForRecordAttempt({
      attemptCount: 2,
      firstAttemptAt: fiveMinutesAgo,
      lockedUntil: null,
      updatedAt: nowStr,
    });
    const adapter = new FirebaseLockoutAdapter(db);
    const locked = await adapter.recordAttempt("alice@example.com");
    expect(locked).toBe(false);
  });

  test("within window, count reaches MAX_ATTEMPTS (5) → sets lockedUntil, returns true", async () => {
    const { db } = makeDbForRecordAttempt({
      attemptCount: 4,
      firstAttemptAt: fiveMinutesAgo,
      lockedUntil: null,
      updatedAt: nowStr,
    });
    const adapter = new FirebaseLockoutAdapter(db);
    const locked = await adapter.recordAttempt("alice@example.com");
    expect(locked).toBe(true);
  });
});

describe("FirebaseLockoutAdapter.reset", () => {
  test("calls db.ref(login_attempts/<key>).remove()", async () => {
    const { db, mockRef, mockRemove } = makeDbForReset();
    const adapter = new FirebaseLockoutAdapter(db);
    await adapter.reset("alice@example.com");
    expect(mockRef).toHaveBeenCalledTimes(1);
    const refPath: string = (mockRef as ReturnType<typeof mock>).mock.calls[0]?.[0];

    expect(refPath).toMatch(/^login_attempts\/[A-Za-z0-9_-]+$/);
    expect(mockRemove).toHaveBeenCalledTimes(1);
  });
});
