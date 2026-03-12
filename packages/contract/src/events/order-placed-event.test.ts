import { describe, expect, it } from "bun:test";
import golden from "./order-placed-event.golden.json";

interface OrderPlacedPayload {
  readonly orderId: string;
  readonly userId: string;
  readonly totalAmountInCents: number;
  readonly currency: string;
  readonly paymentToken: string | null | undefined;
}

interface OrderPlacedEvent {
  readonly _type: string;
  readonly _version: number;
  readonly eventId: string;
  readonly occurredAt: string;
  readonly payload: OrderPlacedPayload;
}

function buildEvent(partial?: Partial<OrderPlacedPayload>): OrderPlacedEvent {
  return {
    _type: "OrderPlaced",
    _version: 1,
    eventId: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    occurredAt: "2024-01-15T10:30:00.000Z",
    payload: {
      orderId: "ord-contract-test-1",
      userId: "usr-contract-test-1",
      totalAmountInCents: 150_000,
      currency: "THB",
      paymentToken: "tok_test_abc123",
      ...partial,
    },
  };
}

describe("OrderPlaced event — TS↔Scala wire contract", () => {
  it("golden fixture matches the TypeScript OrderPlacedEvent shape", () => {
    const event: OrderPlacedEvent = golden;

    expect(event._type).toBe("OrderPlaced");
    expect(event._version).toBe(1);
    expect(typeof event.eventId).toBe("string");
    expect(typeof event.occurredAt).toBe("string");
  });

  it("payload fields have correct types", () => {
    const { payload } = golden;

    expect(typeof payload.orderId).toBe("string");
    expect(typeof payload.userId).toBe("string");
    expect(typeof payload.totalAmountInCents).toBe("number");
    expect(Number.isInteger(payload.totalAmountInCents)).toBe(true);
    expect(typeof payload.currency).toBe("string");
    expect(payload.currency.length).toBe(3);
  });

  it("paymentToken is optional — null is valid (unauthenticated flow)", () => {
    const event = buildEvent({ paymentToken: null });
    expect(JSON.parse(JSON.stringify(event)).payload.paymentToken).toBeNull();
  });

  it("paymentToken is optional — undefined omits the key (also valid)", () => {
    const event = buildEvent({ paymentToken: undefined });
    const serialised = JSON.parse(JSON.stringify(event)) as OrderPlacedEvent;
    expect("paymentToken" in serialised.payload).toBe(false);
  });

  it("serialised golden round-trips without data loss", () => {
    const serialised = JSON.stringify(golden);
    const parsed = JSON.parse(serialised) as OrderPlacedEvent;

    expect(parsed._type).toBe(golden._type);
    expect(parsed._version).toBe(golden._version);
    expect(parsed.eventId).toBe(golden.eventId);
    expect(parsed.payload.orderId).toBe(golden.payload.orderId);
    expect(parsed.payload.totalAmountInCents).toBe(golden.payload.totalAmountInCents);
  });
});
