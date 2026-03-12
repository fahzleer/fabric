import { describe, expect, test } from "bun:test";
import { makeDomainEvent, makePaymentFailed, makePaymentProcessed } from "./events";
import { InMemoryEventBus } from "./in-memory-event-bus";

type TestPayload = { readonly message: string };
const makeTestEvent = (message: string) => makeDomainEvent("TestEvent", { message });

describe("InMemoryEventBus", () => {
  describe("subscribe and publish", () => {
    test("calls subscribed handler when event is published", async () => {
      const bus = new InMemoryEventBus();
      const received: TestPayload[] = [];
      bus.subscribe("TestEvent", async (payload: TestPayload) => {
        received.push(payload);
      });
      await bus.publish(makeTestEvent("hello"));
      expect(received).toHaveLength(1);
      expect(received[0]?.message).toBe("hello");
    });

    test("calls multiple handlers for the same event type", async () => {
      const bus = new InMemoryEventBus();
      const log: string[] = [];
      bus.subscribe("TestEvent", async (payload: TestPayload) => {
        log.push(`handler1: ${payload.message}`);
      });
      bus.subscribe("TestEvent", async (payload: TestPayload) => {
        log.push(`handler2: ${payload.message}`);
      });
      await bus.publish(makeTestEvent("world"));
      expect(log).toHaveLength(2);
      expect(log).toContain("handler1: world");
      expect(log).toContain("handler2: world");
    });

    test("does not call handlers for different event types", async () => {
      const bus = new InMemoryEventBus();
      const received: unknown[] = [];
      bus.subscribe("OtherEvent", async (payload) => {
        received.push(payload);
      });
      await bus.publish(makeTestEvent("ignored"));
      expect(received).toHaveLength(0);
    });

    test("handler receives the event payload (not the full event)", async () => {
      const bus = new InMemoryEventBus();
      let capturedPayload: TestPayload | undefined;
      bus.subscribe("TestEvent", async (payload: TestPayload) => {
        capturedPayload = payload;
      });
      await bus.publish(makeTestEvent("payload-check"));
      expect(capturedPayload).toEqual({ message: "payload-check" });
    });

    test("multiple publishes each trigger handlers", async () => {
      const bus = new InMemoryEventBus();
      let count = 0;
      bus.subscribe("TestEvent", async () => {
        count++;
      });
      await bus.publish(makeTestEvent("first"));
      await bus.publish(makeTestEvent("second"));
      await bus.publish(makeTestEvent("third"));
      expect(count).toBe(3);
    });

    test("publish with no subscribers resolves without error", async () => {
      const bus = new InMemoryEventBus();
      await expect(bus.publish(makeTestEvent("lonely"))).resolves.toBeUndefined();
    });
  });

  describe("error handling", () => {
    test("publish resolves even when all handlers throw", async () => {
      const bus = new InMemoryEventBus();
      bus.subscribe("TestEvent", async () => {
        throw new Error("fail-1");
      });
      bus.subscribe("TestEvent", async () => {
        throw new Error("fail-2");
      });
      await expect(bus.publish(makeTestEvent("boom"))).rejects.toThrow();
    });

    test("non-throwing handlers still run when one handler throws", async () => {
      const bus = new InMemoryEventBus();
      const log: string[] = [];
      bus.subscribe("TestEvent", async () => {
        log.push("before-throw");
        throw new Error("oops");
      });
      bus.subscribe("TestEvent", async () => {
        log.push("after-throw");
      });
      await bus.publish(makeTestEvent("mixed")).catch(() => undefined);
      expect(log).toContain("before-throw");
      expect(log).toContain("after-throw");
    });
  });

  describe("event metadata", () => {
    test("makeDomainEvent sets _type correctly", () => {
      const event = makeDomainEvent("OrderPlaced", { orderId: "123" });
      expect(event._type).toBe("OrderPlaced");
    });

    test("makeDomainEvent sets _version to 1", () => {
      const event = makeDomainEvent("OrderPlaced", { orderId: "123" });
      expect(event._version).toBe(1);
    });

    test("makeDomainEvent generates unique eventIds", () => {
      const e1 = makeDomainEvent("TestEvent", {});
      const e2 = makeDomainEvent("TestEvent", {});
      expect(e1.eventId).not.toBe(e2.eventId);
    });

    test("makeDomainEvent sets occurredAt as ISO string", () => {
      const event = makeDomainEvent("TestEvent", {});
      expect(() => new Date(event.occurredAt)).not.toThrow();
      expect(event.occurredAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    test("makeDomainEvent embeds payload", () => {
      const payload = { orderId: "order-abc", amount: 999 };
      const event = makeDomainEvent("OrderPlaced", payload);
      expect(event.payload).toEqual(payload);
    });
  });

  describe("payment domain events", () => {
    test("makePaymentProcessed creates PaymentProcessed event with correct type", () => {
      const payload = {
        orderId: "order-1",
        paymentId: "pay-1",
        amountInCents: 10000,
        currency: "THB",
        processedAt: new Date().toISOString(),
      };
      const event = makePaymentProcessed(payload);
      expect(event._type).toBe("PaymentProcessed");
      expect(event._version).toBe(1);
      expect(event.payload).toEqual(payload);
      expect(typeof event.eventId).toBe("string");
      expect(typeof event.occurredAt).toBe("string");
    });

    test("makePaymentFailed creates PaymentFailed event with correct type", () => {
      const payload = {
        orderId: "order-2",
        reason: "insufficient funds",
        failedAt: new Date().toISOString(),
      };
      const event = makePaymentFailed(payload);
      expect(event._type).toBe("PaymentFailed");
      expect(event._version).toBe(1);
      expect(event.payload).toEqual(payload);
      expect(typeof event.eventId).toBe("string");
    });

    test("makePaymentProcessed and makePaymentFailed generate unique eventIds", () => {
      const now = new Date().toISOString();
      const processed = makePaymentProcessed({
        orderId: "o1",
        paymentId: "p1",
        amountInCents: 500,
        currency: "THB",
        processedAt: now,
      });
      const failed = makePaymentFailed({ orderId: "o2", reason: "declined", failedAt: now });
      expect(processed.eventId).not.toBe(failed.eventId);
    });
  });
});
