type CleanupFn = () => Promise<void> | void;

interface CleanupEntry {
  readonly name: string;
  readonly fn: CleanupFn;
}

const cleanupRegistry: CleanupEntry[] = [];

let shutdownRegistered = false;

export function registerCleanup(name: string, fn: CleanupFn): void {
  cleanupRegistry.push({ name, fn });
}

async function runCleanup(signal: string): Promise<void> {
  console.log(`[shutdown] ${signal} received — running ${cleanupRegistry.length} cleanup tasks`);

  const results = await Promise.allSettled(
    cleanupRegistry.map(async ({ name, fn }) => {
      try {
        await fn();
        console.log(`[shutdown] ✓ ${name}`);
      } catch (err) {
        console.error(`[shutdown] ✗ ${name}:`, err);
        throw err;
      }
    })
  );

  const failures = results.filter((r) => r.status === "rejected").length;
  if (failures > 0) {
    console.error(`[shutdown] ${failures} cleanup(s) failed`);
  } else {
    console.log("[shutdown] All cleanup tasks completed");
  }
}

export function setupGracefulShutdown(): void {
  if (shutdownRegistered) return;
  shutdownRegistered = true;

  process.once("SIGTERM", () => {
    runCleanup("SIGTERM").catch((err: unknown) => {
      console.error("[shutdown] SIGTERM cleanup error", err);
    });
  });

  process.once("SIGINT", () => {
    runCleanup("SIGINT").catch((err: unknown) => {
      console.error("[shutdown] SIGINT cleanup error", err);
    });
  });
}
