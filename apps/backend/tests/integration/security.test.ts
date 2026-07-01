// Requires `npm run dev` running in apps/backend and the nova_postgres container up.
//
// These are "live integration tests" against the real running dev server + DB —
// NOT Medusa's isolated `medusaIntegrationTestRunner` harness. That harness spins
// up its own ephemeral DB/app instance per run, which is heavier and out of scope
// here; instead we exercise the already-running dev server the way a real client
// would, using plain fetch. This is an explicit scope decision.
import { beforeAll, describe, expect, it } from "vitest"

const BASE_URL = "http://localhost:9000"

let publishableKey: string
let adminToken: string

beforeAll(async () => {
  const fs = await import("fs")
  const path = await import("path")
  const envPath = path.resolve(__dirname, "../../../storefront/.env.local")
  const content = fs.readFileSync(envPath, "utf-8")
  const match = content.match(/NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=(\S+)/)
  if (!match) {
    throw new Error("Could not find NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY in storefront/.env.local")
  }
  publishableKey = match[1]

  const loginRes = await fetch(`${BASE_URL}/auth/user/emailpass`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@nova.local", password: "Admin12345!" }),
  })
  if (loginRes.status !== 200) {
    throw new Error(`Admin login failed with status ${loginRes.status}`)
  }
  const loginBody = await loginRes.json()
  adminToken = loginBody.token
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
