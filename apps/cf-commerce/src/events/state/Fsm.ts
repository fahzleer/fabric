import { Either } from "effect";

export type OrderState =
  | "pending"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled";

export type OrderEvent =
  | "PaymentReceived"
  | "StartProcessing"
  | "MarkShipped"
  | "MarkDelivered"
  | "RequestCancellation";

export type TransitionError =
  | { readonly _tag: "InvalidTransition"; readonly from: OrderState; readonly via: OrderEvent }
  | { readonly _tag: "AlreadyInFinalState"; readonly state: OrderState };

export const transition = (
  state: OrderState,
  event: OrderEvent
): Either.Either<OrderState, TransitionError> => {
  if (state === "delivered" || state === "cancelled") {
    return Either.left({ _tag: "AlreadyInFinalState", state });
  }

  const transitions: Partial<Record<OrderState, Partial<Record<OrderEvent, OrderState>>>> = {
    pending: { PaymentReceived: "confirmed", RequestCancellation: "cancelled" },
    confirmed: { StartProcessing: "processing", RequestCancellation: "cancelled" },
    processing: { MarkShipped: "shipped", RequestCancellation: "cancelled" },
    shipped: { MarkDelivered: "delivered" },
  };

  const next = transitions[state]?.[event];
  if (next !== undefined) return Either.right(next);
  return Either.left({ _tag: "InvalidTransition", from: state, via: event });
};

export const isFinal = (state: OrderState): boolean =>
  state === "delivered" || state === "cancelled";

export interface Fsm {
  readonly id: string;
  readonly state: OrderState;
  readonly history: ReadonlyArray<readonly [OrderState, OrderEvent, OrderState]>;
}

export interface FsmSnapshot {
  readonly id: string;
  readonly state: OrderState;
  readonly history: ReadonlyArray<readonly [OrderState, OrderEvent, OrderState]>;
}

export const newFsm = (id: string): Fsm => ({ id, state: "pending", history: [] });

export const applyFsm = (fsm: Fsm, event: OrderEvent): Either.Either<Fsm, TransitionError> =>
  Either.map(transition(fsm.state, event), (next) => ({
    ...fsm,
    state: next,
    history: [...fsm.history, [fsm.state, event, next] as const],
  }));

export const replayFsm = (
  id: string,
  events: ReadonlyArray<OrderEvent>
): Either.Either<Fsm, TransitionError> =>
  events.reduce(
    (acc: Either.Either<Fsm, TransitionError>, event) =>
      Either.flatMap(acc, (fsm) => applyFsm(fsm, event)),
    Either.right(newFsm(id))
  );

export const saveFsm = (fsm: Fsm): FsmSnapshot => ({ ...fsm });

export const restoreFsm = (snapshot: FsmSnapshot): Fsm => ({ ...snapshot });

export const snapshotState = (snapshot: FsmSnapshot): OrderState => snapshot.state;

export const snapshotSteps = (snapshot: FsmSnapshot): number => snapshot.history.length;

export interface FsmStorage {
  saveSnapshot(snap: FsmSnapshot): Promise<void>;
  loadSnapshot(id: string): Promise<FsmSnapshot | null>;
  deleteSnapshots(id: string): Promise<void>;
}

export const inMemoryStorage = (): FsmStorage => {
  const store = new Map<string, FsmSnapshot>();
  return {
    async saveSnapshot(snap) {
      store.set(snap.id, snap);
    },
    async loadSnapshot(id) {
      return store.get(id) ?? null;
    },
    async deleteSnapshots(id) {
      store.delete(id);
    },
  };
};

export const applyWithStorage = async (
  fsm: Fsm,
  event: OrderEvent,
  storage: FsmStorage
): Promise<Either.Either<Fsm, string>> => {
  const result = applyFsm(fsm, event);
  if (Either.isLeft(result)) {
    const err = result.left;
    const msg =
      err._tag === "InvalidTransition"
        ? `invalid transition from ${err.from} via ${err.via}`
        : `already in final state: ${err.state}`;
    return Either.left(msg);
  }
  try {
    await storage.saveSnapshot(saveFsm(result.right));
    return Either.right(result.right);
  } catch (e) {
    return Either.left(`storage error: ${String(e)}`);
  }
};
