import { describe, expect, test } from "bun:test";
import { Effect, Option } from "effect";
import type {
  DomainEvent,
  EventMeta,
  OrderPlacedPayload,
  ProductCreatedPayload,
  ProductUpdatedPayload,
} from "../domain/Event.ts";
import type { ProductState } from "../domain/Product.ts";
import {
  type EventOp,
  emit,
  handleOrderPlaced,
  handleProductCreated,
  handleProductUpdated,
  notify,
  persist,
  writeState,
} from "./Dsl.ts";
import { type DryRunCtx, dryRun, emptyDryRunCtx, withSeen, withState } from "./Interpreter.ts";

const run = <A>(ctx: DryRunCtx, program: EventOp<A>) => Effect.runSync(dryRun(ctx, program));

const baseMeta: EventMeta = {
  eventId: "evt-001",
  aggregateId: "prod-001",
  occurredAt: "2025-01-01T00:00:00Z",
  schemaVersion: 1,
};

const createdPayload: ProductCreatedPayload = {
  productId: "prod-001",
  ownerId: "owner-001",
  name: "Test Shirt",
  price: 500,
  currency: "THB",
  category: "apparel",
  status: "active",
  rev: 1,
};

const updatedPayload: ProductUpdatedPayload = {
  productId: "prod-001",
  ownerId: "owner-001",
  name: "Updated Shirt",
  price: 600,
  currency: "THB",
  category: "apparel",
  status: "active",
  rev: 2,
};

const orderPayload: OrderPlacedPayload = {
  orderId: "order-001",
  customerId: "user-001",
  totalInCents: 100000,
  currency: "THB",
  lines: [
    { productId: "prod-001", productName: "Test Shirt", ownerId: "owner-001", quantity: 2, unitPriceCents: 50000 },
    { productId: "prod-002", productName: "Test Hoodie", ownerId: "owner-002", quantity: 1, unitPriceCents: 80000 },
  ],
};

const baseState: ProductState = {
  productId: "prod-001",
  ownerId: "owner-001",
  name: "Test Shirt",
  price: 500,
  currency: "THB",
  category: "apparel",
  status: "active",
  rev: 1,
  lastEventAt: "2025-01-01T00:00:00Z",
};

describe("dryRun — primitive ops", () => {
  test("Pure: returns value, zero ops recorded", () => {
    const program: EventOp<number> = { _tag: "Pure", value: 42 };
    const { value, ops } = run(emptyDryRunCtx(), program);
    expect(value).toBe(42);
    expect(ops).toHaveLength(0);
  });

  test("Persist: records RecordedPersist op", () => {
    const event: DomainEvent = { _tag: "ProductCreated", meta: baseMeta, payload: createdPayload };
    const { ops } = run(emptyDryRunCtx(), persist(event));
    expect(ops).toHaveLength(1);
    expect(ops[0]?._tag).toBe("RecordedPersist");
    if (ops[0]?._tag === "RecordedPersist") {
      expect(ops[0].event._tag).toBe("ProductCreated");
    }
  });

  test("ReadState (absent): records RecordedReadState, returns Option.none()", () => {
    let capturedState: Option.Option<ProductState> | undefined;
    const program = {
      _tag: "ReadState" as const,
      id: "prod-999",
      k: (s: Option.Option<ProductState>): EventOp<void> => {
        capturedState = s;
        return { _tag: "Pure", value: undefined };
      },
    };
    const { ops } = run(emptyDryRunCtx(), program);
    expect(ops[0]?._tag).toBe("RecordedReadState");
    expect(Option.isNone(capturedState as Option.Option<ProductState>)).toBe(true);
  });

  test("ReadState (present): records op, returns Option.some(state)", () => {
    let capturedState: Option.Option<ProductState> | undefined;
    const ctx = withState(emptyDryRunCtx(), "prod-001", baseState);
    const program = {
      _tag: "ReadState" as const,
      id: "prod-001",
      k: (s: Option.Option<ProductState>): EventOp<void> => {
        capturedState = s;
        return { _tag: "Pure", value: undefined };
      },
    };
    run(ctx, program);
    const state = capturedState as Option.Option<ProductState>;
    expect(Option.isSome(state)).toBe(true);
    if (Option.isSome(state)) {
      expect(state.value.name).toBe("Test Shirt");
    }
  });

  test("WriteState: records RecordedWriteState with correct id and state", () => {
    const { ops } = run(emptyDryRunCtx(), writeState("prod-001", baseState));
    expect(ops).toHaveLength(1);
    expect(ops[0]?._tag).toBe("RecordedWriteState");
    if (ops[0]?._tag === "RecordedWriteState") {
      expect(ops[0].id).toBe("prod-001");
      expect(ops[0].state.name).toBe("Test Shirt");
    }
  });

  test("Notify: records RecordedNotify with userId and message", () => {
    const { ops } = run(emptyDryRunCtx(), notify("user-001", "Hello!"));
    expect(ops).toHaveLength(1);
    expect(ops[0]?._tag).toBe("RecordedNotify");
    if (ops[0]?._tag === "RecordedNotify") {
      expect(ops[0].userId).toBe("user-001");
      expect(ops[0].message).toBe("Hello!");
    }
  });

  test("Emit: records RecordedEmit with derived event", () => {
    const derived: DomainEvent = {
      _tag: "ProductCreated",
      meta: baseMeta,
      payload: createdPayload,
    };
    const { ops } = run(emptyDryRunCtx(), emit(derived));
    expect(ops).toHaveLength(1);
    expect(ops[0]?._tag).toBe("RecordedEmit");
  });

  test("IsIdempotent: new event → seen=false recorded", () => {
    let capturedSeen: boolean | undefined;
    const program = {
      _tag: "IsIdempotent" as const,
      eventId: "evt-new",
      k: (seen: boolean): EventOp<void> => {
        capturedSeen = seen;
        return { _tag: "Pure", value: undefined };
      },
    };
    const { ops } = run(emptyDryRunCtx(), program);
    expect(capturedSeen).toBe(false);
    expect(ops[0]?._tag).toBe("RecordedIdempotencyCheck");
    if (ops[0]?._tag === "RecordedIdempotencyCheck") {
      expect(ops[0].result).toBe(false);
    }
  });

  test("IsIdempotent: duplicate event → seen=true recorded", () => {
    let capturedSeen: boolean | undefined;
    const ctx = withSeen(emptyDryRunCtx(), "evt-001");
    const program = {
      _tag: "IsIdempotent" as const,
      eventId: "evt-001",
      k: (seen: boolean): EventOp<void> => {
        capturedSeen = seen;
        return { _tag: "Pure", value: undefined };
      },
    };
    run(ctx, program);
    expect(capturedSeen).toBe(true);
  });
});

describe("handleProductCreated", () => {
  test("new event → [IsIdempotent, WriteState, Persist, Notify] ops in order", () => {
    const { ops } = run(emptyDryRunCtx(), handleProductCreated(baseMeta, createdPayload));
    const tags = ops.map((o) => o._tag);
    expect(tags).toEqual([
      "RecordedIdempotencyCheck",
      "RecordedWriteState",
      "RecordedPersist",
      "RecordedNotify",
    ]);
    const notifyOp = ops.find((o) => o._tag === "RecordedNotify");
    if (notifyOp?._tag === "RecordedNotify") {
      expect(notifyOp.userId).toBe(createdPayload.ownerId);
    }
  });

  test("duplicate event (already seen) → only IsIdempotent, no writes", () => {
    const ctx = withSeen(emptyDryRunCtx(), baseMeta.eventId);
    const { ops } = run(ctx, handleProductCreated(baseMeta, createdPayload));
    expect(ops).toHaveLength(1);
    expect(ops[0]?._tag).toBe("RecordedIdempotencyCheck");
  });
});

describe("handleProductUpdated", () => {
  test("new event, status=active → 5 ops including Notify", () => {
    const ctx = withState(emptyDryRunCtx(), "prod-001", baseState);
    const { ops } = run(ctx, handleProductUpdated(baseMeta, updatedPayload));
    const tags = ops.map((o) => o._tag);
    expect(tags).toContain("RecordedIdempotencyCheck");
    expect(tags).toContain("RecordedReadState");
    expect(tags).toContain("RecordedWriteState");
    expect(tags).toContain("RecordedPersist");
    expect(tags).toContain("RecordedNotify");
  });

  test("duplicate event → only IsIdempotent recorded", () => {
    const ctx = withSeen(emptyDryRunCtx(), baseMeta.eventId);
    const { ops } = run(ctx, handleProductUpdated(baseMeta, updatedPayload));
    expect(ops).toHaveLength(1);
    expect(ops[0]?._tag).toBe("RecordedIdempotencyCheck");
  });
});

describe("handleOrderPlaced", () => {
  test("new order with 2 lines → Persist + 2 Notify ops (fan-out)", () => {
    const { ops } = run(emptyDryRunCtx(), handleOrderPlaced(baseMeta, orderPayload));
    const persistOps = ops.filter((o) => o._tag === "RecordedPersist");
    const notifyOps = ops.filter((o) => o._tag === "RecordedNotify");
    expect(persistOps).toHaveLength(1);
    expect(notifyOps).toHaveLength(2);
  });

  test("duplicate order → only IsIdempotent recorded", () => {
    const ctx = withSeen(emptyDryRunCtx(), baseMeta.eventId);
    const { ops } = run(ctx, handleOrderPlaced(baseMeta, orderPayload));
    expect(ops).toHaveLength(1);
    expect(ops[0]?._tag).toBe("RecordedIdempotencyCheck");
  });
});
