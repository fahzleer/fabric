import { describe, expect, mock, test } from "bun:test";
import type {
  NotificationPort,
  OrderPlacedPayload,
} from "../../application/ports/notification.port";
import { NotificationService } from "./notification.service";

const PAYLOAD: OrderPlacedPayload = {
  orderId: "order-001",
  userId: "user-001",
  userEmail: "test@example.com",
  totalCents: 50000,
  currency: "THB",
  itemCount: 2,
};

describe("NotificationService", () => {
  test("calls all adapters with the same payload", async () => {
    const calls: string[] = [];

    const adapterA: NotificationPort = {
      notifyOrderPlaced: mock(async () => {
        calls.push("A");
      }),
    };
    const adapterB: NotificationPort = {
      notifyOrderPlaced: mock(async () => {
        calls.push("B");
      }),
    };

    const service = new NotificationService([adapterA, adapterB]);
    await service.notifyOrderPlaced(PAYLOAD);

    expect(calls).toContain("A");
    expect(calls).toContain("B");
    expect(adapterA.notifyOrderPlaced).toHaveBeenCalledWith(PAYLOAD);
    expect(adapterB.notifyOrderPlaced).toHaveBeenCalledWith(PAYLOAD);
  });

  test("one adapter failure does not stop the others", async () => {
    const successCalled = { called: false };

    const failing: NotificationPort = {
      notifyOrderPlaced: mock(async () => {
        throw new Error("adapter down");
      }),
    };
    const succeeding: NotificationPort = {
      notifyOrderPlaced: mock(async () => {
        successCalled.called = true;
      }),
    };

    const service = new NotificationService([failing, succeeding]);
    await expect(service.notifyOrderPlaced(PAYLOAD)).resolves.toBeUndefined();
    expect(successCalled.called).toBe(true);
  });

  test("resolves immediately when no adapters are configured", async () => {
    const service = new NotificationService([]);
    await expect(service.notifyOrderPlaced(PAYLOAD)).resolves.toBeUndefined();
  });
});
