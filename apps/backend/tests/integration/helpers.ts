// Shared setup for the "live integration tests" tier - see the header comment
// in products.test.ts for why these hit a live running server instead of
// Medusa's isolated medusaIntegrationTestRunner harness.
//
// Points at the ISOLATED test stack (backend :9002, its own nova_store_test
// database) - never the dev backend on :9000, which is the real/"production"
// DB the admin panel points at. Bring the test backend up first:
//   cd apps/backend && npm run test:server
// (after `npm run test:db:setup`-equivalent migrations + `npm run test:seed`
// have been run once - see TESTING.md for the full one-time setup.)

export const BASE_URL = process.env.TEST_BACKEND_URL || "http://localhost:9002"

export const ADMIN_EMAIL = "admin@nova.local"
export const ADMIN_PASSWORD = "Admin12345!"

export async function adminLogin(): Promise<string> {
  const res = await fetch(`${BASE_URL}/auth/user/emailpass`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  })
  if (res.status !== 200) {
    throw new Error(`Admin login failed with status ${res.status}`)
  }
  const body = await res.json()
  return body.token as string
}

/**
 * Fetches the publishable key live via the admin API instead of reading it
 * from a file - the key is regenerated on every reseed of the test DB, so
 * this stays correct without needing to sync a value across files.
 */
export async function getPublishableKey(adminToken: string): Promise<string> {
  const res = await fetch(
    `${BASE_URL}/admin/api-keys?type=publishable&limit=1&fields=id,token`,
    { headers: { Authorization: `Bearer ${adminToken}` } }
  )
  if (res.status !== 200) {
    throw new Error(`Fetching publishable key failed with status ${res.status}`)
  }
  const body = await res.json()
  const token = body.api_keys?.[0]?.token
  if (!token) {
    throw new Error("No publishable API key found - has the test DB been seeded?")
  }
  return token as string
}

export function storeHeaders(
  publishableKey: string,
  extra: Record<string, string> = {}
) {
  return {
    "x-publishable-api-key": publishableKey,
    "Content-Type": "application/json",
    ...extra,
  }
}
