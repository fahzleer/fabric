import { describe, it, expect, beforeEach } from "bun:test";
import { UpstreamPool } from "./upstream-pool.ts";

// ── UpstreamPool ──────────────────────────────────────────────────────────────

describe("UpstreamPool", () => {
  describe("constructor", () => {
    it("throws when no URLs are provided", () => {
      expect(() => new UpstreamPool([])).toThrow("at least one URL");
    });

    it("creates a single-upstream pool", () => {
      const pool = new UpstreamPool(["http://a:4001"]);
      expect(pool.size()).toBe(1);
    });

    it("creates a multi-upstream pool", () => {
      const pool = new UpstreamPool(["http://a:4001", "http://b:4001", "http://c:4001"]);
      expect(pool.size()).toBe(3);
    });
  });

  describe("fromEnv", () => {
    it("uses fallback when env var is not set", () => {
      delete process.env["TEST_UPSTREAM"];
      const pool = UpstreamPool.fromEnv("TEST_UPSTREAM", "http://fallback:9000");
      expect(pool.allUrls()).toEqual(["http://fallback:9000"]);
    });

    it("parses a single URL from env var", () => {
      process.env["TEST_UPSTREAM"] = "http://a:4001";
      const pool = UpstreamPool.fromEnv("TEST_UPSTREAM", "http://fallback:9000");
      expect(pool.allUrls()).toEqual(["http://a:4001"]);
      delete process.env["TEST_UPSTREAM"];
    });

    it("parses comma-separated URLs", () => {
      process.env["TEST_UPSTREAM"] = "http://a:4001, http://b:4001 , http://c:4001";
      const pool = UpstreamPool.fromEnv("TEST_UPSTREAM", "http://fallback:9000");
      expect(pool.allUrls()).toEqual(["http://a:4001", "http://b:4001", "http://c:4001"]);
      delete process.env["TEST_UPSTREAM"];
    });
  });

  describe("pick — round-robin", () => {
    let pool: UpstreamPool;

    beforeEach(() => {
      pool = new UpstreamPool(["http://a:4001", "http://b:4001", "http://c:4001"]);
    });

    it("cycles through all upstreams in order", () => {
      expect(pool.pick()).toBe("http://a:4001");
      expect(pool.pick()).toBe("http://b:4001");
      expect(pool.pick()).toBe("http://c:4001");
      expect(pool.pick()).toBe("http://a:4001"); // wraps around
    });

    it("returns the same URL for a single-upstream pool", () => {
      const p = new UpstreamPool(["http://only:4001"]);
      for (let i = 0; i < 5; i++) {
        expect(p.pick()).toBe("http://only:4001");
      }
    });
  });

  describe("report + circuit breaking", () => {
    it("keeps circuit closed after fewer failures than threshold", () => {
      const pool = new UpstreamPool(["http://a:4001"], { threshold: 3 });
      pool.report("http://a:4001", false);
      pool.report("http://a:4001", false);
      // 2 failures, threshold=3 → still closed
      expect(pool.stats()[0]?.status).toBe("closed");
      expect(pool.pick()).toBe("http://a:4001");
    });

    it("opens circuit after reaching threshold", () => {
      const pool = new UpstreamPool(["http://a:4001"], { threshold: 3 });
      pool.report("http://a:4001", false);
      pool.report("http://a:4001", false);
      pool.report("http://a:4001", false); // 3rd → opens
      expect(pool.stats()[0]?.status).toBe("open");
    });

    it("resets failure counter on success", () => {
      const pool = new UpstreamPool(["http://a:4001"], { threshold: 3 });
      pool.report("http://a:4001", false);
      pool.report("http://a:4001", false);
      pool.report("http://a:4001", true); // success resets
      expect(pool.stats()[0]?.status).toBe("closed");
      expect(pool.stats()[0]?.failures).toBe(0);
    });

    it("success closes an open circuit", () => {
      const pool = new UpstreamPool(["http://a:4001"], { threshold: 1 });
      pool.report("http://a:4001", false); // trip
      pool.report("http://a:4001", true);  // recover
      expect(pool.stats()[0]?.status).toBe("closed");
    });
  });

  describe("pick — skips open circuits", () => {
    it("skips tripped upstream and returns healthy one", () => {
      const pool = new UpstreamPool(
        ["http://a:4001", "http://b:4001"],
        { threshold: 1, cooldownMs: 60_000 }
      );
      // Trip 'a'
      pool.report("http://a:4001", false);
      // Even though 'a' is next in round-robin, it's open — should get 'b'
      expect(pool.pick()).toBe("http://b:4001");
      expect(pool.pick()).toBe("http://b:4001"); // still skips 'a'
    });

    it("falls back to best-effort when ALL circuits are open", () => {
      const pool = new UpstreamPool(
        ["http://a:4001", "http://b:4001"],
        { threshold: 1, cooldownMs: 60_000 }
      );
      pool.report("http://a:4001", false);
      pool.report("http://b:4001", false);
      // All open — pick() should return a URL (not throw)
      const url = pool.pick();
      expect(["http://a:4001", "http://b:4001"]).toContain(url);
    });
  });

  describe("half-open transition", () => {
    it("marks circuit as half-open after cooldown elapses", () => {
      const pool = new UpstreamPool(["http://a:4001"], { threshold: 1, cooldownMs: 0 });
      pool.report("http://a:4001", false); // open immediately
      // With cooldownMs=0, any elapsed time >= 0 → half-open
      expect(pool.stats()[0]?.status).toBe("half-open");
    });

    it("allows a probe request after cooldown", () => {
      const pool = new UpstreamPool(["http://a:4001"], { threshold: 1, cooldownMs: 0 });
      pool.report("http://a:4001", false); // trip
      // cooldownMs=0 → immediately half-open → pick() allows it
      expect(pool.pick()).toBe("http://a:4001");
    });
  });

  describe("stats", () => {
    it("returns stats for all upstreams", () => {
      const pool = new UpstreamPool(["http://a:4001", "http://b:4001"], { threshold: 2 });
      pool.report("http://a:4001", false);
      const stats = pool.stats();
      expect(stats).toHaveLength(2);
      expect(stats[0]).toMatchObject({ url: "http://a:4001", status: "closed", failures: 1 });
      expect(stats[1]).toMatchObject({ url: "http://b:4001", status: "closed", failures: 0 });
    });
  });

  describe("allUrls", () => {
    it("returns all configured URLs", () => {
      const pool = new UpstreamPool(["http://a:4001", "http://b:4001"]);
      expect(pool.allUrls()).toEqual(["http://a:4001", "http://b:4001"]);
    });
  });
});
