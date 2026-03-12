import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Effect } from "effect";
import type { EventEnvelope } from "../../application/ports/event-publisher.port";

const mockFetch = mock(
  async (..._args: unknown[]): Promise<Response> => new Response(null, { status: 200 })
);

(globalThis as Record<string, unknown>).fetch = mockFetch;

import { publishEventDaemon, publishEventEffect } from "./effect-event-publisher";

const EVENT: EventEnvelope = {
  event_id: "evt-001",
  event_type: "OrderPlaced",
  aggregate_id: "order-001",
  occurred_at: "2025-01-01T00:00:00Z",
  schema_version: 1,
  payload: { order_id: "order-001", total_cents: 100000 },
};

describe("publishEventEffect — resilient publish with retry", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  test("success: fetch called once with correct JSON body", async () => {
    mockFetch.mockImplementation(async () => new Response(null, { status: 200 }));

    await Effect.runPromise(publishEventEffect(EVENT, "http://localhost:8082"));

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = (mockFetch as ReturnType<typeof mock>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toBe("http://localhost:8082/events");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(body.event_id).toBe("evt-001");
    expect(body.event_type).toBe("OrderPlaced");
  });

  test("persistent failure: Effect<void,never> always resolves (errors swallowed)", async () => {
    mockFetch.mockImplementation(async () => {
      throw new Error("ECONNREFUSED");
    });

    await Effect.runPromise(publishEventEffect(EVENT, "http://localhost:8082"));
    expect(mockFetch).toHaveBeenCalled();
  });

  test("transient failure then success: retries once and eventually publishes", async () => {
    let calls = 0;
    mockFetch.mockImplementation(async () => {
      calls++;
      if (calls === 1) throw new Error("ECONNREFUSED");
      return new Response(null, { status: 200 });
    });

    await Effect.runPromise(publishEventEffect(EVENT, "http://localhost:8082"));
    expect(calls).toBe(2);
  });
});

describe("publishEventDaemon — forkDaemon (fire-and-forget)", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  test("returns Effect<void,never> immediately; daemon calls fetch in background", async () => {
    mockFetch.mockImplementation(async () => new Response(null, { status: 200 }));

    await Effect.runPromise(publishEventDaemon(EVENT, "http://localhost:8082"));

    await new Promise((r) => setTimeout(r, 100));
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
