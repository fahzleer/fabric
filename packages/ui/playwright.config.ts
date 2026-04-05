import { defineConfig, devices } from "@playwright/test";

const IS_CI = !!process.env.CI;

export default defineConfig({
  testDir: "./src",
  testMatch: "**/*.e2e.ts",
  fullyParallel: true,
  forbidOnly: IS_CI,
  retries: IS_CI ? 2 : 0,
  workers: IS_CI ? 1 : undefined,
  reporter: IS_CI ? [["github"], ["html", { open: "never" }]] : [["html", { open: "on-failure" }]],
  globalSetup: "./src/e2e/global-setup.ts",

  // Snapshot configuration for visual regression
  snapshotPathTemplate: "{testDir}/__screenshots__/{projectName}/{arg}{ext}",
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,
      animations: "disabled",
    },
  },

  use: {
    baseURL: IS_CI ? "http://localhost:6007" : "http://localhost:6006",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: IS_CI ? "on-first-retry" : "off",
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
  ],

  webServer: {
    command: IS_CI
      ? "bunx http-server storybook-static --port 6007 --silent"
      : "bun run storybook",
    url: IS_CI ? "http://localhost:6007" : "http://localhost:6006",
    reuseExistingServer: !IS_CI,
    timeout: 120_000,
  },
});
