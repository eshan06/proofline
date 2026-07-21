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
    // `next start` is a real production boot, so the startup env validator runs.
    // Satisfy it self-contained-ly: a throwaway (non-dev-fallback) invite secret
    // and an explicit localhost app URL, so e2e needs no .env.local and works
    // identically on a fresh clone and in CI.
    env: {
      INVITE_SECRET: process.env.INVITE_SECRET ?? "e2e-smoke-only-invite-secret-not-for-prod",
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    },
  },
});
