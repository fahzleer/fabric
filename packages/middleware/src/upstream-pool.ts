// ── UpstreamPool ──────────────────────────────────────────────────────────────
//
// Round-robin load balancer with per-upstream circuit breaking.
//
// States per upstream:
//   Closed   — healthy; receives traffic in rotation
//   Open     — circuit tripped; skipped until cooldown expires
//   HalfOpen — cooldown elapsed; next pick probes this upstream;
//              success → Closed, failure → Open (resets timer)
//
// Usage:
//   const pool = UpstreamPool.fromEnv("ORDER_URL", "http://localhost:4001");
//   const url  = pool.pick();               // round-robin, skips open circuits
//   pool.report(url, response.status < 500); // update circuit state
//   pool.allUrls();                          // for health probes

export interface UpstreamPoolOptions {
  /** Consecutive failures before opening the circuit. Default: 5 */
  threshold?: number;
  /** Milliseconds to wait in Open before transitioning to HalfOpen. Default: 30 000 */
  cooldownMs?: number;
}

export type CircuitStatus = "closed" | "open" | "half-open";

export interface UpstreamStats {
  url:      string;
  status:   CircuitStatus;
  failures: number;
}

interface UpstreamState {
  url:      string;
  failures: number;
  openedAt: number | null; // null = Closed
  threshold:  number;
  cooldownMs: number;
}

export class UpstreamPool {
  private readonly states: UpstreamState[];
  /** Monotonically increasing cursor for round-robin */
  private cursor = 0;

  constructor(urls: string[], opts: UpstreamPoolOptions = {}) {
    if (urls.length === 0) throw new Error("UpstreamPool requires at least one URL");
    const threshold  = opts.threshold  ?? 5;
    const cooldownMs = opts.cooldownMs ?? 30_000;
    this.states = urls.map((url) => ({ url, failures: 0, openedAt: null, threshold, cooldownMs }));
  }

  /**
   * Build a pool from a comma-separated environment variable.
   * Falls back to `fallback` when the variable is unset or empty.
   *
   * @example
   * // Single instance (dev): ORDER_URL=http://localhost:4001
   * // Multiple  (prod):      ORDER_URL=http://order-a:4001,http://order-b:4001
   */
  static fromEnv(envVar: string, fallback: string, opts?: UpstreamPoolOptions): UpstreamPool {
    const raw  = process.env[envVar] ?? fallback;
    const urls = raw.split(",").map((s) => s.trim()).filter(Boolean);
    return new UpstreamPool(urls.length ? urls : [fallback], opts);
  }

  /**
   * Pick the next available upstream via round-robin.
   * Open circuits are skipped; if ALL circuits are open, the one with the
   * oldest `openedAt` timestamp is returned (best-effort probe fallback).
   */
  pick(): string {
    const len = this.states.length;
    for (let i = 0; i < len; i++) {
      const state = this.states[this.cursor % len]!;
      this.cursor = (this.cursor + 1) % len;
      if (this.isAvailable(state)) return state.url;
    }
    // All open — return the one that has been open the longest (soonest to recover)
    return this.states.reduce((best, s) =>
      (s.openedAt ?? 0) < (best.openedAt ?? 0) ? s : best
    ).url;
  }

  /**
   * Report the outcome of a request to a specific upstream.
   * success=true  → reset failure counter, close circuit
   * success=false → increment failures; trip circuit if threshold reached
   */
  report(url: string, success: boolean): void {
    const state = this.states.find((s) => s.url === url);
    if (!state) return;

    if (success) {
      state.failures = 0;
      state.openedAt = null; // → Closed
    } else {
      state.failures += 1;
      if (state.failures >= state.threshold) {
        state.openedAt = Date.now(); // → Open
      }
    }
  }

  /** All upstream URLs (for health probes, metrics). */
  allUrls(): string[] {
    return this.states.map((s) => s.url);
  }

  /** Number of configured upstreams. */
  size(): number {
    return this.states.length;
  }

  /** Diagnostic snapshot of every upstream's circuit state. */
  stats(): UpstreamStats[] {
    return this.states.map((s) => ({
      url:      s.url,
      status:   this.circuitStatus(s),
      failures: s.failures,
    }));
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private isAvailable(state: UpstreamState): boolean {
    if (state.openedAt === null) return true; // Closed
    const elapsed = Date.now() - state.openedAt;
    if (elapsed >= state.cooldownMs) {
      // Cooldown elapsed → transition to HalfOpen; nullify to allow one probe
      state.openedAt = null;
      return true;
    }
    return false; // Open
  }

  private circuitStatus(state: UpstreamState): CircuitStatus {
    if (state.openedAt === null) return "closed";
    const elapsed = Date.now() - state.openedAt;
    return elapsed >= state.cooldownMs ? "half-open" : "open";
  }
}
