import { defineConfig, devices } from "@playwright/test";

// The storefront (http://localhost:3000) and backend (http://localhost:9000)
// dev servers are externally managed for this environment — this config does
// NOT start/stop them (no `webServer` block). Run `npm run test:e2e` only
// once both are up.
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 45_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  workers: 1,
  // The backend dev server can restart (e.g. concurrent config edits) and
  // revalidation propagation is a real async wait — a single retry absorbs
  // that without masking genuine assertion failures.
  retries: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
