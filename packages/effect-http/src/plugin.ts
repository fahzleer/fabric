import { Layer, ManagedRuntime } from "effect";
import Elysia from "elysia";
import { bootRuntime } from "./runtime.ts";

// ── effectPlugin ──────────────────────────────────────────────────────────────
// Creates an Elysia plugin that:
// 1. Builds a ManagedRuntime from the given Layer at plugin creation time
// 2. Decorates every handler context with `runtime`
// 3. Cleans up on SIGTERM / SIGINT
//
// Usage:
//   const AppLayer = Layer.mergeAll(OrderService.Default, Database.layer(...))
//
//   const app = new Elysia()
//     .use(await effectPlugin(AppLayer))
//     .get("/orders", effectHandler(({ runtime }) =>
//       Effect.gen(function* () {
//         const svc = yield* OrderService
//         return yield* svc.listAll()
//       })
//     ))

export const effectPlugin = async <R, E>(
  layer: Layer.Layer<R, E>
): Promise<Elysia> => {
  const runtime = await bootRuntime(layer);
  // Cast required: Elysia's generic type system tracks decorations in type
  // params that differ from the base `Elysia` type. We widen intentionally
  // because consumers capture `runtime` from the decorated context.
  return new Elysia({ name: "@fabric/effect-runtime" }).decorate(
    "runtime",
    runtime as ManagedRuntime.ManagedRuntime<R, never>
  ) as unknown as Elysia;
};

// ── effectPluginFromRuntime ───────────────────────────────────────────────────
// Use when you already have a runtime (e.g. shared across multiple Elysia apps).

export const effectPluginFromRuntime = <R>(
  runtime: ManagedRuntime.ManagedRuntime<R, never>
): Elysia =>
  new Elysia({ name: "@fabric/effect-runtime" }).decorate(
    "runtime",
    runtime
  ) as unknown as Elysia;
