import { type Effect, ManagedRuntime } from "effect";

// ── effectHandler ─────────────────────────────────────────────────────────────
// Wraps an Effect program as an async Elysia handler function.
// The runtime is provided via Elysia's decorate("runtime", ...) pattern.
//
// Usage:
//   app.decorate("runtime", runtime)
//   app.get("/ping", ({ runtime }) => run(runtime, Effect.succeed({ ok: true })))

export const run = <A, E, R>(
  runtime: ManagedRuntime.ManagedRuntime<R, never>,
  effect: Effect.Effect<A, E, R>
): Promise<A> => runtime.runPromise(effect);

// ── effectHandler ─────────────────────────────────────────────────────────────
// Higher-order helper: given a function from Elysia context → Effect,
// returns an async function suitable as an Elysia route handler.
//
// Usage:
//   app.get("/users/:id", effectHandler(({ params, runtime }) =>
//     Effect.gen(function* () {
//       const svc = yield* UserService
//       return yield* svc.findById(params.id)
//     })
//   ))

export const effectHandler =
  <Ctx extends { runtime: ManagedRuntime.ManagedRuntime<R, never> }, A, E, R>(
    fn: (ctx: Ctx) => Effect.Effect<A, E, R>
  ) =>
  (ctx: Ctx): Promise<A> =>
    ctx.runtime.runPromise(fn(ctx));
