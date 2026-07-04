import { describe, expect, test } from "bun:test";
import type { Database } from "firebase-admin/database";
import { FirebasePayoutRepository } from "./firebase-payout.repository";

type RawRecord = {
  id: string;
  userId: string;
  requestedAt: string;
  amountCents: number;
  bankInfo: string;
  status: "pending" | "approved" | "rejected";
  resolvedAt: string | null;
  adminNote: string | null;
};

function makeRecord(overrides: Partial<RawRecord> = {}): RawRecord {
  return {
    id: "payout-1",
    userId: "user-1",
    requestedAt: "2026-01-01T00:00:00.000Z",
    amountCents: 50000,
    bankInfo: "Test Bank — 123 — Jane Doe",
    status: "pending",
    resolvedAt: null,
    adminNote: null,
    ...overrides,
  };
}

function makeDb(records: RawRecord[]) {
  const db = {
    ref(path: string) {
      if (path === "payoutRequests") {
        return {
          async once(_event: string) {
            return {
              forEach(cb: (snap: { val: () => RawRecord }) => void) {
                for (const r of records) cb({ val: () => r });
              },
            };
          },
        };
      }
      return {};
    },
  } as unknown as Database;
  return db;
}

describe("FirebasePayoutRepository.listRecent", () => {
  test("returns all statuses, newest requestedAt first", async () => {
    const db = makeDb([
      makeRecord({ id: "p1", requestedAt: "2026-01-01T00:00:00.000Z", status: "pending" }),
      makeRecord({
        id: "p2",
        requestedAt: "2026-01-03T00:00:00.000Z",
        status: "rejected",
        adminNote: "wrong bank details",
      }),
      makeRecord({ id: "p3", requestedAt: "2026-01-02T00:00:00.000Z", status: "approved" }),
    ]);
    const repo = new FirebasePayoutRepository(db);

    const result = await repo.listRecent(50);

    expect(result._tag).toBe("Ok");
    if (result._tag === "Ok") {
      expect(result.value.map((r) => r.id)).toEqual(["p2", "p3", "p1"]);
    }
  });

  test("includes adminNote for resolved payouts", async () => {
    const db = makeDb([
      makeRecord({ id: "p1", status: "rejected", adminNote: "insufficient balance" }),
    ]);
    const repo = new FirebasePayoutRepository(db);

    const result = await repo.listRecent(50);

    expect(result._tag).toBe("Ok");
    if (result._tag === "Ok") {
      const note = result.value[0]?.adminNote;
      expect(note?._tag).toBe("Some");
      if (note?._tag === "Some") expect(note.value).toBe("insufficient balance");
    }
  });

  test("respects the limit parameter", async () => {
    const records = Array.from({ length: 5 }, (_, i) =>
      makeRecord({ id: `p${i}`, requestedAt: `2026-01-0${i + 1}T00:00:00.000Z` })
    );
    const db = makeDb(records);
    const repo = new FirebasePayoutRepository(db);

    const result = await repo.listRecent(2);

    expect(result._tag).toBe("Ok");
    if (result._tag === "Ok") expect(result.value.length).toBe(2);
  });

  test("empty payoutRequests node returns an empty list", async () => {
    const db = makeDb([]);
    const repo = new FirebasePayoutRepository(db);

    const result = await repo.listRecent(50);

    expect(result._tag).toBe("Ok");
    if (result._tag === "Ok") expect(result.value).toEqual([]);
  });
});
