import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run against a real stack (frontend + backend + Postgres/pgvector + Ollama):
 *   docker compose up -d && ./docker/pull-models.sh
 *   npm run test:e2e
 * Local models are slow on CPU, so timeouts are generous.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 15 * 60 * 1000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }],
});
