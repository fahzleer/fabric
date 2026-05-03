import { Effect, Layer, ManagedRuntime } from "effect";

// ── ManagedRuntime wrapper ────────────────────────────────────────────────────
// Creates a long-lived runtime from a Layer.
// Handles graceful shutdown automatically when the process exits.

export const makeRuntime = <R, E>(
  layer: Layer.Layer<R, E>
): Effect.Effect<ManagedRuntime.ManagedRuntime<R, E>, E> =>
  Effect.gen(function* () {
    const runtime = ManagedRuntime.make(layer);
    return runtime;
  });

/**
 * Build runtime and register SIGTERM/SIGINT cleanup.
 * Call this once at service startup.
 *
 * @example
 * const runtime = await bootRuntime(AppLayer)
 * app.decorate("runtime", runtime)
 */
export const bootRuntime = async <R, E>(
  layer: Layer.Layer<R, E>
): Promise<ManagedRuntime.ManagedRuntime<R, E>> => {
  const runtime = ManagedRuntime.make(layer);

  const cleanup = async () => {
    await runtime.dispose();
    process.exit(0);
  };

  process.once("SIGTERM", cleanup);
  process.once("SIGINT", cleanup);

  return runtime;
};
