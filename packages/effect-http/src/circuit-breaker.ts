import { Effect, Ref, Schedule, Duration } from "effect";

// ── Circuit Breaker ───────────────────────────────────────────────────────────
//
// States:
//   Closed   — requests flow normally; failure count tracked
//   Open     — all requests fail immediately; reopens after cooldownMs
//   HalfOpen — one probe request allowed; success → Closed, failure → Open
//
// Usage:
//   const cb = makeCircuitBreaker({ threshold: 5, cooldownMs: 30_000 })
//   const result = yield* cb.call(fetchSomeService())

export interface CircuitBreakerOptions {
  /** Number of consecutive failures before opening the circuit. Default: 5 */
  threshold?: number;
  /** Time (ms) to wait before transitioning Open → HalfOpen. Default: 30 000 */
  cooldownMs?: number;
  /** Label for logging. */
  name?: string;
}

type CircuitState =
  | { _tag: "Closed";   failures: number }
  | { _tag: "Open";     openedAt: number }
  | { _tag: "HalfOpen" };

export class CircuitOpenError {
  readonly _tag = "CircuitOpenError";
  constructor(readonly name: string) {}
}

export interface CircuitBreaker {
  readonly call: <A, E>(
    effect: Effect.Effect<A, E, never>
  ) => Effect.Effect<A, E | CircuitOpenError, never>;
  readonly reset: () => Effect.Effect<void, never, never>;
  readonly state: () => Effect.Effect<CircuitState, never, never>;
}

export const makeCircuitBreaker = (opts: CircuitBreakerOptions = {}): Effect.Effect<CircuitBreaker, never, never> => {
  const threshold  = opts.threshold  ?? 5;
  const cooldownMs = opts.cooldownMs ?? 30_000;
  const name       = opts.name       ?? "circuit";

  return Effect.gen(function* () {
    const stateRef = yield* Ref.make<CircuitState>({ _tag: "Closed", failures: 0 });

    const isOpen = (s: CircuitState): boolean => {
      if (s._tag !== "Open") return false;
      return Date.now() - s.openedAt < cooldownMs;
    };

    const call = <A, E>(
      effect: Effect.Effect<A, E, never>
    ): Effect.Effect<A, E | CircuitOpenError, never> =>
      Effect.gen(function* () {
        const s = yield* Ref.get(stateRef);

        if (s._tag === "Open") {
          if (isOpen(s)) {
            return yield* Effect.fail(new CircuitOpenError(name));
          }
          yield* Ref.set(stateRef, { _tag: "HalfOpen" });
        }

        return yield* effect.pipe(
          Effect.tapError(() =>
            Ref.update(stateRef, (prev): CircuitState => {
              const failures = prev._tag === "Closed" ? prev.failures + 1 : threshold;
              if (failures >= threshold) {
                console.warn(`[circuit-breaker:${name}] tripped — circuit OPEN`);
                return { _tag: "Open", openedAt: Date.now() };
              }
              return { _tag: "Closed", failures };
            })
          ),
          Effect.tap(() =>
            Ref.set(stateRef, { _tag: "Closed", failures: 0 })
          )
        );
      });

    const reset = (): Effect.Effect<void, never, never> =>
      Ref.set(stateRef, { _tag: "Closed", failures: 0 });

    const state = (): Effect.Effect<CircuitState, never, never> =>
      Ref.get(stateRef);

    return { call, reset, state } satisfies CircuitBreaker;
  });
};

// ── Retry with circuit breaker ────────────────────────────────────────────────
// Wraps an Effect with exponential backoff + circuit breaker protection.
// Useful for service-to-service HTTP calls.

export const withCircuitBreaker = <A, E>(
  effect: Effect.Effect<A, E, never>,
  cb: CircuitBreaker,
  retries = 3
): Effect.Effect<A, E | CircuitOpenError, never> =>
  cb.call(effect).pipe(
    Effect.retry(
      Schedule.exponential(Duration.millis(100)).pipe(
        Schedule.intersect(Schedule.recurs(retries))
      )
    )
  );
