import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    // Integration tests hit a live server + DB and can be slower than the
    // vitest default timeout, especially the full checkout flow.
    testTimeout: 30000,
    hookTimeout: 30000,
  },
})
