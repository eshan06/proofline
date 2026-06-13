import { defineConfig, devices } from "@playwright/test";

/**
 * E2E config. Builds-then-starts the production server and drives the critical
 * paths in Chromium at the app's target desktop width. Kept lean — these are
 * smoke tests that guard the happy path, not an exhaustive suite (the data /
 * engine / confidence / palette logic is covered by the Vitest unit tests).
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3000",
    viewport: { width: 1440, height: 900 },
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run start -- -p 3000",
    url: "http://localhost:3000/api/health",
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
});
