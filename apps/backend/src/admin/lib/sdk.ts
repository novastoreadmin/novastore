import Medusa from "@medusajs/js-sdk"

// `__BACKEND_URL__` is injected by the admin bundler at build time.
declare const __BACKEND_URL__: string | undefined

const baseUrl =
  (typeof __BACKEND_URL__ !== "undefined" && __BACKEND_URL__) ||
  (typeof window !== "undefined" ? window.location.origin : "http://localhost:9000")

// Reuses the admin's existing session, so custom /admin/* routes are authenticated.
export const sdk = new Medusa({
  baseUrl,
  auth: { type: "session" },
})
