import { defineConfig, devices } from "@playwright/test";

// Points at the ISOLATED test stack (storefront :3002, backend :9002, its
// own nova_store_test database) - never the dev stack on :3000/:9000, which
// is the real/"production" DB the admin panel points at. Bring the test
// stack up first (see TESTING.md), then `npm run test:e2e`. This config does
// NOT start/stop the test stack itself (no `webServer` block).
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
    baseURL: "http://localhost:3002",
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
