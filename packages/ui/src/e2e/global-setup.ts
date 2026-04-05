import type { FullConfig } from "@playwright/test";

// Global setup runs once before all test suites.
// Verifies that Storybook is accessible before running any tests.
async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use?.baseURL ?? "http://localhost:6006";
  const maxRetries = 30;
  const retryInterval = 2_000;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(baseURL);
      if (res.ok) {
        console.log(`[global-setup] Storybook is ready at ${baseURL}`);
        return;
      }
    } catch {
      // Storybook not ready yet
    }
    if (i < maxRetries - 1) {
      await new Promise((r) => setTimeout(r, retryInterval));
    }
  }

  throw new Error(
    `[global-setup] Storybook did not start within ${(maxRetries * retryInterval) / 1_000}s at ${baseURL}`
  );
}

export default globalSetup;
