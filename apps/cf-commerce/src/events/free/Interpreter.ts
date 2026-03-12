import { Effect, Option } from "effect";
import type { DomainEvent } from "../domain/Event.ts";
import type { ProductState } from "../domain/Product.ts";
import {
  type Ctx,
  appendEvent,
  checkAndMarkIdempotent,
  publishEvent,
  readProductState,
  sendSse,
  writeProductState,
} from "../store/Firebase.ts";
import type { EventOp } from "./Dsl.ts";

export type AppError =
  | { readonly _tag: "DbError"; readonly message: string }
  | { readonly _tag: "NotFoundError"; readonly id: string }
  | { readonly _tag: "NotifyError"; readonly message: string }
  | { readonly _tag: "InternalError"; readonly message: string };

export type { Ctx };

export const run = <A>(ctx: Ctx, program: EventOp<A>): Effect.Effect<A, AppError> => {
  switch (program._tag) {
    case "Pure":
      return Effect.succeed(program.value);

    case "Persist":
      return Effect.flatMap(
        Effect.tryPromise({
          try: () => appendEvent(ctx, program.event),
          catch: (e) => ({ _tag: "DbError" as const, message: String(e) }),
        }),
        () => run(ctx, program.k(undefined))
      );

    case "ReadState":
      return Effect.flatMap(
        Effect.tryPromise({
          try: () => readProductState(ctx, program.id),
          catch: (e) => ({ _tag: "DbError" as const, message: String(e) }),
        }),
        (maybeState) => run(ctx, program.k(maybeState))
      );

    case "WriteState":
      return Effect.flatMap(
        Effect.tryPromise({
          try: () => writeProductState(ctx, program.id, program.state),
          catch: (e) => ({ _tag: "DbError" as const, message: String(e) }),
        }),
        () => run(ctx, program.k(undefined))
      );

    case "Notify":
      sendSse(ctx, program.userId, program.message);
      return run(ctx, program.k(undefined));

    case "Emit":
      return Effect.flatMap(
        Effect.tryPromise({
          try: () => publishEvent(ctx, program.derived),
          catch: (e) => ({ _tag: "InternalError" as const, message: String(e) }),
        }),
        () => run(ctx, program.k(undefined))
      );

    case "IsIdempotent":
      return Effect.flatMap(
        Effect.tryPromise({
          try: () => checkAndMarkIdempotent(ctx, program.eventId),
          catch: (e) => ({ _tag: "DbError" as const, message: String(e) }),
        }),
        (seen) => run(ctx, program.k(seen))
      );
  }
};

export type RecordedOp =
  | { readonly _tag: "RecordedPersist"; readonly event: DomainEvent }
  | { readonly _tag: "RecordedReadState"; readonly id: string }
  | { readonly _tag: "RecordedWriteState"; readonly id: string; readonly state: ProductState }
  | { readonly _tag: "RecordedNotify"; readonly userId: string; readonly message: string }
  | { readonly _tag: "RecordedEmit"; readonly derived: DomainEvent }
  | {
      readonly _tag: "RecordedIdempotencyCheck";
      readonly eventId: string;
      readonly result: boolean;
    };

export interface DryRunCtx {
  readonly productStates: Map<string, ProductState>;
  readonly seenEvents: ReadonlyArray<string>;
}

export const emptyDryRunCtx = (): DryRunCtx => ({ productStates: new Map(), seenEvents: [] });

export const withState = (ctx: DryRunCtx, id: string, state: ProductState): DryRunCtx => ({
  ...ctx,
  productStates: new Map(ctx.productStates).set(id, state),
});

export const withSeen = (ctx: DryRunCtx, eventId: string): DryRunCtx => ({
  ...ctx,
  seenEvents: [...ctx.seenEvents, eventId],
});

export interface DryRunResult<A> {
  readonly value: A;
  readonly ops: ReadonlyArray<RecordedOp>;
}

const dryRunInner = <A>(
  ctx: DryRunCtx,
  program: EventOp<A>,
  opsAcc: RecordedOp[]
): Effect.Effect<DryRunResult<A>, AppError> => {
  switch (program._tag) {
    case "Pure":
      return Effect.succeed({ value: program.value, ops: [...opsAcc].reverse() });

    case "Persist": {
      const op: RecordedOp = { _tag: "RecordedPersist", event: program.event };
      return dryRunInner(ctx, program.k(undefined), [op, ...opsAcc]);
    }

    case "ReadState": {
      const op: RecordedOp = { _tag: "RecordedReadState", id: program.id };
      const state = ctx.productStates.get(program.id);
      const maybeState = state !== undefined ? Option.some(state) : Option.none();
      return dryRunInner(ctx, program.k(maybeState), [op, ...opsAcc]);
    }

    case "WriteState": {
      const op: RecordedOp = { _tag: "RecordedWriteState", id: program.id, state: program.state };
      const updated: DryRunCtx = {
        ...ctx,
        productStates: new Map(ctx.productStates).set(program.id, program.state),
      };
      return dryRunInner(updated, program.k(undefined), [op, ...opsAcc]);
    }

    case "Notify": {
      const op: RecordedOp = {
        _tag: "RecordedNotify",
        userId: program.userId,
        message: program.message,
      };
      return dryRunInner(ctx, program.k(undefined), [op, ...opsAcc]);
    }

    case "Emit": {
      const op: RecordedOp = { _tag: "RecordedEmit", derived: program.derived };
      return dryRunInner(ctx, program.k(undefined), [op, ...opsAcc]);
    }

    case "IsIdempotent": {
      const seen = ctx.seenEvents.includes(program.eventId);
      const op: RecordedOp = {
        _tag: "RecordedIdempotencyCheck",
        eventId: program.eventId,
        result: seen,
      };
      return dryRunInner(ctx, program.k(seen), [op, ...opsAcc]);
    }
  }
};

export const dryRun = <A>(
  ctx: DryRunCtx,
  program: EventOp<A>
): Effect.Effect<DryRunResult<A>, AppError> => dryRunInner(ctx, program, []);
