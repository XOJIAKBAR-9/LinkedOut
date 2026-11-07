import { defineConfig, devices } from "@playwright/test";

/**
 * E2E tests run against a real API + database.
 * Start both first (`npm run dev` at the repo root, with a seeded DB), then `npm run test:e2e`.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:5173",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
