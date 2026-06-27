import { defineConfig, devices } from "@playwright/test";

// E2E runs against a PRODUCTION build so the service worker (production-only)
// is exercised. The webServer builds then starts the app on PORT.
const PORT = 3210;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: `npm run build && npm run start -- -p ${PORT}`,
    url: baseURL,
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
  },
});
