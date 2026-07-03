// Requires `npm run test:server` running in apps/backend (the isolated test
// stack on :9002, backed by its own nova_store_test database) - see
// tests/integration/helpers.ts and TESTING.md.
//
// These are "live integration tests" against a real running server + DB —
// NOT Medusa's isolated `medusaIntegrationTestRunner` harness. That harness spins
// up its own ephemeral DB/app instance per run, which is heavier and out of scope
// here; instead we exercise the already-running server the way a real client
// would, using plain fetch. This is an explicit scope decision.
import { beforeAll, describe, expect, it } from "vitest"
import { BASE_URL, adminLogin, getPublishableKey } from "./helpers"

let publishableKey: string
let adminToken: string

beforeAll(async () => {
  adminToken = await adminLogin()
  publishableKey = await getPublishableKey(adminToken)
})

/** Recursively asserts no key named "password" (case-insensitive) exists anywhere in a value. */
function assertNoPasswordField(value: unknown, path = "root") {
  if (value === null || value === undefined) return
  if (Array.isArray(value)) {
    value.forEach((item, i) => assertNoPasswordField(item, `${path}[${i}]`))
    return
  }
  if (typeof value === "object") {
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (key.toLowerCase().includes("password")) {
        throw new Error(`Found forbidden key "${key}" at ${path}.${key}`)
      }
      assertNoPasswordField(val, `${path}.${key}`)
    }
  }
}

describe("admin mail accounts route protection", () => {
  it("rejects requests with no Authorization header (401)", async () => {
    const res = await fetch(`${BASE_URL}/admin/mail/accounts`)
    expect(res.status).toBe(401)
  })

  it("returns accounts (without password fields) for a valid admin JWT", async () => {
    const res = await fetch(`${BASE_URL}/admin/mail/accounts`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.accounts)).toBe(true)
    expect(body.accounts.length).toBeGreaterThan(0)
    for (const account of body.accounts) {
      expect(account).toHaveProperty("email")
      expect(account).toHaveProperty("login")
      expect(account).toHaveProperty("label")
    }
    // Recursively verify no password field leaked anywhere in the payload.
    assertNoPasswordField(body)
  })
})

describe("store products route requires publishable key", () => {
  it("rejects GET /store/products without x-publishable-api-key", async () => {
    const res = await fetch(`${BASE_URL}/store/products`)
    expect([400, 401]).toContain(res.status)
  })

  it("succeeds with the valid publishable key", async () => {
    const res = await fetch(`${BASE_URL}/store/products`, {
      headers: { "x-publishable-api-key": publishableKey },
    })
    expect(res.status).toBe(200)
  })
})
